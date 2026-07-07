# Millionaire Addition

A premium, game-show-themed mental addition game. Earn money for correct
answers, build combos, and buy your way through 10 levels up to Millionaire
Mode. Progress (bank balance, owned levels, best scores) saves automatically
in the browser via `localStorage`.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Deploy to GitHub Pages (automatic)

This repo already includes a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that builds the site and publishes it to
GitHub Pages every time you push to `main`.

1. Push this project to a new GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push (or re-push) to `main` — the workflow will build and deploy
   automatically. Your game will be live at:
   - `https://<your-username>.github.io/<repo-name>/` (project page), or
   - `https://<your-username>.github.io/` (if the repo is named
     `<your-username>.github.io`)

No further configuration is needed — `vite.config.js` uses a relative
base path (`base: "./"`) so the build works at either kind of URL.

## Deploy to GitHub Pages (manual, no Actions)

If you'd rather not use Actions:

```bash
npm install
npm run build
npm install -g gh-pages
gh-pages -d dist
```

Then set **Settings → Pages → Source** to the `gh-pages` branch.

## Project structure

```
├── index.html
├── src/
│   ├── main.jsx       # React entry point
│   ├── App.jsx        # The whole game
│   └── index.css      # Tailwind entry
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── .github/workflows/deploy.yml
```

## Tech

- React + Vite
- Tailwind CSS
- lucide-react icons
- Pure CSS keyframe animations (no animation library dependency)
