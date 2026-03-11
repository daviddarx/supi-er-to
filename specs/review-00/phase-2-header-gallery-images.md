# Phase 2 — Header, Gallery Modes & Image Dimensions

Implementation plan for: sticky header layout, Select component fixes, mobile OptionsBar layout, Classic/Grid mode spacing, Explorative tile scaling + click refactor, LoadableImage z-index fix, and intrinsic image dimension support throughout the stack.

---

## Table of Contents

1. [OptionsBar: sticky positioning](#1-optionsbar-sticky-positioning)
2. [OptionsBar: mobile layout restructure](#2-optionsbar-mobile-layout-restructure)
3. [OptionsBar: Select component fixes](#3-optionsbar-select-component-fixes)
4. [Header: sticky positioning](#4-header-sticky-positioning)
5. [page.tsx: sticky header wrapper](#5-pagetsx-sticky-header-wrapper)
6. [LoadableImage: z-index fix](#6-loadableimage-z-index-fix)
7. [Classic Gallery: spacing](#7-classic-gallery-spacing)
8. [Grid Gallery: 1px gap + min 2 columns + full width](#8-grid-gallery-1px-gap--min-2-columns--full-width)
9. [Explorative: tile scaling for subsets](#9-explorative-tile-scaling-for-subsets)
10. [Explorative: hover effect + click detection](#10-explorative-hover-effect--click-detection)
11. [Intrinsic image dimensions: type update](#11-intrinsic-image-dimensions-type-update)
12. [Intrinsic image dimensions: process-images.ts](#12-intrinsic-image-dimensions-process-imagests)
13. [Intrinsic image dimensions: upload-image.ts](#13-intrinsic-image-dimensions-upload-imagets)
14. [Intrinsic image dimensions: LoadableImage aspect-ratio](#14-intrinsic-image-dimensions-loadableimage-aspect-ratio)
15. [Intrinsic image dimensions: CarouselOverlay](#15-intrinsic-image-dimensions-carouseloverlay)
16. [Intrinsic image dimensions: GridGallery](#16-intrinsic-image-dimensions-gridgallery)
17. [Intrinsic image dimensions: ClassicGallery](#17-intrinsic-image-dimensions-classicgallery)
18. [Intrinsic image dimensions: ExplorativeGallery](#18-intrinsic-image-dimensions-explorativegallery)
19. [globals.css: masonry gap + explorative hover](#19-globalscss-masonry-gap--explorative-hover)
20. [Edge cases & notes](#20-edge-cases--notes)
21. [Change order & execution sequence](#21-change-order--execution-sequence)

---

## 1. OptionsBar: sticky positioning

**File:** `src/components/layout/OptionsBar.tsx`

**Current:**
```tsx
<div className="fixed top-3 right-3 z-50 flex flex-wrap items-center gap-2 max-md:static max-md:px-5 max-md:py-3">
```

**Change:** Replace `fixed top-3 right-3 z-50` with `sticky top-0 z-50`. Remove the `max-md:static` override — on mobile the element is already in-flow because the parent is a flex column. The `bg-background` background ensures the bar is opaque when it sticks.

The mobile classes (`max-md:px-5 max-md:py-3`) must be reworked as part of the mobile restructure in Section 2. Deal with those together.

The Explorative gallery uses `position: fixed; inset: 0` so it already covers the full viewport including behind the header. Because the OptionsBar now has `z-50` and the canvas has no explicit z-index (defaults to `auto` / stacking context order), the header naturally appears above the canvas. No change needed in ExplorativeGallery.

**New outer div:**
```tsx
<div className="bg-background sticky top-0 z-50 flex items-center gap-2 px-3 py-3 max-md:flex-col max-md:items-stretch max-md:gap-2 max-md:px-5 max-md:py-3">
```

The mobile restructure (Section 2) will refine the children layout.

---

## 2. OptionsBar: mobile layout restructure

**File:** `src/components/layout/OptionsBar.tsx`

On mobile the Select (filter) goes on its own full-width row. Below it: mode buttons on the left, dark mode (+ admin buttons) on the right, all in a `justify-between` flex row.

**Full revised JSX for OptionsBar:**

```tsx
export function OptionsBar({
  mode,
  filter,
  isDarkMode,
  onModeChange,
  onFilterChange,
  onDarkModeToggle,
  isAdmin,
  onNewPiece,
  onLogOut,
}: OptionsBarProps) {
  return (
    <div className="bg-background sticky top-0 z-50 flex items-center gap-2 px-3 py-3 max-md:flex-col max-md:items-stretch max-md:px-5 max-md:py-3">

      {/* Row 1 (mobile only): image set selector — full width */}
      {/* On desktop this sits inline in the single flex row */}
      <Select value={filter} onValueChange={(v) => onFilterChange(v as ImageFilter)}>
        <SelectTrigger className="h-10 min-w-[140px] rounded-[2px] bg-transparent text-sm max-md:w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="text-sm">
          <SelectItem value="all" className="text-sm">Everything</SelectItem>
          <SelectItem value="supi" className="text-sm">SUPI.ER.TO</SelectItem>
          <SelectItem value="bone" className="text-sm">BONE</SelectItem>
        </SelectContent>
      </Select>

      {/* Row 2 (mobile): mode buttons left, dark mode + admin right */}
      {/* On desktop: continues the same flex row */}
      <div className="flex items-center justify-between gap-2 max-md:w-full md:contents">

        {/* Gallery mode switcher */}
        <div className="flex items-center overflow-hidden rounded-[2px] border">
          {MODES.map(({ mode: m, icon, label }) => (
            <Tooltip key={m}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onModeChange(m)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center border-r transition-colors last:border-r-0",
                    m === mode
                      ? "bg-foreground text-background"
                      : "text-foreground has-hover:hover:bg-muted bg-transparent"
                  )}
                  aria-label={label}
                  aria-pressed={m === mode}
                >
                  {icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Right-side controls: dark mode + admin */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDarkModeToggle}
                className="has-hover:hover:bg-muted flex h-10 w-10 items-center justify-center rounded-[2px] border"
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? <IconSun /> : <IconMoon />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            </TooltipContent>
          </Tooltip>

          {isAdmin && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onNewPiece}
                    className="has-hover:hover:bg-muted flex h-10 w-10 items-center justify-center rounded-[2px] border"
                    aria-label="New piece arrival"
                  >
                    <IconPlus />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  New piece arrival
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onLogOut}
                    className="has-hover:hover:bg-muted flex h-10 w-10 items-center justify-center rounded-[2px] border"
                    aria-label="Log out"
                  >
                    <IconLogOut />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Log out
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Key notes:**
- `md:contents` on the inner wrapper collapses it on desktop, so the mode buttons and dark mode button flow directly into the outer `flex` row as siblings alongside the Select.
- `h-10 w-10` (40px) applied to all buttons for consistency with the Select trigger height.
- The Select trigger uses `min-w-[140px]` on desktop (wide enough for "Everything" + chevron) and `w-full` on mobile.

---

## 3. OptionsBar: Select component fixes

**File:** `src/components/layout/OptionsBar.tsx`

**Problems to fix:**
1. Text cut off on the right: `w-[120px]` is too narrow for "Everything" + the Radix chevron icon.
2. Font size inconsistency: trigger shows `text-xs` (12px), dropdown items default to Radix's own size.
3. Height mismatch: trigger is `h-8` (32px), buttons are `h-8` (32px) — both going to `h-10` (40px).
4. Background should be transparent on the trigger.

**Fix (already included in Section 2 code above, isolated here for clarity):**

```tsx
<SelectTrigger className="h-10 min-w-[140px] rounded-[2px] bg-transparent text-sm max-md:w-full">
  <SelectValue />
</SelectTrigger>
<SelectContent className="text-sm">
  <SelectItem value="all" className="text-sm">Everything</SelectItem>
  <SelectItem value="supi" className="text-sm">SUPI.ER.TO</SelectItem>
  <SelectItem value="bone" className="text-sm">BONE</SelectItem>
</SelectContent>
```

- `min-w-[140px]` instead of `w-[120px]`: allows the trigger to size to its content but never collapses below 140px. "Everything" in DM Mono at 14px is approximately 80px of text + 24px chevron + 16px padding = ~120px. 140px gives safe clearance.
- `bg-transparent` removes the default shadcn input background.
- `text-sm` (14px) on both trigger and all SelectItems. The `className` on `SelectContent` applies to the popover container via Radix's data attribute pass-through; adding `text-sm` to each `SelectItem` individually is the reliable way to ensure items also render at 14px since shadcn's SelectItem renders its own text span.
- `scrollbar-gutter: stable` is a page-level concern handled in `globals.css` on `body` or `html` (not in OptionsBar itself).

**globals.css addition** (avoids scrollbar causing layout shift when carousel opens):
```css
html {
  scrollbar-gutter: stable;
}
```

Add this inside `@layer base` or as a standalone rule after the `:root` block.

---

## 4. Header: sticky positioning

**File:** `src/components/layout/Header.tsx`

**Current:**
```tsx
<header className="fixed top-3 left-3 z-50 max-md:static max-md:px-5 max-md:pt-4">
```

**New:** The Header moves to sticky. It shares the same stacking context as the OptionsBar. On desktop they both sit `fixed`/`sticky` in their respective corners. Now both are sticky and sit in the same flow column (see Section 5 for the page wrapper).

```tsx
<header className="bg-background sticky top-0 z-50 px-3 py-3 max-md:px-5 max-md:pt-4 max-md:pb-0">
  <h1 className="text-xs leading-tight font-bold tracking-tight">SUPI.ER.TO</h1>
  <p className="text-muted-foreground text-xs leading-tight font-normal">
    BONE is dead — long live SUPI.ER.TO — Zürich
  </p>
</header>
```

**Key changes:**
- `fixed top-3 left-3` → `sticky top-0`
- `max-md:static` removed (sticky is already in-flow; `static` override no longer needed)
- `bg-background` added so that when sticky, it occludes content scrolling behind it
- `px-3 py-3` for desktop padding (was implicit via `top-3 left-3` offset)

---

## 5. page.tsx: sticky header wrapper

**File:** `src/app/page.tsx`

**Current structure:**
```tsx
<div className="bg-background min-h-screen">
  <div className="max-md:flex max-md:flex-col">
    <Header />
    <OptionsBar ... />
  </div>
  ...
</div>
```

With both Header and OptionsBar now `sticky top-0`, they must stack vertically in a single in-flow column that sits at the top of the document. On desktop both will stick at `top: 0` simultaneously — but since they are in a vertical flex column, they stack one below the other and each takes the height it needs.

However there is a subtle issue: two separate `sticky top-0` elements in a column will BOTH try to stick at `top: 0`. The Header will stick first and the OptionsBar will appear to scroll under it if they are separate siblings. The solution is to **wrap them together** in a single sticky container so they stick as a unit.

**Revised wrapper in page.tsx:**

```tsx
{/* Sticky header unit — Header + OptionsBar stick together as one block */}
<div className="sticky top-0 z-50 flex flex-col">
  <Header />
  <OptionsBar
    mode={mode}
    filter={filter}
    isDarkMode={isDarkMode}
    onModeChange={setMode}
    onFilterChange={setFilter}
    onDarkModeToggle={toggleDarkMode}
    isAdmin={isAdmin}
    onNewPiece={() => setNewPieceSheetOpen(true)}
    onLogOut={() => signOut({ callbackUrl: "/" })}
  />
</div>
```

**Consequence for Header and OptionsBar components:** Since the parent wrapper is now `sticky z-50`, the individual `sticky z-50` on each child is redundant but harmless. The `bg-background` on each child still matters for opacity. Alternatively, put `bg-background` on the wrapper div and remove it from the children — either approach works. The wrapper approach is cleaner:

```tsx
<div className="bg-background sticky top-0 z-50 flex flex-col max-md:gap-0">
  <Header />
  <OptionsBar ... />
</div>
```

Then `Header.tsx` and `OptionsBar.tsx` drop their own `sticky`/`z-50`/`bg-background` classes:

**Header.tsx simplified:**
```tsx
<header className="px-3 py-3 max-md:px-5 max-md:pt-4 max-md:pb-0">
  ...
</header>
```

**OptionsBar.tsx outer div simplified:**
```tsx
<div className="flex items-center gap-2 px-3 py-3 max-md:flex-col max-md:items-stretch max-md:px-5 max-md:py-3">
  ...
</div>
```

**Explorative mode with sticky header:**
The Explorative canvas is `position: fixed; inset: 0` — it covers the full viewport including the area behind the sticky header. The sticky header sits above it in z-order because the wrapper has `z-50`. No change to ExplorativeGallery is needed. The canvas is intentionally full-bleed; the header overlays it.

---

## 6. LoadableImage: z-index fix

**File:** `src/components/ui/LoadableImage.tsx`

**Problem:** The placeholder `<div className="bg-muted/20 absolute inset-0" />` has no explicit z-index. The `<img>` also has no z-index. In some browsers the placeholder can render above the loaded image, causing the image to never appear visually even after load, or to flicker.

**Current:**
```tsx
<div
  ref={containerRef}
  onClick={onClick}
  className={cn("relative overflow-hidden", onClick && "cursor-pointer", className)}
  style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
>
  {/* Subtle placeholder while the image loads */}
  <div className="bg-muted/20 absolute inset-0" />

  {isVisible && !hasError && (
    <img
      src={overrideSrc ?? getImageSrc(id, size)}
      alt={alt}
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
      className={cn(
        "h-full w-full object-cover transition-opacity duration-300",
        isLoaded ? "opacity-100" : "opacity-0"
      )}
      draggable={false}
    />
  )}
</div>
```

**Fix:** Add explicit z-index layering. The placeholder gets `z-0`, the `<img>` gets `z-10` (relative to the `relative` container). Use `absolute` positioning on the `<img>` too so both layers stack within the same `relative` container.

```tsx
<div
  ref={containerRef}
  onClick={onClick}
  className={cn("relative overflow-hidden", onClick && "cursor-pointer", className)}
  style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
>
  {/* Placeholder background — always rendered, stays below the image */}
  <div className="bg-muted/20 absolute inset-0 z-0" />

  {isVisible && !hasError && (
    <img
      src={overrideSrc ?? getImageSrc(id, size)}
      alt={alt}
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
      className={cn(
        "absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-300",
        isLoaded ? "opacity-100" : "opacity-0"
      )}
      draggable={false}
    />
  )}
</div>
```

**Key changes:**
- Placeholder div: adds `z-0`
- `<img>`: adds `absolute inset-0 z-10`. This makes the img fill the container exactly the same as before (since the container is `relative` and the img was already `h-full w-full`) but now the img is explicitly above the placeholder in the stacking order.

**Note on aspect-ratio:** With `absolute inset-0` on the `<img>`, the container's intrinsic height is driven by the `aspect-ratio` style (set in Section 14 via intrinsic dimensions). Without an `aspect-ratio`, a container with no defined height and only absolutely positioned children collapses to zero height. This is why the intrinsic dimension work (Section 14) must be done alongside this fix — both changes are interdependent for Classic and Grid modes where no aspect-ratio was previously set.

**Workaround if intrinsic dimensions are not yet available:** For the transition period (before `images.json` is regenerated with dimensions), keep the `<img>` as `static` (not absolute) and only apply `absolute inset-0` when `aspectRatio` prop is provided. This avoids container collapse:

```tsx
className={cn(
  "z-10 h-full w-full object-cover transition-opacity duration-300",
  aspectRatio ? "absolute inset-0" : "relative block",
  isLoaded ? "opacity-100" : "opacity-0"
)}
```

In practice, since process-images.ts is being updated in this same phase, both changes land together. Use the cleaner `absolute inset-0 z-10` form from the start.

---

## 7. Classic Gallery: spacing

**File:** `src/components/gallery/ClassicGallery.tsx`

**Current:**
```tsx
<main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-20 md:py-16">
```

**Required changes:**
- Gap between images: `15vh`
- Spacing from header to first image: `15vh`
- Max-width 1200px centered: keep as-is

Tailwind does not have a `gap-[15vh]` utility out of the box but arbitrary values are supported in Tailwind v4. The `py-20`/`md:py-16` sets top/bottom padding. We want the top padding specifically to be `15vh` and the gap to be `15vh`.

```tsx
<main
  className="mx-auto flex max-w-[1200px] flex-col px-5"
  style={{ gap: "15vh", paddingTop: "15vh", paddingBottom: "15vh" }}
>
```

Using inline `style` for viewport-unit values is the correct approach because Tailwind's JIT does not support `vh` units in the arbitrary value syntax for `gap` reliably across all configurations. Alternatively in Tailwind v4 you can use `gap-[15vh]` and `pt-[15vh]` — both forms are acceptable. Prefer `style` for clarity of intent.

Remove the `py-20 md:py-16` classes entirely. The old top padding compensated for the `fixed` header — with sticky layout and the header in-flow, that offset is no longer needed. The `15vh` top padding on the gallery itself provides the desired breathing room between the sticky header bar and the first image.

**Final:**
```tsx
export default function ClassicGallery({ images, onImageClick }: ClassicGalleryProps) {
  return (
    <main
      className="mx-auto flex max-w-[1200px] flex-col px-5"
      style={{ gap: "15vh", paddingTop: "15vh", paddingBottom: "15vh" }}
    >
      {images.map((image, index) => (
        <LoadableImage
          key={image.id}
          id={image.id}
          size={1280}
          alt={`${image.tag} piece`}
          onClick={() => onImageClick(index)}
          className="w-full"
          overrideSrc={image.previewSrc}
          width={image.width}
          height={image.height}
        />
      ))}
    </main>
  )
}
```

(The `width`/`height` props on `LoadableImage` are added in Section 14.)

---

## 8. Grid Gallery: 1px gap + min 2 columns + full width

**File:** `src/components/gallery/GridGallery.tsx`
**File:** `src/app/globals.css` (masonry CSS)

### 8a. Column count calculation

**Current:**
```tsx
const cols = Math.max(1, Math.round(containerWidth / 500))
```

**New:** Minimum 2 columns on all screen sizes (overrides the `CLAUDE.md` note of 1 column on mobile — the interview decision supersedes it).

```tsx
const cols = Math.max(2, Math.round(containerWidth / 500))
```

### 8b. Max-width: remove constraint

**Current:**
```tsx
<div ref={containerRef} className="mx-auto max-w-[2000px] px-5 py-20 md:py-16">
```

**New:** Remove `max-w-[2000px]` and `mx-auto`. The grid spans 100% of available width. Remove the old `py-20 md:py-16` top padding (same rationale as Classic: sticky header is in-flow now). Use a modest top padding consistent with the gallery being below the sticky bar.

```tsx
<div ref={containerRef} className="px-0 pt-0 pb-5">
```

No horizontal padding — the 1px gap between masonry columns goes edge-to-edge. The `pb-5` is a small bottom breathing room. Adjust to taste (could also use `pb-[5vh]`).

### 8c. Item bottom margin

**Current:**
```tsx
className="mb-5 w-full"
```

**New:** `mb-[1px]` so that vertical spacing between images in a column is also 1px.

```tsx
className="mb-px w-full"
```

(`mb-px` is Tailwind for `margin-bottom: 1px`.)

### 8d. globals.css masonry gap

**Current:**
```css
.masonry-grid {
  display: flex;
  margin-left: -20px;
  width: auto;
}

.masonry-grid_column {
  padding-left: 20px;
  background-clip: padding-box;
}
```

**New:**
```css
.masonry-grid {
  display: flex;
  margin-left: -1px;
  width: auto;
}

.masonry-grid_column {
  padding-left: 1px;
  background-clip: padding-box;
}
```

### 8e. Full revised GridGallery.tsx

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import Masonry from "react-masonry-css"
import { LoadableImage } from "@/components/ui/LoadableImage"
import type { GalleryImage } from "@/types"

interface GridGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

export default function GridGallery({ images, onImageClick }: GridGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(3)

  useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      // Aim for ~500px columns; always at least 2 columns
      const cols = Math.max(2, Math.round(containerWidth / 500))
      setColumnCount(cols)
    }

    updateColumns()

    const observer = new ResizeObserver(updateColumns)
    if (containerRef.current) observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [images])

  return (
    <div ref={containerRef} className="pb-5">
      <Masonry
        breakpointCols={columnCount}
        className="masonry-grid"
        columnClassName="masonry-grid_column"
      >
        {images.map((image, index) => (
          <LoadableImage
            key={image.id}
            id={image.id}
            size={500}
            alt={`${image.tag} piece`}
            onClick={() => onImageClick(index)}
            className="mb-px w-full"
            overrideSrc={image.previewSrc}
            width={image.width}
            height={image.height}
          />
        ))}
      </Masonry>
    </div>
  )
}
```

---

## 9. Explorative: tile scaling for subsets

**File:** `src/components/gallery/ExplorativeGallery.tsx`

### Problem

When filtering to a subset (e.g. only "bone" or only "supi"), the image count `n` may be much less than the full set. The tile dimensions `TILE_W = 5000` and `TILE_H = 4000` were sized for the full expected set (~200 images). With 30 images on the same 5000×4000 tile, images are sparse and separated by large empty areas — "holes".

### Solution: scale tile dimensions with `sqrt(n / base_count)`

The target is to maintain constant visual density (images-per-viewport-area). Area scales with the square of linear dimensions. Therefore linear tile dimensions scale with `sqrt(n)`:

```
tileW = BASE_TILE_W * sqrt(n / BASE_COUNT)
tileH = BASE_TILE_H * sqrt(n / BASE_COUNT)
```

Where `BASE_COUNT` is the expected full image set size (use `200` as the reference).

### Worked example

- Full set: `n = 200`, `BASE_COUNT = 200`
  - `scale = sqrt(200/200) = 1.0`
  - `tileW = 5000 * 1.0 = 5000`, `tileH = 4000 * 1.0 = 4000` — unchanged.

- BONE subset: `n = 60`, `BASE_COUNT = 200`
  - `scale = sqrt(60/200) = sqrt(0.3) ≈ 0.5477`
  - `tileW = 5000 * 0.5477 ≈ 2739px`, `tileH = 4000 * 0.5477 ≈ 2191px`

- SUPI subset: `n = 30`, `BASE_COUNT = 200`
  - `scale = sqrt(30/200) = sqrt(0.15) ≈ 0.3873`
  - `tileW = 5000 * 0.3873 ≈ 1936px`, `tileH = 4000 * 0.3873 ≈ 1549px`

Visual density (images per pixel²) stays roughly the same across all three cases.

### MIN_SEPARATION scaling

The minimum separation between images should also scale with the tile to avoid clustering in the smaller tile:

```
minSeparation = BASE_MIN_SEPARATION * sqrt(n / BASE_COUNT)
```

With `BASE_MIN_SEPARATION = 250`:
- At `n = 60`: `minSep ≈ 250 * 0.5477 ≈ 137px`
- At `n = 30`: `minSep ≈ 250 * 0.3873 ≈ 97px`

This scaling ensures the separation constraint is proportional to the tile size.

### Implementation

Remove the module-level `const TILE_W` and `const TILE_H` constants (or keep them as `BASE_TILE_W`/`BASE_TILE_H` for reference). Compute effective tile dimensions inside `generateLayout` based on the image count.

**Updated constants section:**
```tsx
const BASE_TILE_W = 5000
const BASE_TILE_H = 4000
const BASE_COUNT = 200
const BASE_MIN_SEPARATION = 250
```

Remove:
```tsx
const TILE_W = 5000
const TILE_H = 4000
const MIN_SEPARATION = 250
```

**Updated `generateLayout` function:**
```tsx
function generateLayout(images: GalleryImage[]): ImageLayout[] {
  const n = images.length
  // Scale tile to maintain constant visual density when the image set is a subset.
  // Linear dimensions scale with sqrt(n / BASE_COUNT) so area scales linearly with n.
  const scale = Math.sqrt(Math.max(n, 1) / BASE_COUNT)
  const tileW = BASE_TILE_W * scale
  const tileH = BASE_TILE_H * scale
  const minSeparation = BASE_MIN_SEPARATION * scale

  const layouts: ImageLayout[] = []
  const positions: Array<{ x: number; y: number }> = []

  for (const image of images) {
    const width = Math.round(280 + Math.random() * 140) // 280–420 px
    let x: number = Math.random() * tileW
    let y: number = Math.random() * tileH
    let attempts = 0

    do {
      x = Math.random() * tileW
      y = Math.random() * tileH
      attempts++
    } while (
      attempts < 20 &&
      positions.some((p) => Math.hypot(p.x - x, p.y - y) < minSeparation)
    )

    positions.push({ x, y })
    layouts.push({
      id: image.id,
      x,
      y,
      rotation: (Math.random() - 0.5) * 16, // ±8°
      width,
    })
  }

  return layouts
}
```

**`generateLayout` now also returns the tile dimensions** so the canvas can use them for tiling. Update the return type and add a companion hook:

Because `TILE_W` and `TILE_H` are used in the canvas component for the modulo wrap, the seamless tiling, and the culling algorithm, they must be derived from the same layout call. The cleanest approach is to make `generateLayout` return the tile dimensions alongside the layouts:

```tsx
interface GeneratedLayout {
  layouts: ImageLayout[]
  tileW: number
  tileH: number
}

function generateLayout(images: GalleryImage[]): GeneratedLayout {
  const n = images.length
  const scale = Math.sqrt(Math.max(n, 1) / BASE_COUNT)
  const tileW = Math.round(BASE_TILE_W * scale)
  const tileH = Math.round(BASE_TILE_H * scale)
  const minSeparation = BASE_MIN_SEPARATION * scale

  const layouts: ImageLayout[] = []
  const positions: Array<{ x: number; y: number }> = []

  for (const image of images) {
    const width = Math.round(280 + Math.random() * 140)
    let x = Math.random() * tileW
    let y = Math.random() * tileH
    let attempts = 0

    do {
      x = Math.random() * tileW
      y = Math.random() * tileH
      attempts++
    } while (
      attempts < 20 &&
      positions.some((p) => Math.hypot(p.x - x, p.y - y) < minSeparation)
    )

    positions.push({ x, y })
    layouts.push({
      id: image.id,
      x,
      y,
      rotation: (Math.random() - 0.5) * 16,
      width,
    })
  }

  return { layouts, tileW, tileH }
}
```

**In `ExplorativeGallery`:**
```tsx
const { layouts, tileW, tileH } = useMemo(() => generateLayout(images), [images])
```

All subsequent uses of `TILE_W` and `TILE_H` in the component become `tileW` and `tileH`. Specifically:

1. `wrappedX = ((renderOffset.x % tileW) + tileW) % tileW`
2. `wrappedY = ((renderOffset.y % tileH) + tileH) % tileH`
3. `cullWrappedX = ((cullOffset.x % tileW) + tileW) % tileW`
4. `cullWrappedY = ((cullOffset.y % tileH) + tileH) % tileH`
5. In `visibleLayouts`: `bufferX = tileW * 0.5`, `bufferY = tileH * 0.5`
6. In `visibleLayouts` toroidal distance: `TILE_W - Math.abs(...)` becomes `tileW - Math.abs(...)`
7. Tile offset divs: `left: tx * tileW`, `top: ty * tileH`, `width: tileW`, `height: tileH`

**Edge case — very small image counts (n = 1 or n = 2):**
`Math.max(n, 1)` prevents a `sqrt(0)` = 0 tile. At `n = 1`, `scale = sqrt(1/200) ≈ 0.07`, giving `tileW ≈ 354px`. That is fine — a 354×283px tile with one image is coherent. The 3×3 tile grid still tiles infinitely.

**Edge case — n > BASE_COUNT:**
If the gallery grows beyond 200 images, scale > 1 and the tile expands. This is correct behaviour — density stays constant. The `BASE_COUNT = 200` can be updated later as the collection grows.

---

## 10. Explorative: hover effect + click detection

**File:** `src/components/gallery/ExplorativeGallery.tsx`
**File:** `src/app/globals.css`

### 10a. Remove the fullscreen icon button

Delete the `<button>` with `IconFullscreen` from `ExplorativeImage`. Remove the `IconFullscreen` import.

Remove the `onFullscreen` prop from `ExplorativeImageProps`. Add `onClick` instead:

```tsx
interface ExplorativeImageProps {
  layout: ImageLayout
  image: GalleryImage
  onClick: () => void
}
```

### 10b. Drag detection: distinguishing tap from drag

`@use-gesture/react` does not have a built-in `useTap` hook, but `useDrag` exposes the raw gesture state including `tap` — a boolean that is `true` when the gesture was a tap (distance below threshold, duration below threshold). The `tap` option must be enabled explicitly.

**The pattern:**

```tsx
const bind = useDrag(
  (state) => {
    const { offset: [ox, oy], velocity: [vx, vy], last, direction: [dx, dy], tap } = state

    if (tap) {
      // This is a click, not a drag — do nothing in the drag handler.
      // The click is handled by the onClick on the image div.
      return
    }

    // Cancel any running inertia
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    offsetRef.current = { x: ox, y: oy }
    setRenderOffset({ x: ox, y: oy })
    maybeUpdateCull(ox, oy)

    if (last) {
      velocityRef.current = {
        x: vx * dx * 15,
        y: vy * dy * 15,
      }
      startInertia()
    }
  },
  {
    from: () => [offsetRef.current.x, offsetRef.current.y],
    filterTaps: true,   // When true, taps do not count as drags
    tapsThreshold: 5,   // Distance in px below which a gesture is a tap (default 3)
  }
)
```

**`filterTaps: true`** is the key option. With this enabled:
- Gestures that travel less than `tapsThreshold` pixels (default 3px, set to 5px for safety) are classified as taps.
- Taps do NOT update the drag offset.
- The `tap` property in the state is `true` for these gestures.

With `filterTaps: true`, a click (`pointerdown` + `pointerup` without movement) will fire through to the native `onClick` handler on the element. Without `filterTaps`, the gesture handler consumes the event and `onClick` never fires.

**Important:** The `onClick` on image divs requires that `pointer-events` be enabled on them. Currently, `globals.css` has:

```css
.explorative-image img {
  pointer-events: none;
}
```

This disables pointer events on the `<img>` element inside `.explorative-image` — which is correct (prevents image drag). The `.explorative-image` div wrapper itself has no `pointer-events` override, so it defaults to `auto`. The `onClick` on the wrapper div will fire.

### 10c. isDragging ref to suppress false clicks

Even with `filterTaps: true`, there can be edge cases on some touch devices where a drag ending fires a synthetic click. Add an `isDragging` ref:

```tsx
const isDraggingRef = useRef(false)

const bind = useDrag(
  (state) => {
    const { offset: [ox, oy], velocity: [vx, vy], last, direction: [dx, dy], tap, movement: [mx, my] } = state

    if (tap) return

    // Mark as dragging once we exceed tap threshold
    if (!tap) isDraggingRef.current = true

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    offsetRef.current = { x: ox, y: oy }
    setRenderOffset({ x: ox, y: oy })
    maybeUpdateCull(ox, oy)

    if (last) {
      isDraggingRef.current = false
      velocityRef.current = {
        x: vx * dx * 15,
        y: vy * dy * 15,
      }
      startInertia()
    }
  },
  {
    from: () => [offsetRef.current.x, offsetRef.current.y],
    filterTaps: true,
    tapsThreshold: 5,
  }
)
```

In `ExplorativeImage`, the `onClick` handler receives `isDraggingRef` via the `handleImageClick` callback:

```tsx
// In ExplorativeGallery (parent):
const handleImageClick = useCallback(
  (id: string) => {
    if (isDraggingRef.current) return
    const index = images.findIndex((img) => img.id === id)
    if (index !== -1) onImageClick(index)
  },
  [images, onImageClick]
)
```

Pass this as `onClick` to `ExplorativeImage`:

```tsx
<ExplorativeImage
  key={layout.id}
  layout={layout}
  image={image}
  onClick={() => handleImageClick(layout.id)}
/>
```

In `ExplorativeImage`:
```tsx
const ExplorativeImage = memo(function ExplorativeImage({
  layout,
  image,
  onClick,
}: ExplorativeImageProps) {
  return (
    <div
      className="explorative-image group"
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.width,
        transform: `rotate(${layout.rotation}deg)`,
        transformOrigin: "center center",
        cursor: "pointer",
        zIndex: 1,
      }}
      onClick={onClick}
    >
      <LoadableImage
        id={image.id}
        size={500}
        alt={`${image.tag} piece`}
        className="w-full"
        overrideSrc={image.previewSrc}
        width={image.width}
        height={image.height}
      />
    </div>
  )
})
```

### 10d. Hover effect: rotate to 0° and bring to front

On hover, the image container should:
1. Animate its rotation to `0deg` (using CSS transition)
2. Rise to a higher z-index so it appears above sibling images

This is done with CSS only — no JavaScript state needed. The trick is to set the rotation via a CSS custom property that hover can override:

**In `globals.css`:**
```css
.explorative-image {
  transition: transform 0.25s ease, z-index 0s;
  z-index: 1;
}

@media (hover: hover) {
  .explorative-image:hover {
    transform: rotate(0deg) !important;
    z-index: 10;
  }
}
```

The `!important` on `transform` is needed because the inline `style` on the div sets `transform: rotate(Xdeg)` — inline styles take precedence over class selectors in normal CSS. `!important` on the class rule overrides the inline style on hover.

**Alternative without `!important`:** Use a CSS custom property for the rotation:

In `ExplorativeImage`, set the rotation via a CSS variable on the element's inline style instead of directly in `transform`:

```tsx
<div
  className="explorative-image group"
  style={{
    position: "absolute",
    left: layout.x,
    top: layout.y,
    width: layout.width,
    "--rotation": `${layout.rotation}deg`,
    transformOrigin: "center center",
    cursor: "pointer",
  } as React.CSSProperties}
  onClick={onClick}
>
```

Then in `globals.css`:
```css
.explorative-image {
  transform: rotate(var(--rotation, 0deg));
  transition: transform 0.25s ease;
  z-index: 1;
}

@media (hover: hover) {
  .explorative-image:hover {
    transform: rotate(0deg);
    z-index: 10;
  }
}
```

This is the **preferred approach** — CSS custom property avoids `!important` and keeps the rotation in CSS where transitions work naturally.

**Touch devices:** The `@media (hover: hover)` guard ensures the hover effect only applies on pointer-capable devices. On touch, images remain at their original rotation and z-index.

**z-index and stacking context:** The `.explorative-image` divs are children of the absolute-positioned tile divs. `z-index: 10` on hover will elevate the hovered image above its siblings within the same stacking context (the tile div). Since all tiles are children of the same inner container div, this works correctly across tile boundaries.

### 10e. Cursor update

The canvas background has `cursor: grab` / `cursor: grabbing`. Individual image divs should show `cursor: pointer`. Add `cursor: pointer` to `.explorative-image` in globals.css (or as an inline style as shown above).

### 10f. Full revised ExplorativeImage component

```tsx
const ExplorativeImage = memo(function ExplorativeImage({
  layout,
  image,
  onClick,
}: ExplorativeImageProps) {
  return (
    <div
      className="explorative-image"
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.width,
        "--rotation": `${layout.rotation}deg`,
        transformOrigin: "center center",
        cursor: "pointer",
      } as React.CSSProperties}
      onClick={onClick}
    >
      <LoadableImage
        id={image.id}
        size={500}
        alt={`${image.tag} piece`}
        className="w-full"
        overrideSrc={image.previewSrc}
        width={image.width}
        height={image.height}
      />
    </div>
  )
})
```

---

## 11. Intrinsic image dimensions: type update

**File:** `src/types/index.ts`

**Current `GalleryImage`:**
```typescript
export interface GalleryImage {
  id: string
  filename: string
  date: string
  sortOrder: number
  tag: Tag
  previewSrc?: string
}
```

**New:**
```typescript
export interface GalleryImage {
  id: string
  filename: string
  date: string
  sortOrder: number
  tag: Tag
  /** Intrinsic width in pixels (of the 2400px output, or original if smaller). */
  width: number
  /** Intrinsic height in pixels (of the 2400px output, or original if smaller). */
  height: number
  /** Temporary blob URL for optimistic display before the Netlify rebuild completes. Never persisted. */
  previewSrc?: string
}
```

**Migration note:** Existing entries in `images.json` do not have `width`/`height`. After adding the fields to the type, TypeScript will require them. Three migration paths:

1. **Run `npm run process-images` immediately** — regenerates `images.json` with dimensions. All existing images get their correct intrinsic dimensions. This is the correct path since all source files exist in `image-sources/`.

2. **Make the fields optional temporarily** (`width?: number`) — allows the app to compile before `process-images` is run. Components receive `width | undefined` and fall back to no aspect-ratio. This is a safe intermediate state.

3. **Provide a fallback in `LoadableImage`** — if `width` or `height` is `undefined` or `0`, skip the `aspect-ratio` style.

**Recommended:** Use approach 2 temporarily, then run `process-images` and switch to required fields. The type during transition:

```typescript
export interface GalleryImage {
  id: string
  filename: string
  date: string
  sortOrder: number
  tag: Tag
  width?: number   // optional until images.json is regenerated
  height?: number  // optional until images.json is regenerated
  previewSrc?: string
}
```

After regeneration, remove the `?` to make them required.

---

## 12. Intrinsic image dimensions: process-images.ts

**File:** `scripts/process-images.ts`

### 12a. Update `ImageEntry` interface

```typescript
interface ImageEntry {
  id: string
  filename: string
  date: string
  sortOrder: number
  tag: "bone" | "supi"
  width: number
  height: number
}
```

### 12b. Capture dimensions during processing

After compressing all three sizes, capture the dimensions of the 2400px output (which is the largest, and represents the true intrinsic ratio). If the original image is smaller than 2400px, `withoutEnlargement: true` keeps it at its original size, so we capture the actual output dimensions.

Use `sharp.metadata()` on the original to get dimensions first (cheapest), then the output dimensions of the 2400px variant to be exact:

```typescript
// Inside the per-image processing loop, after the SIZES loop:

// Capture dimensions from the largest output (2400px or original if smaller)
const output2400Path = path.join(OUTPUT_IMAGES, `${id}.2400.webp`)
const meta = await sharp(output2400Path).metadata()
const width = meta.width ?? 0
const height = meta.height ?? 0

entries.push({
  id,
  filename: `${id}.webp`,
  date: PLACEHOLDER_DATE,
  sortOrder: i,
  tag: file.tag,
  width,
  height,
})
```

**Note on already-processed images:** The loop currently skips Sharp processing if the output file already exists (`if (fs.existsSync(outputPath)) { continue }`). Dimension capture using `sharp(output2400Path).metadata()` reads the already-written file, so it works correctly even for skipped images. No change to the skip logic is needed.

**Full revised processing loop section:**
```typescript
for (let i = 0; i < allFiles.length; i++) {
  const file = allFiles[i]
  const id = `${file.prefix}-${file.numericStr}`

  console.log(`[${i + 1}/${allFiles.length}] Processing ${id}...`)

  try {
    for (const size of SIZES) {
      const outputPath = path.join(OUTPUT_IMAGES, `${id}.${size}.webp`)

      if (fs.existsSync(outputPath)) {
        console.log(`  ${size}px — skipped (already exists)`)
        continue
      }

      await sharp(file.absolutePath)
        .resize(size, undefined, { withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(outputPath)

      console.log(`  ${size}px — done`)
    }

    // Capture intrinsic dimensions from the 2400px output
    // (reads the file whether it was just created or previously skipped)
    const output2400Path = path.join(OUTPUT_IMAGES, `${id}.2400.webp`)
    const meta = await sharp(output2400Path).metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0

    entries.push({
      id,
      filename: `${id}.webp`,
      date: PLACEHOLDER_DATE,
      sortOrder: i,
      tag: file.tag,
      width,
      height,
    })
  } catch (err) {
    console.warn(`  ERROR processing ${id}: ${err}`)
  }
}
```

---

## 13. Intrinsic image dimensions: upload-image.ts

**File:** `netlify/functions/upload-image.ts`

The upload function creates the new `GalleryImage` entry before committing. It must now also capture `width` and `height` from the Sharp-processed 2400px buffer.

### 13a. Capture metadata after compression

The `compressedBuffers` array is built with `Promise.all` over SIZES. After this, capture the metadata from the 2400px buffer (index 2):

```typescript
// After compressedBuffers = await Promise.all(...)

// Capture dimensions from the 2400px output buffer
const meta2400 = await sharp(compressedBuffers[2]).metadata()
const intrinsicWidth = meta2400.width ?? 0
const intrinsicHeight = meta2400.height ?? 0
```

### 13b. Include dimensions in the new entry

```typescript
const newEntry: GalleryImage = {
  id,
  filename: `${id}.webp`,
  date,
  sortOrder: parsedSortOrder,
  tag: tag as "bone" | "supi",
  width: intrinsicWidth,
  height: intrinsicHeight,
}
```

### 13c. Include dimensions in the optimistic response

The function returns `{ success: true, image: newEntry }`. Since `newEntry` now includes `width` and `height`, the client-side optimistic update in `NewPieceSheet` already gets correct dimensions for the admin preview display. No further changes to the admin sheet are needed for this.

### 13d. Full revised image processing section in upload-image.ts

```typescript
let compressedBuffers: Buffer[]
try {
  compressedBuffers = await Promise.all(
    SIZES.map((width) =>
      sharp(imageBuffer)
        .resize(width, undefined, { withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
    )
  )
} catch (err) {
  console.error("Sharp processing error:", err)
  return {
    statusCode: 422,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Image processing failed — ensure file is a valid image" }),
  }
}

// Capture intrinsic dimensions from the 2400px output buffer (index 2 = 2400px)
const meta2400 = await sharp(compressedBuffers[2]).metadata()
const intrinsicWidth = meta2400.width ?? 0
const intrinsicHeight = meta2400.height ?? 0
```

---

## 14. Intrinsic image dimensions: LoadableImage aspect-ratio

**File:** `src/components/ui/LoadableImage.tsx`

### 14a. Update props interface

Remove the existing `aspectRatio?: number` prop (which accepted a decimal ratio). Replace with `width` and `height`:

```typescript
interface LoadableImageProps {
  id: string
  size: ImageSize
  alt: string
  /** Intrinsic image width from GalleryImage. Used to set aspect-ratio before load. */
  width?: number
  /** Intrinsic image height from GalleryImage. Used to set aspect-ratio before load. */
  height?: number
  className?: string
  onClick?: () => void
  overrideSrc?: string
}
```

The old `aspectRatio?: number` prop is removed — callers were computing the ratio externally. Using `width` and `height` directly is cleaner and matches what `GalleryImage` now provides.

### 14b. Compute aspect-ratio in the style

```typescript
const aspectRatioStyle =
  width && height && width > 0 && height > 0
    ? { aspectRatio: `${width}/${height}` }
    : undefined
```

This uses the browser-native `aspect-ratio: W/H` syntax, which modern browsers parse correctly and does not require pre-dividing to a decimal.

### 14c. Full revised component

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { getImageSrc, type ImageSize } from "@/lib/images"
import { cn } from "@/lib/utils"

interface LoadableImageProps {
  id: string
  size: ImageSize
  alt: string
  /** Intrinsic width in pixels — sets aspect-ratio on the container before the image loads. */
  width?: number
  /** Intrinsic height in pixels — sets aspect-ratio on the container before the image loads. */
  height?: number
  className?: string
  onClick?: () => void
  overrideSrc?: string
}

/**
 * Lazily-loaded image component using IntersectionObserver.
 * Fades in when loaded. Shows a muted placeholder while loading.
 * Loads the image 200px before it enters the viewport.
 *
 * If intrinsic `width` and `height` are provided, the container holds its
 * aspect-ratio before the image loads, preventing layout shift (CLS).
 */
export function LoadableImage({
  id,
  size,
  alt,
  width,
  height,
  className,
  onClick,
  overrideSrc,
}: LoadableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const aspectRatioStyle =
    width && height && width > 0 && height > 0
      ? { aspectRatio: `${width}/${height}` }
      : undefined

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={cn("relative overflow-hidden", onClick && "cursor-pointer", className)}
      style={aspectRatioStyle}
    >
      {/* Placeholder background — sits below the image */}
      <div className="bg-muted/20 absolute inset-0 z-0" />

      {isVisible && !hasError && (
        <img
          src={overrideSrc ?? getImageSrc(id, size)}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
        />
      )}
    </div>
  )
}
```

**Edge cases:**
- `width` or `height` is `0` or `undefined`: `aspectRatioStyle` is `undefined`, no `style` attribute is set, and the container height is determined by the image's natural size after load. No layout shift protection in this case, but no crash.
- The container collapses to zero height before load when `aspectRatioStyle` is `undefined` and the `<img>` is `absolute inset-0`. This is only a concern in Classic mode where images are displayed large. For Classic, the width is constrained by `max-w-[1200px]` and the container collapses vertically until the image loads. With intrinsic dimensions from `images.json`, this never happens in production. During the transition period (before `process-images` is run), images briefly show no height until loaded.

---

## 15. Intrinsic image dimensions: CarouselOverlay

**File:** `src/components/gallery/CarouselOverlay.tsx`

**Current:**
```tsx
const slides = useMemo(
  () =>
    images.map((img) => ({
      src: img.previewSrc ?? getImageSrc(img.id, 2400),
      width: 2400,
      height: 1600, // 3:2 aspect ratio placeholder; actual dimensions are derived by YARL
    })),
  [images]
)
```

**New:** Use actual `width` and `height` from the `GalleryImage`. The YARL slide `width` and `height` inform YARL's layout engine for optimal sizing within the lightbox. YARL uses these to compute the natural aspect ratio and fit the slide within the available space.

```tsx
const slides = useMemo(
  () =>
    images.map((img) => ({
      src: img.previewSrc ?? getImageSrc(img.id, 2400),
      width: img.width ?? 2400,
      height: img.height ?? 1600,
    })),
  [images]
)
```

The fallbacks `?? 2400` and `?? 1600` handle the transition period where some images may not yet have dimensions in `images.json`.

---

## 16. Intrinsic image dimensions: GridGallery

Already covered in Section 8e. The `LoadableImage` call in `GridGallery` passes `width={image.width}` and `height={image.height}`. Since Grid mode uses the 500px thumbnail, the aspect ratio is the same as the 2400px version (Sharp preserves the original aspect ratio at all output sizes). The container will reserve the correct height before load, preventing columns from jumping as images load in.

---

## 17. Intrinsic image dimensions: ClassicGallery

Already covered in Section 7. Same pattern — pass `width={image.width}` and `height={image.height}` to `LoadableImage`.

---

## 18. Intrinsic image dimensions: ExplorativeGallery

Already covered in Section 10f. The `ExplorativeImage` passes `width={image.width}` and `height={image.height}` to `LoadableImage`.

In Explorative mode, images have a fixed display `width` (280–420px random) set via `layout.width`. The container height is determined by the aspect ratio via `aspectRatioStyle`. This is especially important in Explorative mode because images are absolutely positioned — if the container height collapsed to zero before load, the images would all look like horizontal lines until loaded.

---

## 19. globals.css: masonry gap + explorative hover

**File:** `src/app/globals.css`

**Full set of changes to globals.css in this phase:**

### 19a. Masonry gap update (Section 8d)

```css
/* ─── react-masonry-css ─────────────────────────────────── */
.masonry-grid {
  display: flex;
  margin-left: -1px;  /* changed from -20px */
  width: auto;
}

.masonry-grid_column {
  padding-left: 1px;  /* changed from 20px */
  background-clip: padding-box;
}
```

### 19b. scrollbar-gutter (Section 3)

```css
@layer base {
  * {
    @apply border-border;
    box-shadow: none !important;
    border-radius: 2px;
  }

  html {
    scrollbar-gutter: stable;
  }

  body {
    @apply bg-background text-foreground font-mono antialiased;
  }
}
```

### 19c. Explorative mode CSS update (Section 10d)

```css
/* ─── Explorative mode ──────────────────────────────────── */
.explorative-canvas {
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.explorative-canvas:active {
  cursor: grabbing;
}

.explorative-image {
  transform: rotate(var(--rotation, 0deg));
  transition: transform 0.25s ease;
  z-index: 1;
  cursor: pointer;
}

@media (hover: hover) {
  .explorative-image:hover {
    transform: rotate(0deg);
    z-index: 10;
  }
}

.explorative-image img {
  pointer-events: none;
  -webkit-user-drag: none;
}
```

**Remove the old `.explorative-image img` block from its current location and consolidate into the section above.**

Note: The `transform` is no longer set inline on the div (since it uses `--rotation` CSS custom property). The inline style in `ExplorativeImage` is updated to set `--rotation` instead of `transform` directly (Section 10f).

---

## 20. Edge cases & notes

### Header height and gallery top padding

With the sticky header (Header + OptionsBar as a unit), the total sticky height varies:
- Desktop: Header (~40px) + OptionsBar (~48px) = ~88px total
- Mobile: Header (~40px) + OptionsBar (Select row ~48px + button row ~52px) = ~140px total

The gallery `pt-[15vh]` in Classic mode (Section 7) is relative to viewport height, not the header height. This means the gallery starts 15vh below the sticky bar — fine at most screen sizes. Grid mode starts immediately below the sticky bar (no top padding, `pt-0`).

### Grid mode and top spacing

Grid mode has `pt-0` (no top padding). The first row of images appears immediately below the sticky OptionsBar. This creates a dense, newspaper-like layout which is intentional for Grid mode. If spacing is desired, add `pt-3` or `pt-[1px]` to match the 1px grid gap aesthetic.

### Explorative mode z-index hierarchy

- `.explorative-canvas`: `z-index` not set explicitly (stacks in document order)
- Sticky header wrapper: `z-50` (z-index: 50)
- `.explorative-image`: `z-index: 1` (within tile stacking context)
- `.explorative-image:hover`: `z-index: 10` (within tile stacking context)

The canvas never overlaps the header because the sticky header's `z-50` is relative to the root stacking context, and the canvas is behind it in the same root stacking context. The image z-index values (1 and 10) are local to the tile div's stacking context.

### react-masonry-css and the 1px gap

The masonry library creates columns as flex children. The negative `margin-left: -1px` on the grid and `padding-left: 1px` on each column create 1px gutters between columns. The vertical gap within a column is created by `mb-px` (`margin-bottom: 1px`) on each image. This creates a perfect 1px grid in all directions.

One cosmetic concern: the leftmost column has `padding-left: 1px` pushing its content 1px in from the container edge. The container itself has no horizontal padding (`px-0`). The result is a 1px gap on the left edge of the grid. This is correct and consistent — the rightmost column has no gap on its right side (masonry columns have padding-left only). If pixel-perfect edge alignment is required, a wrapper with `overflow: hidden` and `margin-left: -1px` can clip the leftmost 1px.

### Admin preview with new dimensions

When the admin uploads a new image, `upload-image.ts` returns `{ success: true, image: newEntry }` where `newEntry` now includes `width` and `height`. The `handleImageAdded` callback in `page.tsx` receives this and adds it to the `images` state. The admin preview in Classic/Grid/Explorative mode will show the new image with correct aspect ratio immediately, before the Netlify rebuild completes.

### Backward compatibility with existing images.json

Existing entries in `images.json` lack `width`/`height`. The TypeScript type has them as optional (`width?: number`) during the transition period. All consumers (`LoadableImage`, `CarouselOverlay`, gallery components) handle `undefined` with fallbacks. After running `npm run process-images`, all entries get dimensions and the optional markers can be removed from the type.

### process-images.ts idempotency

The script is idempotent — it skips Sharp processing for already-existing output files. However, the `sharp(output2400Path).metadata()` call runs for every image regardless. For a collection of 200 images, this adds ~200 fast metadata reads. Total overhead is under 1 second. The `images.json` is always fully rewritten, ensuring dimension data is always fresh.

### Explorative click on touch

On touch devices, `@use-gesture/react` with `filterTaps: true` fires taps as native click events. The `onClick` on `.explorative-image` handles them. Touch drag still works as before — the gesture library distinguishes tap from scroll by time and distance. The `isDraggingRef` guard provides an extra safety net.

### Explorative `group` class removal

The old `ExplorativeImage` used `group` for the `group-hover:opacity-100` on the fullscreen button. With the button removed, the `group` class is no longer needed.

---

## 21. Change order & execution sequence

Execute changes in this order to maintain a compilable, functional codebase at each step:

1. **`src/types/index.ts`** — Add `width?: number` and `height?: number` (optional for now). TypeScript compiles; no runtime change yet.

2. **`scripts/process-images.ts`** — Add dimension capture. Run `npm run process-images`. This regenerates `images.json` with `width` and `height` for all existing images.

3. **`src/types/index.ts`** — Remove `?` from `width` and `height` (now required). TypeScript requires dimensions everywhere.

4. **`netlify/functions/upload-image.ts`** — Add dimension capture from Sharp buffer. Ensures future uploads include dimensions.

5. **`src/components/ui/LoadableImage.tsx`** — Replace `aspectRatio?: number` with `width?/height?`, implement `aspectRatio` style, fix z-index layering. Component is backward compatible (`width`/`height` still optional internally with guard).

6. **`src/app/globals.css`** — Update masonry gap to 1px, add `scrollbar-gutter: stable`, update explorative CSS for hover effect and CSS custom property rotation.

7. **`src/components/gallery/ExplorativeGallery.tsx`** — Tile scaling, remove fullscreen button, add click detection, add hover CSS variable, update `isDraggingRef` pattern, pass `width`/`height` to `LoadableImage`.

8. **`src/components/gallery/ClassicGallery.tsx`** — Update spacing to `15vh`, pass `width`/`height`.

9. **`src/components/gallery/GridGallery.tsx`** — Minimum 2 columns, remove max-width, update to `mb-px`, pass `width`/`height`.

10. **`src/components/gallery/CarouselOverlay.tsx`** — Use actual `width`/`height` in slides.

11. **`src/components/layout/Header.tsx`** — Remove `fixed`, remove `max-md:static`, adjust padding.

12. **`src/components/layout/OptionsBar.tsx`** — Mobile layout restructure, Select fixes, button height to 40px, sticky positioning.

13. **`src/app/page.tsx`** — Wrap Header + OptionsBar in a single `sticky top-0 z-50 bg-background flex-col` div.

14. **Run `npm run format`** after all file changes.

15. **Run `npm run build`** to verify static export compiles without errors.

---

*End of Phase 2 implementation plan.*
