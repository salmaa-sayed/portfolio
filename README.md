# Salmaa Sayed — Made to move

Website: https://salmaa-sayed.github.io/portfolio/

A complete, content-driven static portfolio for motion graphics and video editing.
Charcoal and dark grey, white typography, motion paths, and keyframe details form Salmaa's
own visual identity. There is no runtime framework, build step, account, or
third-party media request.

## Preview

```sh
npm ci
npm run dev
```

Open http://localhost:4173. The preview server supports media byte ranges for
seeking. The published site only needs a normal static host.

## Edit the portfolio

`content/content.js` is the source of truth for section order, captions, media,
playback preferences, and contact links. Move items or sections to reorder them;
set `enabled: false` to hide a section. Existing media is organized as:

- `media/motion/`: 4 motion projects
- `media/teasers/`: 4 brand teasers
- `media/reels/`: 11 reels/work projects
- `media/posters/`: frames extracted from the same local footage
- `media/fonts/`: self-hosted Bricolage Grotesque and Manrope, with OFL licenses

All 19 supplied videos are committed as actual `.mp4` files, without Git LFS or
YouTube embeds. Each uses H.264, yuv420p, AAC audio, and a front-loaded `moov`
atom for progressive playback. Portrait files are capped at 720px high;
landscape files are capped at 1280×720. Source aspect ratios are preserved.
The complete library is approximately 25 MiB. Original quality is never upscaled.
`media/manifest.json` records source URLs, duration, dimensions, codecs, and sizes.
YouTube is used only during media preparation.

To replace or refresh footage, install current yt-dlp with its EJS dependencies,
Node 22+, ffmpeg, and ffprobe, then run `python3 scripts/prepare-media.py`.
Set `YTDLP` to the downloader path if needed; `SALMAA_SOURCE_DIR` selects the
source cache outside the repo; `SALMAA_REENCODE=1` forces re-encoding.

## Playback and accessibility

At most one visible local preview autoplays, always muted. Video sources are
assigned only when played. Reduced-motion and data-saving preferences disable
autoplay. Manual playback wins over previews; explicitly paused media stays
paused. Offscreen playback stops; backgrounding pauses all players. Sound
preferences are saved when storage is available and remain usable when blocked.

Cards support play/pause, sound, seeking, and the fullscreen focused viewer.
The viewer retains playback position, provides native video controls, handles
previous/next buttons, keyboard arrows, swipes outside native controls, Escape,
and browser Back. It restores focus and scroll position on close and unloads
the viewer's player. An additional fullscreen button uses native fullscreen
with a full-viewport dialog fallback. Rails support touch scrolling, mouse
dragging, arrow buttons, and keyboard navigation without capturing vertical
page scrolling. Failed media has a retry path. Contact links open email,
WhatsApp, or phone directly.

The engine retains the functional reference's optional YouTube/Vimeo and image
adapters for future content, but **no production portfolio item uses them**.

## Tests

```sh
npm ci
npx playwright install chrome webkit
npm run check
npm test
```

The suite uses Google Chrome for Chromium tests and WebKit for Safari behavior.
Chrome supplies H.264 decoding consistently across development and Linux CI;
some bundled Chromium builds omit that codec. Tests cover production decoding of
all 19 MP4s, fast-start encoding, content completeness, exclusive autoplay,
lazy loading, seek, mute persistence, retry, blocked storage, backgrounding,
viewer cleanup, focus restoration, keyboard/swipe/drag navigation, browser Back,
320–1440px viewport bounds, and WCAG A/AA checks with axe. A small generated
H.264/AAC test pattern isolates repeatable playback edge cases. Remote adapters
are tested with stubs; no external provider is contacted by the production suite.

## Hosting

Upload `index.html`, `styles.css`, `content/`, and `media/` to a static host, or
use GitHub Pages with the repository root as the publishing source. Relative
asset paths support both a custom domain and a `/portfolio/` project path.
No environment variables or external services are required.

## Functional reference

Media behavior and the regression-test scenarios were adapted from
https://github.com/marwanrabah/portfolio (reference commit
`0bf657a2a4294123af7e21477b1448f703a7bf0a`). Salmaa's design, copy, contact details,
portfolio content, and assets are independent. No Marwan portfolio footage or
personal content is included. See `DESIGN.md` for the visual direction.
