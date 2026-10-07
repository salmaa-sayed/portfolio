"""Download the supplied sources and encode local, fast-start H.264/AAC MP4s.
Requires current yt-dlp with EJS, Node >=22, ffmpeg, and ffprobe.
Run: YTDLP=/path/to/yt-dlp python3 scripts/prepare-media.py
Sources stay outside the repository; only optimized deliverables are committed.
"""
import concurrent.futures, json, os, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(os.environ.get('SALMAA_SOURCE_DIR', '/private/tmp/salmaa-sources'))
YTDLP = os.environ.get('YTDLP', 'yt-dlp')
GROUPS = {
  'motion': ['2_83tmPxycc', 'lex8r6LOHu8', 'XN4P5rIAQjU', 'isDsxGrKy_M'],
  'teasers': ['huGofbtz-b4', 'eRFnpAxorso', 'WHof-wzP970', 'dBLbzSQgc6I'],
  'reels': ['KIV_ARPy8aA', 'xY_oTtFAGRo', 'z68RErUQRPE', 'USarlIfU78k', 'zvoBdHHm600', 'ODt0ao291vc', 'RtL4B8awR8s', 'VVMzcErR5yo', 'ttAh6XKlP6E', 'c5hBQKr6CWo', '_WOKJZZFybs'],
}

def probe(file):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(file)]))

def prepare(entry):
    folder, video_id = entry
    source = SOURCE / f'{video_id}.mp4'
    target = ROOT / 'media' / folder / f'{video_id}.mp4'
    target.parent.mkdir(parents=True, exist_ok=True)
    if not source.exists():
        print(f'Downloading {video_id}', flush=True)
        subprocess.run([YTDLP, '--js-runtimes', 'node', '--no-playlist', '--no-progress', '--socket-timeout', '25', '--retries', '3', '-f', 'bv*[height<=1080]+ba/b[height<=1080]/best', '--merge-output-format', 'mp4', '--remux-video', 'mp4', '-o', str(SOURCE / '%(id)s.%(ext)s'), f'https://www.youtube.com/watch?v={video_id}'], check=True)
    original = probe(source)
    if not target.exists() or os.environ.get('SALMAA_REENCODE') == '1':
        print(f'Encoding {video_id}', flush=True)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-map', '0:v:0', '-map', '0:a:0?', '-vf', "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2", '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-threads', '2', '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-movflags', '+faststart', str(target)], check=True)
    final = probe(target)
    video = next(s for s in final['streams'] if s['codec_type'] == 'video')
    # Produce posters from the same local footage, avoiding Shorts letterboxing.
    poster = ROOT / 'media/posters' / f'{video_id}.jpg'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '1', '-i', str(target), '-frames:v', '1', '-vf', "scale='min(1200,iw)':-2", '-q:v', '3', str(poster)], check=True)
    entry = { 'id': video_id, 'source': f'https://www.youtube.com/watch?v={video_id}', 'path': str(target.relative_to(ROOT)), 'duration': float(final['format']['duration']), 'width': video['width'], 'height': video['height'], 'videoCodec': video['codec_name'], 'pixelFormat': video['pix_fmt'], 'audioCodec': next((s['codec_name'] for s in final['streams'] if s['codec_type'] == 'audio'), None), 'sourceBytes': source.stat().st_size, 'bytes': target.stat().st_size }
    print(f'Ready {video_id}: {entry["width"]}×{entry["height"]}, {entry["bytes"] / 1048576:.1f} MB', flush=True)
    return entry

if __name__ == '__main__':
    SOURCE.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(prepare, [(folder, video_id) for folder, ids in GROUPS.items() for video_id in ids]))
    (ROOT / 'media/manifest.json').write_text(json.dumps(results, indent=2) + '\n')
    print(f'Total: {sum(item["bytes"] for item in results) / 1048576:.1f} MB', flush=True)
