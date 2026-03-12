# Review-00 Implementation Plan

This directory contains the full implementation plan for the first review cycle of SUPI.ER.TO.
The 34-item review spec is in `prompt.md`. The plan is split into three phases.

## Phases

| File | Covers | Review items |
|---|---|---|
| `phase-1-design-system-icons-buttons.md` | Design tokens, typography, favicon, SVG icons, ButtonGroup component, PWA manifest | 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 35 |
| `phase-2-header-gallery-images.md` | Header/OptionsBar sticky + mobile layout, Select fixes, Classic/Grid/Explorative modes, intrinsic image dimensions | 3, 4, 18, 19, 20, 21, 22, 23, 24, 25, 33 |
| `phase-3-carousel-routing-admin.md` | Carousel (YARL) fixes, zoom cursor, path-based routing, image ID system, admin sheet | 26, 27, 28, 29, 30, 31, 32, 34 |

## Key Architecture Decisions

- **Routing**: Real Next.js pages for modes (`/classic`, `/grid`, etc.). Carousel image ID in path (`/classic/supi-24`) via `pushState` only — Netlify `_redirects` handles deep links.
- **Filter**: Query param `?filter=supi`.
- **Icons**: All redrawn with `strokeWidth=1`, pixel-aligned coordinates.
- **ButtonGroup**: New reusable component, per-button borders, no border-radius.
- **Explorative layout**: Tile dimensions scale with `sqrt(n / BASE_COUNT)` to maintain density when filtered.
- **Carousel nav**: `NavButton`/`CloseButton` components inside YARL context using `useController()`.
- **Zoom cursor**: Global `ZoomCursor` component with custom events and lerp animation.
- **Intrinsic sizes**: Saved to `images.json` at process time; used in `LoadableImage` for aspect-ratio before load.

## Implementation Order

1. Phase 1 first (design tokens affect everything downstream)
2. Phase 2 (depends on ButtonGroup from Phase 1)
3. Phase 3 (routing can go last; depends on image type changes from Phase 2)
