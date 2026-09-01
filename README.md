# MINES STACKER BOT

A premium, futuristic, **mobile-only** Mines **analysis / visualisation** application.

> **This is NOT a playable Mines game.** You never open, click, reveal, or select individual
> cells. The app takes your inputs, runs an animated evaluation, and then auto-generates a
> fully revealed grid for you to read.

## What it does

The complete flow is:

**Seed -> Select Mines -> Analyze -> Animated Evaluation -> Auto-generated 5x5 Grid**

1. **Seed**: enter a seed (or generate one).
2. **Select Mines**: choose the mine count.
3. **Analyze**: tap Analyze to start.
4. **Animated Evaluation**: an evaluation sequence plays.
5. **5x5 Grid**: a grid of exactly **25 cells** is generated and fully revealed.

Generation is **deterministic**: the same seed with the same mine count always produces the
same grid.

## How to run

This is a self-contained static HTML app. There is **no build step and no dependencies**.

- Open `index.html` directly in a browser.
- It works **offline** (runs straight from `file://`, no server and no internet required).
- It is designed for a **mobile / phone viewport**, so it looks best at a narrow width
  (around 390px). On desktop, use your browser's device/responsive mode for the intended look.

No `npm install`, no bundler, no CDN. Just open the file.

## Project layout

```
index.html        # entry point (references assets/ via relative paths)
assets/
  app.js          # application logic (vanilla JS)
  style.css       # styling
  logo.png        # official logo (see "Logo replacement" below; placeholder until added)
  logo.svg        # neutral placeholder used as fallback if logo.png is missing
```

## Logo replacement (required)

The app brands itself with the official **Mines Stacker Bot gorilla logo**, referenced at:

```
assets/logo.png
```

To install the real logo:

1. Drop the official **high-resolution** gorilla logo in at **`assets/logo.png`**, using the
   exact same path and filename.
2. **Do not rename it, recreate it, redraw it, simplify it, or modify it** in any way. Preserve
   its original artwork, proportions, colours, and quality. Always use the highest available
   image quality.
3. No code changes are needed. `index.html` already points at `assets/logo.png`.

The CSS uses `object-fit: contain` together with `max-width`, so the real logo renders
**undistorted at full quality with its original proportions**, whatever its native dimensions.

If `assets/logo.png` is not present, the app falls back to the neutral placeholder
`assets/logo.svg` (via an `onerror` handler) so the layout still works before the real logo is
added.

## Reveal behavior (for transparency)

The generated 5x5 grid does **not** expose true bomb positions. Instead it reveals only
**4-5 random safe green gem tiles** (gem) and renders all remaining tiles as a **gray mines
gradient**. The actual bomb locations are never shown. This is intentional: the tool is for
analysis and visualisation, not for playing Mines.
