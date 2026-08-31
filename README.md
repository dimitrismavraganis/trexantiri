# Τρεχαντήρι 1924 — bilingual static site

Plain HTML/CSS/JS. The only build step is a small script that generates the
English pages from the Greek ones.

## Structure
- `index.html`, `about.html`, `contact.html`, `menu.html` — the four pages, **authored in Greek**. These are the single source of truth for both languages.
- `i18n/en.json` — Greek string → English string
- `build.js` — generates `dist/`
- `css/style.css` — all shared styles
- `js/main.js` — header glass-on-scroll, mobile modal menu, infinite draggable carousels, scroll-reveal (IntersectionObserver), cookie notice
- `js/home.js` — homepage-only: preloader, hero expand/reveal animation, closing-scene text reveal
- `assets/` — images

## Building

```
npm run build     # or: node build.js
```

Output:

```
dist/index.html      →  /            English (default)
dist/el/index.html   →  /el/         Greek
dist/css, js, assets →  shared by both languages
```

To preview locally you need a server that understands `cleanUrls` (so `/about`
serves `about.html`). Any static server that does extensionless lookup works.

## How the translation works

Edit copy in the Greek `.html` files as normal. Most strings are matched by
their **exact Greek text**, so nothing in the markup needs annotating — add the
matching entry to `i18n/en.json` and it is picked up.

If you change a Greek string and forget its translation, the build prints it:

```
2 string(s) with no en translation in i18n/en.json:
  · Καλαμάκι, Ίσθμια
```

The page still builds — it just falls back to the Greek text — so a missed
translation is visible rather than silent.

Two spots need the markup itself to differ between languages and carry an
explicit attribute instead:

- `data-i18n-words="scene.headline"` — the homepage closing headline animates
  word by word, so the build re-splits the translated phrase into spans.
- `data-i18n="about.generation"` — `4η γενιά` / `4th generation`, where the
  superscript sits in a different place in each language.

The build also handles, for both languages: `<html lang>`, `canonical` and
`hreflang` tags, internal links, the header/mobile language switcher, and
tagging Greek fragments on English pages with `lang="el"` so `text-transform:
uppercase` drops the accents the way Greek requires (Μπύρες → ΜΠΥΡΕΣ).

Dish names are authored in Greek like everything else and translated through
`i18n/en.json`. The section headings appear in the dictionary **in both
directions** (`Σαλάτες → Salads` *and* `Salads → Σαλάτες`), because each heading
shows the other language as its subtitle and the two have to swap places
between builds.

## Carousels

Each `.trx-carousel` lists its photos **once**. `js/main.js` clones the strip
until it is wider than its container and then moves it with a transform, taken
modulo the width of one set — so it loops without ever reaching an edge.
Dragging tracks the pointer 1:1 and keeps its momentum; between interactions the
strip drifts slowly and stops on hover. Without JS the markup degrades to a
plain horizontally scrollable row, so don't duplicate the items by hand.

## Cookie notice

One markup block per page (`[data-cookie-notice]`, just before `js/main.js`) plus
`.trx-cookie` in the stylesheet. The choice is remembered in `localStorage` under
`trx-cookie-notice`. The site sets no tracking cookies, so the notice is purely
informational and has a single button.

## Deploy

Vercel builds from `vercel.json` — `node build.js`, output `dist`. Push to
`main` and it deploys.

## Notes
- The webcam embed and Google Maps embed point at third-party URLs and need no keys.
- Update the Facebook link (currently `https://facebook.com`) in each page's footer once the real page exists.
- `assets/scene-dorado.webp`, `assets/scene-octopus.jpg` and `assets/scene-trout-figs.webp` are stock shots of dishes that aren't ours, and are also by far the largest files here (8.3 MB / 7.1 MB / 4.1 MB). Nothing references them any more; delete them once you're sure they aren't wanted.
- Photo filenames predate the photos: `ceviche.webp` is a table on the veranda, `seafood-plates.webp` is steamed mussels, `terrace-palms.webp` is the indoor dining room, `scene-pasta2.webp` is raw red mullet. The `alt` text describes what is actually in each shot.
