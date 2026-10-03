# ARX MODS TM

Premium resources, tools and communities for developers and modding enthusiasts.

A static-first marketing site with one optional serverless endpoint. No build step,
no framework, no API keys, no paid services.

---

## Stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Markup     | Hand-written HTML5, semantic + accessible           |
| Styling    | CSS3, custom properties, `prefers-reduced-motion`   |
| Behaviour  | Vanilla JS (progressive enhancement, no libraries)  |
| Serverless | One Vercel Node function (`api/telegram.js`)        |
| Fonts      | Inter + JetBrains Mono via Google Fonts             |

The page is fully readable and navigable with JavaScript disabled. JS only adds
entrance animations, scroll spy, pointer lighting and Telegram metadata.

---

## Project structure

```

arxmods/
├── index.html              # the entire page
├── api/
│   └── telegram.js         # public Telegram metadata resolver (no API key)
├── assets/
│   ├── css/styles.css
│   ├── js/main.js
│   ├── logo.svg            # brand mark (also used for og:image)
│   └── favicon.svg
├── package.json
├── vercel.json             # security headers, CSP, cache policy
├── robots.txt
├── sitemap.xml
├── .gitignore
└── README.md

```

---

## Deploy

### Option A — Vercel CLI

```bash
cd arxmods
npx vercel        # preview
npx vercel --prod # production
```

### Option B — Git import

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project → Import** the repository.
3. Framework preset: **Other**. Build command: leave empty. Output directory: leave empty.
4. Deploy.

`api/telegram.js` is detected automatically as a serverless function. No environment
variables are required.

---

## The `/api/telegram` endpoint

```
GET /api/telegram?u=SAHMXCHEATS
```

Returns publicly available metadata for a **public** Telegram channel or group by
reading the Open Graph tags Telegram already serves on `t.me` pages.

```
{
  "ok": true,
  "username": "SAHMXCHEATS",
  "title": "ARX MODS OFC",
  "description": "…",
  "image": "https://cdn4.telesco.pe/file/…",
  "kind": "channel",
  "members": 129,
  "memberLabel": "subscribers",
  "verified": false
}
```

Failure responses are always `200` with `{ "ok": false, "reason": "…" }` so the
front end degrades silently to the curated card content.

**Design constraints, deliberate:**

- No Telegram API key, bot token, or third-party service.
- Only `@username` input matching `^[A-Za-z0-9_]{4,32}$` is accepted. Private invite
hashes (`t.me/+…`) are rejected before any outbound request — this doubles as SSRF
protection.
- Images are whitelisted to Telegram's own HTTPS CDN hosts.
- Cached `s-maxage=3600, stale-while-revalidate=86400` at the edge, so repeated
visits cost zero upstream requests.
- Never exposes credentials to the browser — there are none.

**Expected behaviour per card:**

| Card | Public? | Resolves live |
|---|---|---|
| ARXMODS CHANNEL | yes | avatar, type, subscriber count |
| ARXMODS CHAT | no | curated fallback |
| SRC ZONE | no | curated fallback |
| DEHA X OSCAR CHANNEL | yes | avatar, type, subscriber count |
| DEVELOPERS CHANNEL MOROCCANS | yes | avatar, type, subscriber count |

Private invite links do not expose public metadata. Those cards intentionally keep
the curated name, a generic Telegram avatar and a working **Open Telegram** button.
Nothing is simulated.

If the endpoint is unreachable or Telegram changes its markup, every card simply
renders its static content. There is no broken state.

---

## Customising

**Telegram cards** — each `<article class="card tcard">` in `index.html`:

- `data-tg="USERNAME"` enables live resolution. Remove the attribute to keep a card
fully static (private invites already omit it).
- `data-tg-kind="channel|group"` sets the initial badge.
- The `data-tg-title`, `data-tg-desc`, `data-tg-handle` elements hold the curated
fallback text.

**Disclaimer** — edit the `.dcard__body` blocks in `index.html`.

**Colours** — every value lives in the `:root` block at the top of
`assets/css/styles.css`. Change `--red` / `--red-bright` to retheme the accent.

**Adding a service card** — copy the `<article class="card wcard">` block and swap
the name, description and `href`.

---

## Brand assets

`assets/logo.svg` and `assets/favicon.svg` are vector and render at any size.

The hero `<img>` requests `assets/logo.png` first. If that file is absent, the page
swaps in the `ARX` text mark automatically — there is never a broken-image icon.
Drop a square PNG at `assets/logo.png` (512×512 is ideal) to use your own artwork.

For richer social previews, add a **1200×630** PNG at `assets/og-image.png` and point
the two `og:image` / `twitter:image` tags in `index.html` at it. SVG previews render on
some crawlers but not on X or Facebook.

---

## Pre-launch checklist

- □  
Replace `https://arxmods.vercel.app` in `index.html` (canonical, `og:url`,
JSON-LD), `robots.txt` and `sitemap.xml` with the real domain.
- □  
Optionally add `assets/logo.png` and `assets/og-image.png`.
- □  
Run Lighthouse — target 95+ on Performance, Accessibility, Best Practices and SEO.

---

## Accessibility

- Semantic landmarks, single `h1`, ordered heading levels.
- Skip link to `#main`.
- Visible `:focus-visible` rings on every interactive element.
- Mobile drawer manages `aria-expanded` and closes on `Escape`.
- `prefers-reduced-motion` disables all animation and reveals.
- `forced-colors` mode keeps every boundary visible.
- Decorative SVG is `aria-hidden`; the logo carries real `alt` text.

---

## Licence

All rights reserved. © 2026 ARX MODS TM.

