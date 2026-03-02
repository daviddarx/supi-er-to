# SUPI.ER.TO — Project Instructions

## What This Is

A personal interactive graffiti gallery. ~197 images, growing to 200–500+. Four gallery modes (Classic, Grid, Explorative, Experimental), fullscreen carousel with URL deep links, hidden admin panel at `/admin`.

Full specs: `specs/` directory. Start with `specs/00-overview.md` for architecture overview.

---

## Tech Stack

- **Next.js** App Router, TypeScript, `output: "export"` (static)
- **Tailwind CSS** + **shadcn/ui** (2px border-radius, 1px borders, no shadows, dark default)
- **Font**: DM Mono everywhere (including buttons and inputs)
- **Framer Motion** — fade transitions between gallery modes
- **@use-gesture/react** — drag (Explorative mode)
- **react-masonry-css** — Grid mode masonry
- **yet-another-react-lightbox** (YARL) — fullscreen carousel
- **React Three Fiber** + **@react-three/drei** — Experimental mode
- **next-auth** — GitHub OAuth (whitelist: `ALLOWED_GITHUB_USERNAME`)
- **Sharp** — image compression (build script + Netlify Function)
- **@octokit/rest** — GitHub API (admin commits)
- **Netlify** — hosting + Netlify Functions

---

## Key Architectural Decisions

| Topic | Decision |
|---|---|
| Image storage | WebP in `public/images/`, JSON in `public/data/images.json` — all in git |
| Admin upload | Netlify Function: Sharp compress → single atomic GitHub commit (3 WebP sizes + JSON) → Netlify rebuild |
| Admin preview | New image shown instantly in admin React state before rebuild |
| Explorative tiling | True seamless infinite tiling via 3×3 tile grid + modulo offset |
| Explorative layout | Random per session (`Math.random()`, not seeded) |
| Explorative rotation | ±8° per image |
| Three.js graffiti | On vertical walls of rooftop structures (stairhouses, parapets); camera zoom only, no carousel |
| Three.js city | Large finite, random generative per load |
| Three.js camera | Slow auto-drift ~10s per piece, LERP; resumes 4s after user stops |
| Carousel | Filter-aware (only cycles filtered set); URL `?image={id}` deep link |
| Mode transitions | Fade (Framer Motion AnimatePresence, duration 0.25s) |
| Mobile | Header + OptionsBar in-flow (not fixed); Grid = 1 column |
| Dark mode | Default dark; saved to localStorage |

---

## Image Data

**Source**: `image-sources/` (not deployed)
- `00-photos/` → tag `bone`
- `01-sketch-bone/` → tag `bone`
- `02-rip.jpg` → tag `bone`
- `03-sketch-supi/` → tag `supi`

**Output**: `public/images/{id}.500.webp`, `{id}.1280.webp`, `{id}.2400.webp`

**JSON entry shape**:
```typescript
{ id: string, filename: string, date: string, sortOrder: number, tag: "bone" | "supi" }
```

**Generate**: `npm run process-images` (runs `scripts/process-images.ts` via tsx)

**Sort order display**: newest first (date DESC, sortOrder DESC). Initial set all share date `2024-01-01`; sortOrder is the visual sequence.

---

## Key File Paths

```
public/data/images.json          Image list (flat, all entries)
public/images/                   WebP files (committed to repo)
image-sources/                   Source JPGs (not deployed)
scripts/process-images.ts        Image compression script
netlify/functions/upload-image.ts Admin upload handler
src/app/page.tsx                 Main gallery page (manages all state)
src/app/admin/page.tsx           Hidden admin route
src/components/layout/Header.tsx
src/components/layout/OptionsBar.tsx
src/components/gallery/ClassicGallery.tsx
src/components/gallery/GridGallery.tsx
src/components/gallery/ExplorativeGallery.tsx
src/components/gallery/ExperimentalGallery.tsx
src/components/gallery/CarouselOverlay.tsx
src/components/ui/LoadableImage.tsx
src/components/ui/icons/index.tsx  All custom SVG icons
src/components/admin/NewPieceSheet.tsx
src/lib/images.ts                fetchImages, filterImages, getImageSrc
src/lib/github.ts                commitFiles (used by Netlify Function only)
src/lib/url-state.ts             ?image= URL param helpers
src/types/index.ts               GalleryImage, GalleryMode, ImageFilter, Tag
```

