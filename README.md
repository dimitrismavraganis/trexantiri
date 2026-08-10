# Τρεχαντήρι 1924 — static site

Plain HTML/CSS/JS build of the Trexantiri website. No build step, no framework — deploys as-is.

## Structure
- `index.html`, `about.html`, `contact.html`, `menu.html` — the four pages
- `css/style.css` — all shared styles
- `js/main.js` — header glass-on-scroll, mobile modal menu, infinite draggable carousels, scroll-reveal (IntersectionObserver)
- `js/home.js` — homepage-only: preloader, hero expand/reveal animation, closing-scene text reveal
- `assets/` — images

## Deploy to Vercel
1. Push this folder to a GitHub repo (root of the repo = this folder, i.e. `index.html` at the repo root).
2. In Vercel: **New Project → Import** the repo.
3. Framework preset: **Other** (static). No build command, no output directory override needed — Vercel serves the root as-is.
4. Deploy.

## Notes
- The 4 dish tiles under "Ό,τι θα βρείτε στο τραπέζι μας" on the homepage still show placeholder tiles (no real photo was supplied) — drop images into `assets/` and swap the `.img-placeholder` divs in `index.html` for `<img>` tags when ready.
- The webcam embed and Google Maps embed point at third-party URLs and need no keys.
- Update the Facebook link (currently `https://facebook.com`) in each page's footer once the real page exists.
