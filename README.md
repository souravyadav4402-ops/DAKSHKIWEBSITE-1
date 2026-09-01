# MINESTACKERBOT

A premium, futuristic **Mines analysis and visualization** web app — one universal responsive
website (marketing landing page **plus** the full application) built as static HTML, CSS and
vanilla JavaScript.

> **This is not a playable Mines game and not a prediction service.** You never click, open,
> reveal or select individual cells. Every grid is generated automatically from your seed, and
> every figure it shows is an **estimate / simulation**. Nothing here predicts or promises a
> future game outcome.

---

## How to run (offline)

```
open index.html
```

- No build step, no `npm install`, no bundler, no framework, no CDN.
- **Zero network requests**: no external fonts, no icon fonts, no analytics, no audio files.
  Icons are an inline SVG sprite, the type stack is the system font stack, and sound effects are
  synthesized with WebAudio on demand.
- Runs straight from `file://` in any modern browser, fully offline.
- Client-side hash router, so every view is reachable by URL: `#/home`, `#/analyze`,
  `#/history`, `#/history/<id>`, `#/subscription`, `#/settings`, `#/profile`, `#/about`.

## Project layout

```
index.html              # single page: icon sprite, app shell, all views
assets/
  css/
    core.css            # design tokens, reset, typography, shell, navigation, themes
    components.css      # buttons, cards, fields, toggles, 5x5 grid + cell states, overlays
    views.css           # per-view layout: landing, dashboard, history, plans, settings, ...
    animations.css      # keyframes, boot screen, analysis overlay, rocket, grid reveal,
                        # plus the reduced-motion / animations-off instant paths
  js/
    model.js            # seeded PRNG + safe-tile table + grid model (pure, no DOM)
    store.js            # localStorage persistence: settings, profile, history
    ui.js               # toasts, ripples, sound, haptics, modals, reveal, cursor, dates
    analysis.js         # analysis console component, overlay sequence, grid rendering
    app.js              # router, navigation, settings, history, detail, profile, plans
  logo.png              # official logo — see "Logo replacement" (not committed yet)
  logo.svg              # neutral placeholder used automatically if logo.png is missing
tools/
  verify-model.js       # `node tools/verify-model.js` — proves the grid model (dev only)
```

## Views

| Route | View | Contents |
| --- | --- | --- |
| `#/home` | Landing | Hero (animated grid visual, two CTAs), 3 feature cards, **interactive demo running the real engine**, pricing (Free / Pro “Most Popular” / VIP), clearly-labelled social-proof placeholder slots, footer with T&C / Privacy / Socials |
| `#/analyze` | Analysis dashboard | Analysis header + `● READY` status, ENTER CLIENT SEED card (PASTE / CLEAR), SELECT MINES (slider + 1–24 buttons in rows of 8, `⚠ HIGH RISK` for 10–24), ANALYZE GRID, analysis overlay, results + 5 × 5 grid + info cards. Desktop adds a right-hand status/legend/responsible-use panel |
| `#/history` | Past analyses | Search by date or mine count, entries with date, time, shortened hash, mine count, simulated confidence, safe-tile count, high-risk flag; empty state before your first run |
| `#/history/<id>` | Analysis details | Read-only record + regenerated 5 × 5 visualization, `NEW ANALYSIS` |
| `#/subscription` | MineStackerBot Pro | Monthly / Yearly (`BEST VALUE`) switch, FREE / PRO (visually dominant) / VIP, `UPGRADE TO PRO`. Interface only — see “Payments” |
| `#/settings` | Settings | ACCOUNT · BOT CONFIGURATION (analysis speed, animations, sound, haptics) · APP (theme, language, notifications) · ABOUT |
| `#/profile` | Profile | Logo, username, plan badge, analyses run, profile edit, security, subscription |
| `#/about` | About & Responsible Use | What the tool is, the responsible-use statement, how the visualization is produced, privacy, version |

The landing page and the application share **one** design system, **one** navigation and **one**
data store — the demo on the landing page is the same component as the dashboard console and
writes to the same local history.

## Responsive system

One adaptive layout, not separate versions:

| Width | Chrome | Layout |
| --- | --- | --- |
| < 768px | Compact top bar + bottom navigation | Single column, stacked cards, full-width buttons |
| 768–1023px | Collapsed sidebar icon rail | Wider cards, two columns where sensible |
| 1024–1279px | Full sidebar with labels, centred container | Analysis area prominent |
| ≥ 1280px | Sidebar + centre + right info panel | Dashboard layout, larger grid |
| ≥ 1600px | Same chrome | Content constrained to a comfortable max width, balanced whitespace |

No horizontal scrolling at any width, and the 5 × 5 grid always stays perfectly square
(`grid-template-columns: repeat(5, minmax(0, 1fr))` + `aspect-ratio: 1 / 1`).

