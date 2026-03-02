# SUPI.ER.TO — Project Overview

## Description

A personal interactive graffiti gallery for the artist SUPI.ER.TO (formerly BONE). The collection is a flat, chronologically sorted set of ~197 images expected to grow to 200–500+. The site offers four distinct gallery modes, a fullscreen carousel with URL deep-linking, and a hidden admin panel for adding new pieces via GitHub.

---

## Goals

- Showcase the graffiti collection in four visually distinct ways
- Allow the owner to add new pieces from an admin panel without touching code
- Perform well with 200–500 images across all gallery modes
- Work natively on mobile and desktop
- Dark mode by default, minimal and compact aesthetic

---

## Tech Stack

| Technology | Version | Rationale |
|---|---|---|
| Next.js (App Router) | latest | Static site generation, file-based routing, dynamic imports for code splitting |
| TypeScript | latest | Type safety across all components |
| Tailwind CSS | latest | Utility-first, rapid styling, easy dark mode |
| shadcn/ui | latest | Accessible, composable UI primitives built on Radix |
| DM Mono | Google Fonts | Monospace font matching the graffiti/raw aesthetic |
| React Three Fiber | latest | React wrapper for Three.js, used in Experimental mode |
| @react-three/drei | latest | R3F helper components (OrbitControls, useTexture, etc.) |
| @use-gesture/react | latest | Best-in-class gesture library — butter-smooth on both mouse and touch |
| yet-another-react-lightbox | latest | Purpose-built lightbox with swipe, keyboard nav, and performance |
| react-masonry-css | latest | Lightweight CSS-based masonry grid (native CSS masonry not cross-browser) |
| next-auth | latest | GitHub OAuth, session management |
| Sharp | latest | Server-side image compression (Node.js, used in scripts and Netlify Function) |
| @octokit/rest | latest | GitHub REST API client for admin commits |
| @netlify/functions | latest | Netlify Functions v2 runtime |
| Framer Motion | latest | Fade transitions between gallery modes |
| Netlify | — | Static hosting + serverless functions |

---

## Architecture

```
Browser (Next.js SPA, static)
    │
    ├── /          Main gallery page (Classic/Grid/Explorative/Experimental)
    ├── /admin     Hidden admin route (GitHub OAuth protected)
    └── /api/auth  next-auth GitHub OAuth callback
         │
         └── Netlify Functions
                  └── upload-image.ts  (Sharp compress + GitHub API commit)
                              │
                              └── GitHub REST API
                                       └── Repo (images + images.json) → Netlify rebuild trigger
```

**Data flow for new images**:
1. Admin uploads image in `/admin` sheet
2. Netlify Function compresses to 3 WebP sizes using Sharp
3. Single atomic GitHub API commit: 3 WebP files + updated `images.json`
4. GitHub push triggers Netlify rebuild (~1 min)
5. Admin session shows image immediately via React state (before rebuild)

**Data flow for gallery**:
1. Browser fetches `/data/images.json` on mount
2. Filters and sorts images client-side
3. Gallery mode renders with lazy-loaded WebP images

---

## All Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Admin storage | GitHub API multi-file atomic commit → Netlify rebuild | Keeps everything in git, no external services needed |
| Admin instant preview | React state on success | Zero infra cost; admin sees image immediately without waiting for rebuild |
| Collection size target | 200–500+ images | Drives all performance and virtualization decisions |
| Explorative tiling | True seamless infinite tiling (3×3 tile grid, modulo wrap) | Most immersive; user never runs out of canvas |
| Explorative layout | Random per session | Feels alive and unique each visit |
| Explorative rotation | ±8° per image | Subtle, natural, reminiscent of photos spread on a table |
| Three.js graffiti placement | Vertical walls of rooftop structures (stairhouses, parapets, AC boxes) | Realistic top-down view placement; authentic graffiti context |
| Three.js graffiti click | Camera moves to face the graffiti only (no carousel) | Keeps the 3D experience pure; carousel would break immersion |
| Three.js skyline | Large finite city, random generative each load | Simpler than infinite tiling; still vast and unique each time |
| Three.js camera | Slow auto-drift ~10s per piece, eased; resumes 4s after user stops | Ambient, cinematic; not disruptive when user is exploring |
| Image metadata fields | `id`, `filename`, `date`, `sortOrder`, `tag` | Minimal viable set; sortOrder handles same-day ordering |
| Tag system | Exclusive: bone or supi, never both | Artist's two distinct creative eras |
| Image output format | WebP | Best compression/quality ratio for web |
| Responsive sizes | 500px (thumb), 1280px (medium), 2400px (full) | Thumb for grid/explorative; medium for classic; full for lightbox |
| Carousel filter | Respects active image set filter | Consistent navigation context |
| URL state | Only `?image={id}` for carousel deep links | Shareable image links; mode/filter not worth persisting in URL |
| Deep link behavior | Opens default mode + carousel overlay at that image | Clean UX; no jarring mode switches |
| Mode transitions | Fade (Framer Motion AnimatePresence) | Smooth, minimal, matches the aesthetic |
| Drag library | @use-gesture/react | Best touch feel; handles both mouse and touch uniformly |
| Masonry library | react-masonry-css | Lightweight; native CSS masonry not cross-browser |
| Carousel library | yet-another-react-lightbox | Exactly what was requested; keyboard, swipe, performance |
| Mobile behavior | Explorative + Experimental work on touch; header/options in-flow | Full experience on all devices |
| Admin auth | GitHub OAuth, whitelist by username env var | Simple, secure; only owner can log in |
| Upload formats | JPG and PNG, no size limit | Common formats; Sharp handles large files |

