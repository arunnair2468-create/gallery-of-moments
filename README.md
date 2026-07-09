# The Gallery of Moments

A first-person, walk-through 3D photo gallery housing 122 photographs shot across
India, organized into 8 themed halls. It ships as **two complete experiences**
sharing the same photos and controls, with switch links on both landing pages:

- **The Kerala museum** (`/`) — an antique tharavad at dusk: teak doors, brass
  lamps, terracotta floors, a nadumuttam skylight.
- **The Modern Exhibition** (`/modern/`) — a contemporary white-cube show:
  glass lobby, luminous panel ceilings, track lighting, and a differently
  styled gallery for every theme (white cube, dark walnut, freestanding panel
  maze, industrial, greige, oak, backlit lightboxes, neon-ink).

## Run it locally

Browsers block local image loading from `file://`, so the site needs a tiny web server:

- **Easiest:** double-click **`Start Gallery.bat`** — it starts a local server and opens
  your browser at `http://localhost:8321`.
- Or run `powershell -ExecutionPolicy Bypass -File serve.ps1` yourself.

No installation, no internet, no build step required. Everything (including Three.js)
is bundled in this folder.

## View it on a phone

The same site adapts to phones automatically (a joystick appears for navigation).
Phones can't run the server themselves, so either:

- **Share from a PC:** double-click **`Share on Wi-Fi.bat`** (it asks for administrator
  permission once, to open the port). The window prints an address like
  `http://192.168.1.5:8321/` — open that in the phone's browser while it is on the
  same Wi-Fi network as the PC.
- **Host it online** (see below) and open the URL from anywhere.

## Publish it online

Upload the entire folder (everything except `serve.ps1`, `Start Gallery.bat`, `.claude/`)
to any static host — GitHub Pages, Netlify, Cloudflare Pages, Vercel. It is ~60 MB,
mostly photographs.

## Controls

| Input | Action |
|---|---|
| Move mouse toward screen edges | look left / right / up / down |
| Scroll wheel | walk forward / backward |
| `W A S D` / arrow keys | walk & turn (bonus) |
| Click a photo | open it full-size with its caption |
| Click a door | walk into that hall |
| `Esc` | close viewer / overlays |
| Touch devices | joystick (bottom-right): push up/down to walk, left/right to turn; drag the view to look around; tap photos & doors |

## Customize

- **Your name, about text, social links:** edit the `SITE` object at the top of
  [js/data.js](js/data.js) — the social URLs are placeholders waiting for your real handles.
- **Titles & captions:** every photo entry in `js/data.js` has a `title` and `cap`.
- **Rooms:** the `ROOMS` map defines the 8 halls; move a photo between rooms by
  changing its `room` field.

## Adding new photos

1. Drop the original in `D:\Photos\Best Ones`.
2. Re-run the resize script (ask Claude, or see `assets/` sizes: `img` ≤1920px,
   `mid` ≤1024px, `thumb` ≤448px — all JPEG).
3. Add one entry to `PHOTOS` in `js/data.js` with the new id, room, aspect ratio
   (`r = width/height`), title and caption.

## Folder map

```
index.html          shell + HUD + overlays
css/style.css       landing, HUD, lightbox, cinematic layers
js/three.min.js     Three.js r147 (bundled, no CDN)
js/data.js          ← all editable content lives here
js/app.js           the 3D engine (exterior, halls, movement, lightbox)
assets/img/         1920px lightbox images
assets/mid/         1024px wall textures
assets/thumb/       448px thumbnails
```
