# pwa-icons

## What & Why

`manifest.json` references `icon-192.png` and `icon-512.png` but neither exists in `/public/`. Without them the browser cannot prompt users to install the PWA on mobile, and some browsers show a broken icon in the install UI.

## Approach

A script at `scripts/generate-icons.ts` uses the `sharp` package to rasterise a simple SVG (dark green background + white football circle) into the two required PNG sizes. The script is run once as part of setup; the output files are committed to the repo so the build requires no extra tooling.

## Output

- `public/icon-192.png` — 192×192 px
- `public/icon-512.png` — 512×512 px

## Usage

```bash
pnpm generate-icons
```