---

## Source Image Mapping

Source directory: `image-sources/` (not deployed)

| Folder | Tag | Notes |
|---|---|---|
| `00-photos/` | `bone` | Photos of graffiti pieces |
| `01-sketch-bone/` | `bone` | Sketch work from bone era |
| `02-rip.jpg` | `bone` | Single file at root level |
| `03-sketch-supi/` | `supi` | Sketch work from supi era |

**Sort order**: Folder order first (00→01→02→03), then numeric filename order within each folder. All initial images share the placeholder date `2024-01-01`; `sortOrder` (global 0-indexed integer) is the display order.

**File naming in sources**: Numeric prefix (e.g. `00.jpg`, `01.jpg`) with decimal variants (e.g. `00.0.jpg`, `00.1.jpg`, `60.1.jpg`). The decimal part is parsed as a float for ordering within each folder.

---

## Environment Variables

| Variable | Where used | Description |
|---|---|---|
| `GITHUB_ID` | Next.js server | GitHub OAuth App client ID |
| `GITHUB_SECRET` | Next.js server | GitHub OAuth App client secret |
| `GITHUB_TOKEN` | Netlify Function | Personal access token, scope: `repo` (write) |
| `GITHUB_REPO` | Netlify Function | Format: `owner/repo-name` |
| `GITHUB_REPO_OWNER` | Netlify Function | GitHub username or org owning the repo |
| `ALLOWED_GITHUB_USERNAME` | Next.js server + Function | Your GitHub username; only this account can log in |
| `NEXTAUTH_SECRET` | Next.js server | Random string (generate: `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Next.js server | Production URL (e.g. `https://supi-er-to.netlify.app`) |

---

## Directory Structure

```
supi-er-to/
├── image-sources/              # Source JPGs — not deployed, not committed after initial processing
│   ├── 00-photos/              # bone-tagged photos
│   ├── 01-sketch-bone/         # bone-tagged sketches
│   ├── 02-rip.jpg              # bone-tagged single file
│   └── 03-sketch-supi/         # supi-tagged sketches
│
├── public/
│   ├── images/                 # Generated WebP files (committed to repo)
│   │   ├── {id}.500.webp       # Thumbnail (500px wide)
│   │   ├── {id}.1280.webp      # Medium (1280px wide)
│   │   └── {id}.2400.webp      # Full (2400px wide)
│   └── data/
│       └── images.json         # Flat image list, sorted by sortOrder
│
├── scripts/
│   └── process-images.ts       # One-time script: compress sources → WebP + generate JSON
│
├── netlify/
│   └── functions/
│       └── upload-image.ts     # Admin upload handler (compress + GitHub commit)
│
├── specs/                      # This directory — implementation specs
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout: fonts, providers, dark mode init
│   │   ├── page.tsx            # Main gallery page (client component)
│   │   ├── admin/
│   │   │   └── page.tsx        # Hidden admin route
│   │   └── api/auth/
│   │       └── [...nextauth]/
│   │           └── route.ts    # next-auth GitHub OAuth handler
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx      # Fixed top-left title + subline
│   │   │   └── OptionsBar.tsx  # Fixed top-right: filter, mode, theme, admin
│   │   ├── gallery/
│   │   │   ├── ClassicGallery.tsx
│   │   │   ├── GridGallery.tsx
│   │   │   ├── ExplorativeGallery.tsx
│   │   │   └── ExperimentalGallery.tsx
│   │   ├── ui/
│   │   │   ├── LoadableImage.tsx  # Lazy-loading image with placeholder + fade-in
│   │   │   └── icons/
│   │   │       └── index.tsx      # All custom SVG icons
│   │   └── admin/
│   │       └── NewPieceSheet.tsx  # shadcn Sheet with upload form
│   │
│   ├── lib/
│   │   ├── images.ts           # fetchImages, filterImages, getImageSrc
│   │   ├── url-state.ts        # URL param helpers for carousel deep links
│   │   └── github.ts           # GitHub API helpers (used by Netlify Function)
│   │
│   └── types/
│       └── index.ts            # GalleryImage, GalleryMode, ImageFilter, Tag
│
├── .env.local                  # Local env vars (not committed)
├── .env.local.example          # Template (committed)
├── netlify.toml                # Netlify build config
└── next.config.ts              # Next.js config
```

---

## Design System

| Property | Value |
|---|---|
| Font family | DM Mono (all text, including buttons and inputs) |
| Base theme | shadcn default |
| Default mode | Dark |
| Border radius | 2px (override shadcn default) |
| Border width | 1px |
| Shadows | None |
| Typography | Small and compact (text-xs or text-sm base) |
| Icon style | 24×24px SVG, stroke="currentColor", strokeWidth=1.5, fill="none", round caps and joins |
| Tooltips | On all icon-only buttons (shadcn Tooltip) |
| Button/input font | Same size as body text |
| Gutter | 20px |