## Reveal rule — what the grid actually shows

The grid always contains **exactly 25 cells**. The number of **revealed safe gem tiles** is a
function of the selected mine count (a range is resolved deterministically from the seeded PRNG):

| Mines | Safe tiles | Mines | Safe tiles |
| --- | --- | --- | --- |
| 1 | 5–6 | 13 | 2 |
| 2 | 6 | 14 | 2 |
| 3 | 5–6 | 15 | 2 |
| 4 | 5 | 16 | 2 |
| 5 | 4–5 | 17 | 2 |
| 6 | 4 | 18 | 2 |
| 7 | 3–4 | 19 | 2 |
| 8 | 3 | 20 | 2 |
| 9 | 2–3 | 21 | 2 |
| 10 | 2 | 22 | 2 |
| 11 | 2 | 23 | 2 |
| 12 | 2 | 24 | 1 |

Everything else is rendered in the neutral “unrevealed” state and **carries no information**.

**True bomb / mine positions are never computed, stored or revealed.** There is deliberately no
array of bomb indexes anywhere in the code, so nothing can leak through the DOM, a global or
devtools. A neon-red mine cell state exists in the design system (and is shown in the dashboard's
cell legend, labelled as never revealed) but is never applied to a grid cell.

Generation is deterministic: the same seed with the same mine count always renders the same
layout; changing either input changes it. Verify it yourself:

```
node tools/verify-model.js
```

## Honest metrics — please keep them honest

This product generates randomized, seed-derived visualizations. It cannot determine or predict
provably-fair Mines outcomes, so the copy deliberately avoids accuracy claims, win-rate claims and
any promise of a result:

- The “estimated confidence” figure is labelled everywhere as a **simulated, illustrative
  metric** — it is not a measured accuracy, hit rate or win probability.
- The About / Responsible Use view states plainly that visualizations are estimates and
  simulations that do not predict or promise future game outcomes.
- The `REVEALED SAFE TILES` info card always shows the **actual** number of revealed tiles
  (e.g. `5 / 25`), so the UI can never contradict the grid.
- Social proof is empty, clearly-labelled placeholder scaffolding. Replace it only with real
  quotes from real users who consented — never invent testimonials, avatars or win screenshots.
- Never reintroduce a specific accuracy, hit-rate or win-rate percentage as a product claim, never
  assure a win or a safe tile, and never present users as proven winners. It would be false
  advertising.

## Payments

The subscription screens are **interface only**. `UPGRADE TO PRO` / `Choose VIP` call a clearly
commented placeholder in `assets/js/app.js` (`requestCheckout`) that takes no payment and changes
nothing; the app always reports the `FREE` plan. A developer wires that function to a real
provider and only marks a plan active after the provider (or a trusted backend webhook) confirms
the payment. Never render a successful payment state without that confirmation. Prices, plan
limits and any refund terms in the markup are editable placeholder copy.

## Accessibility & motion

- Visible focus rings on every control, full keyboard navigation (arrow keys also move through
  the mine-count chips), accessible labels on all icon-only buttons, and touch targets ≥ 40px.
- Gem vs unrevealed state is **never** communicated by colour alone: each cell carries a distinct
  icon plus screen-reader text, the grid exposes a summary label, and the revealed coordinates are
  printed under the grid (`GEM TILES: R1C3 · …`).
- `prefers-reduced-motion: reduce` — and the Settings ▸ Animations toggle — switch every
  animation to an instant path (no boot delay, no overlay, no reveal choreography, no rocket).
- Pinch-zoom is allowed: the viewport meta sets no `maximum-scale`.
- Sound effects are **off by default**, synthesized (no audio files) and toggleable in Settings.
  The custom cursor is desktop-only (`pointer: fine`) and never hides the real cursor.

## Persistence

Settings, profile and analysis history live in `localStorage`
(`msb.settings.v2`, `msb.profile.v2`, `msb.history.v2`) and are capped at 100 history entries.
History is populated **only** by analyses you actually run — no seeded fake data. If storage is
unavailable, the app keeps working for the session and says so.

## Logo replacement (required)

The app references the official logo at:

```
assets/logo.png
```

1. Drop the official **high-resolution** logo in at exactly `assets/logo.png`.
2. **Do not rename, recreate, redraw, simplify or modify it.** Preserve the original artwork,
   proportions, colours and quality, and always use the highest available image quality.
3. No code changes are needed — every logo slot already points at `assets/logo.png`.

Each slot uses `object-fit: contain` with a `max-width`, so the real logo renders undistorted at
its original proportions whatever its native dimensions. Until the file exists, an `onerror`
handler falls back to the neutral placeholder `assets/logo.svg`.
