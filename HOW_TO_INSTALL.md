# Installing Millionaire Addition on your Android phone

This is a **Progressive Web App (PWA)** — the real way to get an installable app
onto a phone without an Android developer setup (Android Studio + SDK + signing
keys, which this sandbox doesn't have access to). A PWA installs a real icon on
your home screen, opens full-screen with no browser bar, and works offline.

## Option A — Install as an app (2 minutes, no coding)

1. Upload the whole `app` folder to a free static host. Easiest options:
   - **Netlify Drop**: go to https://app.netlify.com/drop and drag the `app`
     folder onto the page. It gives you a live https link instantly, no account needed.
   - **GitHub Pages**: push the folder to a GitHub repo and enable Pages.
2. Open that link on your Android phone in **Chrome**.
3. Tap the **⋮ menu → "Install app"** (or you'll see an automatic "Add
   Millionaire Addition to Home screen" banner). Tap **Install**.
4. A real app icon appears on your home screen/app drawer. Tap it to play —
   it works offline after the first load.

## Option B — Turn it into an actual installable .apk file

If you specifically want an `.apk` file you can install like a normal Android
app (instead of a home-screen web app):

1. Do step 1 above to get your https link.
2. Go to **https://www.pwabuilder.com**, paste your link, and click "Start".
3. Click **Package for Stores → Android**, then download the generated `.apk`.
4. Transfer the `.apk` to your phone and open it (Android will ask you to
   allow "install unknown apps" the first time — that's normal for anything
   installed outside the Play Store).

## Just want to try it right now?

You can open `app/index.html` directly in Chrome on your phone (no hosting
needed) to play immediately — you just won't get the "Install" prompt or
offline support until it's served over https as in Option A.

---

### What was changed from your original file
- Rebuilt as a plain HTML/CSS/JS app (no React needed) with a `manifest.json`
  and `service-worker.js` so it's installable and works offline.
- Typing the answer is now a **big on-screen number keypad** (0–9, backspace,
  OK) instead of the phone's system keyboard — auto-submits once you've
  entered enough digits, same as before.
- Added a footer credit: **"© 2026 ReBan Technologies"** on the Home, Timer,
  and End screens.
- All game logic (levels, unlock costs, combo multipliers, scoring, streaks,
  timer) is unchanged from your original.
