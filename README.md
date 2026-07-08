# Millionaire Addition — Mobile Edition

A fast-paced mental-math addition game. This version is set up to:

- Run as a normal website
- Be installed on Android (and desktop) as a standalone app (PWA)
- Deploy straight to **GitHub Pages**
- Answer with a big **on-screen number pad** (no keyboard needed) as well as the device keyboard

## What changed for mobile / hosting

- Added a tap-friendly **number pad** (0–9, backspace, clear) below the answer box.
- Swapped the Claude-only `window.storage` save system for plain **`localStorage`** — progress now saves in the player's own browser on any site.
- Added a **manifest.json**, **service worker**, and icons so Chrome on Android (and desktop) offers "Install app" / "Add to Home screen", and the game keeps working offline once opened.
- Added mobile viewport tags, safe-area padding (for notches/gesture bars), and touch tweaks (no double-tap zoom, no text-select on buttons).
- Wired the whole thing into a small **Vite** project so it builds into plain static files GitHub Pages can serve, plus a GitHub Actions workflow that deploys automatically.

## Run it locally

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173` link. On your phone, you can also open your computer's local network address (e.g. `http://192.168.x.x:5173`) if it's on the same Wi‑Fi, to test on a real device.

## Deploy to GitHub Pages (recommended: automatic)

1. Create a new GitHub repository and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Millionaire Addition — mobile edition"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. In the repo on GitHub, go to **Settings → Pages**, and under "Build and deployment" set **Source** to **GitHub Actions**.
3. That's it — pushing to `main` triggers the included workflow (`.github/workflows/deploy.yml`), which builds the app and publishes it. Your game will be live at:
   ```
   https://<your-username>.github.io/<your-repo>/
   ```
   The first deploy takes a minute or two; check the **Actions** tab for progress.

### Deploy manually instead (optional)

If you'd rather not use GitHub Actions:

```bash
npm install
npm run deploy
```

This builds the app and pushes the `dist` folder to a `gh-pages` branch using the `gh-pages` package. Then in **Settings → Pages**, set **Source** to the `gh-pages` branch.

## Installing it on an Android phone

1. Open the deployed link in **Chrome** on the phone.
2. Tap the **⋮** menu → **Add to Home screen** / **Install app** (Chrome will often prompt automatically after a visit or two).
3. It launches full-screen from the home screen icon, like a native app, and keeps working without signal after the first load.

The same works on desktop Chrome/Edge via the install icon in the address bar.

## Project structure

```
├── index.html              # entry HTML, PWA meta tags
├── src/
│   ├── main.jsx             # React mount + service worker registration
│   ├── App.jsx               # the game itself
│   └── index.css             # Tailwind entry
├── public/
│   ├── manifest.json          # PWA install manifest
│   ├── sw.js                  # offline service worker
│   └── icons/                 # app icons (generated)
└── .github/workflows/deploy.yml   # auto build + deploy to GitHub Pages
```

## Notes

- Game progress is stored in the browser's `localStorage`, per-device/per-browser. Clearing site data or reinstalling will reset progress.
- All sound effects are generated live with the Web Audio API — no audio files to host.
