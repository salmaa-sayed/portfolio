"""Refresh thumbnails from Salma's supplied public videos; no video downloads."""
import concurrent.futures, json, urllib.request
from pathlib import Path
IDS = ['isDsxGrKy_M', '2_83tmPxycc', 'lex8r6LOHu8', 'XN4P5rIAQjU', 'huGofbtz-b4', 'eRFnpAxorso', 'WHof-wzP970', 'dBLbzSQgc6I', 'KIV_ARPy8aA', 'xY_oTtFAGRo', 'z68RErUQRPE', 'USarlIfU78k', 'zvoBdHHm600', 'ODt0ao291vc', 'RtL4B8awR8s', 'VVMzcErR5yo', 'ttAh6XKlP6E', 'c5hBQKr6CWo', '_WOKJZZFybs']
ROOT = Path(__file__).resolve().parent.parent

def fetch(video_id):
    metadata = json.loads(urllib.request.urlopen(f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json', timeout=25).read())
    for quality in ['maxresdefault', 'hqdefault']:
        try:
            data = urllib.request.urlopen(f'https://i.ytimg.com/vi/{video_id}/{quality}.jpg', timeout=25).read()
            if len(data) < 3000:
                continue
            (ROOT / 'media/posters' / f'{video_id}.jpg').write_bytes(data)
            break
        except Exception:
            continue
    print(video_id, metadata['title'])
    return video_id, {k:metadata[k] for k in ['title', 'author_name', 'author_url']}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        metadata = dict(pool.map(fetch, IDS))
    (ROOT / 'media/source-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