---

## Design System Rules

- **Font**: DM Mono (all text, all elements including buttons and inputs)
- **Dark mode**: default; `dark` class on `<html>`; toggle saves to localStorage
- **Border radius**: 2px everywhere (override shadcn default)
- **Border width**: 1px
- **Shadows**: none (`box-shadow: none !important` globally)
- **Typography**: small/compact (`text-xs` base)
- **Icons**: custom SVG 24×24, `strokeWidth=1.5`, `fill="none"`, round caps — never use icon libraries
- **Icon-only buttons**: always wrap in shadcn `<Tooltip>`
- **Colors**: based on shadcn CSS variables only

---

## Mode Behavior

| Mode | Image size | Click action | Mobile |
|---|---|---|---|
| Classic | 1280px | Opens carousel | Same, in-flow header |
| Grid | 500px (thumb) | Opens carousel | Single column |
| Explorative | 500px (thumb) | Opens carousel | Touch drag works natively |
| Experimental | 1280px (texture) | Camera zoom (no carousel) | Touch orbital controls |

**Gallery props contract**: All modes receive `images: GalleryImage[]` (already filtered + sorted) and `onImageClick: (index: number) => void`.

---

## Memory Cleanup (Critical)

Each gallery mode's `useEffect` cleanup **must**:
- **Explorative**: cancel `requestAnimationFrame` inertia loop
- **Experimental**: dispose Three.js geometries, materials, textures (call `scene.traverse()`)
- Both: `@use-gesture` and R3F handle their own cleanup on unmount

---

## Environment Variables

```
GITHUB_ID                 GitHub OAuth App client ID
GITHUB_SECRET             GitHub OAuth App client secret
GITHUB_TOKEN              Personal access token (repo write scope)
GITHUB_REPO               owner/repo-name
GITHUB_REPO_OWNER         GitHub username/org
ALLOWED_GITHUB_USERNAME   Your GitHub username (admin whitelist)
NEXTAUTH_SECRET           Random string (openssl rand -base64 32)
NEXTAUTH_URL              Production URL
```

---

## Commands

```bash
npm run dev              Local dev (no Netlify Functions)
netlify dev              Local dev WITH Netlify Functions (admin upload)
npm run build            Production build
npm run process-images   Compress source images + generate images.json
npm run format           Prettier (runs automatically after file changes per CLAUDE.md)
```

---

## Prettier (Auto-run After Every File Change)

Config: `.prettierrc` with `prettier-plugin-tailwindcss`. Run `npm run format` after every file edit.

---

## Gotchas

- `image-sources/` is `image-sources` (not `images-sources` as typo in original prompt)
- `next.config.ts` uses `output: "export"` — no server-side rendering; next-auth routes handled by `@netlify/plugin-nextjs`
- `useSearchParams()` in App Router requires `<Suspense>` wrapper — use `DeepLinkHandler` component
- Netlify Function must import `sharp` and `@octokit/rest`; bundler is `nft`
- GitHub API commit flow: create blobs → create tree → create commit → update ref (all via `src/lib/github.ts`)
- Admin sends image as base64 JSON (not multipart) to Netlify Function
- `yet-another-react-lightbox` styles must be imported globally
- Three.js `useTexture` caches textures; explicit disposal needed if memory issues arise
- `@use-gesture/react` `useDrag` needs `from: () => [offsetRef.current.x, offsetRef.current.y]` to maintain position between gestures
