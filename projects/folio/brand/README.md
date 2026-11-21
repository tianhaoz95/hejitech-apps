# Folio brand

The "Bauhaus" mark (chosen 2026-11-21, `reports/2026-11-21-folio-logo-redesign`, candidate 08): an F
built from a navy bar, a coral quarter circle and a mustard dot on warm paper.

| Token | Light | Dark |
|---|---|---|
| Paper (icon ground, app background) | `#f2ede4` | `#15161c` |
| Navy (bar, accent) | `#1e2a78` | `#7d8cff` (icon) / `#8f9bff` (UI accent) |
| Coral | `#f25c3b` | `#f25c3b` |
| Mustard | `#f2b630` | `#f2b630` |

`icon.svg` / `icon-dark.svg` are the masters (1024 grid, full bleed, no corner rounding: the OS masks
it). `node brand/render-icons.mjs` (from `projects/folio`, needs the repo's Playwright) writes every
PNG and the web favicon from them:

- `apps/ios/App/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png`, `AppIcon-dark.png`, `AppIcon-tinted.png`
- `apps/ios/App/Resources/Assets.xcassets/AppMark.imageset/AppMark.png` (sign-in screen)
- `docs/public/icon.png` (512, rounded)
- `services/web/public/icon.svg` (favicon + header mark, rounded tile, follows the system's dark mode)
