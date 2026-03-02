# Phase 4: Classic & Grid Gallery Modes

## 4.1 ClassicGallery

**File**: `src/components/gallery/ClassicGallery.tsx`

The simplest mode: images stacked vertically, newest first, max-width 1200px centered.

```typescript
"use client"

import { LoadableImage } from "@/components/ui/LoadableImage"
import type { GalleryImage } from "@/types"

interface ClassicGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

export default function ClassicGallery({ images, onImageClick }: ClassicGalleryProps) {
  return (
    <main className="mx-auto max-w-[1200px] px-5 py-20 md:py-16 flex flex-col gap-5">
      {images.map((image, index) => (
        <LoadableImage
          key={image.id}
          id={image.id}
          size={1280}
          alt={`${image.tag} piece`}
          onClick={() => onImageClick(index)}
          className="w-full"
        />
      ))}
    </main>
  )
}
```

**Notes**:
- `py-20` on mobile / `py-16` on desktop: top padding leaves room for the fixed header + options bar (which are in-flow on mobile, so padding adjusts accordingly)
- Images use `size={1280}` — the medium WebP. Good balance of quality and file size for full-width display
- No fixed aspect ratio (`aspectRatio` prop omitted): the image container reflows as each image loads, which is acceptable in the classic linear layout
- `gap-5` = 20px gutter between images
- Click opens the YARL carousel at the clicked index

---

## 4.2 GridGallery

**File**: `src/components/gallery/GridGallery.tsx`

A masonry grid with dynamically calculated column count targeting ~500px column width.

```typescript
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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

  // Recalculate columns on mount and resize
  useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      // Target ~500px per column, minimum 1 column
      const cols = Math.max(1, Math.round(containerWidth / 500))
      setColumnCount(cols)
    }

    updateColumns()

    const observer = new ResizeObserver(updateColumns)
    if (containerRef.current) observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  // On mobile: always 1 column
  // Note: ResizeObserver handles this naturally since containerWidth will be small
  // But we also enforce it via CSS for SSR

  return (
    <div
      ref={containerRef}
      className="mx-auto max-w-[2000px] px-5 py-20 md:py-16"
    >
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
            className="mb-5 w-full"
          />
        ))}
      </Masonry>
    </div>
  )
}
```

**Masonry CSS** (add to `src/app/globals.css`):

```css
/* react-masonry-css */
.masonry-grid {
  display: flex;
  margin-left: -20px;
  width: auto;
}

.masonry-grid_column {
  padding-left: 20px;
  background-clip: padding-box;
}

/* Gutter between items is handled by mb-5 (20px) on each LoadableImage */
```

**Column calculation**:
- `containerWidth / 500` gives target column count
- `Math.round` instead of `Math.floor` means a 750px container gets 2 columns (each ~375px) rather than 1
- `Math.max(1, ...)` ensures minimum 1 column
- `ResizeObserver` handles both initial measurement and window resize
- On mobile (narrow viewport): naturally resolves to 1 column

**Image sizes**:
- Uses `size={500}` thumbnails — appropriate for grid cells of ~300–500px width
- With `object-cover` (from LoadableImage), images fill their masonry cell

**Performance with 200–500 images**:
- React renders all 200–500 `<LoadableImage>` components at once
- Each LoadableImage's IntersectionObserver ensures images only actually load when near-visible
- DOM nodes: ~200–500 divs, each lightweight until image loads
- This is acceptable for masonry layout; virtualization would break the masonry flow

---

## 4.3 Fade Transitions Between Modes

Implemented in `page.tsx` using Framer Motion `AnimatePresence`.

```typescript
import { AnimatePresence, motion } from "framer-motion"

// key changes when mode OR filter changes, triggering the animation
<AnimatePresence mode="wait">
  <motion.div
    key={`${mode}-${filter}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25 }}
    className="w-full"
  >
    {renderGallery()}
  </motion.div>
</AnimatePresence>
```

`mode="wait"` ensures the exit animation completes before the enter animation starts, preventing two galleries rendering simultaneously (which would be jarring for heavy modes like Experimental).

**Important**: `duration: 0.25` (250ms) is fast enough to feel responsive but visible enough to be smooth.

---

## 4.4 Top Padding for Fixed Header/OptionsBar

On desktop, the header and options bar are `position: fixed`, so the gallery content needs top padding to not be hidden behind them.

- Header height: approximately 40px (two `text-xs` lines + padding)
- OptionsBar height: approximately 40px
- They're on opposite sides (header left, options bar right), so the content only needs to clear the header

Recommended:
```
py-16  (64px top padding) on desktop — clears the fixed header
py-20  (80px top padding) on mobile  — in-flow elements take space, extra padding for breathing room
```

Adjust these values during implementation based on actual rendered heights.

---

## 4.5 Gallery Props Contract

Both Classic and Grid modes accept the same props interface:

```typescript
interface GalleryProps {
  images: GalleryImage[]        // already filtered and sorted (newest first)
  onImageClick: (index: number) => void  // index in the images array
}
```

The `index` passed to `onImageClick` is the position within the current `filteredImages` array. The carousel uses this same array, so indices align correctly.
