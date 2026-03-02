# Phase 5: Explorative Gallery Mode

## Overview

The Explorative mode is a drag-and-pan infinite canvas where all images are randomly scattered with slight rotations, mimicking photographs spread on a table. The canvas tiles seamlessly in all directions — dragging far in any direction loops back to the same images. Uses `@use-gesture/react` for smooth drag with inertia.

---

## 5.1 Architecture

```
<ExplorativeGallery>        Full-viewport fixed canvas (overflow hidden)
  └── .explorative-inner     Absolutely positioned, receives CSS translate transform
       └── [TileGrid]        3×3 grid of tile copies
            └── [Images]     Absolutely positioned images within each tile
```

**Key concept**: Instead of virtualizing or repeating images via JavaScript, we render a 3×3 grid of identical tile copies. The inner container is translated by `(offset % TILE_SIZE)`. As the user drags, the modulo wrap keeps the offset within one tile width/height — and the 3×3 grid ensures images are always visible in the surrounding tiles regardless of position.

---

## 5.2 Layout Generation

Called once on component mount. Generates a random layout per session.

```typescript
interface ImageLayout {
  id: string
  x: number        // position within the tile (px)
  y: number        // position within the tile (px)
  rotation: number // degrees, ±8°
  width: number    // display width in px (280–420)
}

const TILE_W = 5000  // virtual tile width in px
const TILE_H = 4000  // virtual tile height in px
const MIN_SEPARATION = 250  // minimum center-to-center distance

function generateLayout(images: GalleryImage[]): ImageLayout[] {
  const layouts: ImageLayout[] = []
  const positions: Array<{ x: number; y: number }> = []

  for (const image of images) {
    const width = Math.round(280 + Math.random() * 140) // 280–420px
    let x: number, y: number
    let attempts = 0

    // Rejection sampling: avoid placing images too close to existing ones
    do {
      x = Math.random() * TILE_W
      y = Math.random() * TILE_H
      attempts++
    } while (
      attempts < 20 &&
      positions.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_SEPARATION)
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

**Notes**:
- `MIN_SEPARATION = 250` prevents full overlap but allows edge overlap (images of width 300+ will naturally have edges touching)
- After 20 attempts, placement proceeds anyway to avoid infinite loops with many images
- `width` varies slightly for a more natural spread feel
- Heights are determined by the image's natural aspect ratio (not fixed upfront)

---

## 5.3 Drag and Inertia

```typescript
import { useDrag } from "@use-gesture/react"
import { useRef, useState, useCallback, useEffect } from "react"

// Persistent offset (does not wrap — wrapping happens at render time)
const offsetRef = useRef({ x: 0, y: 0 })
const [renderOffset, setRenderOffset] = useState({ x: 0, y: 0 })
const rafRef = useRef<number | null>(null)
const velocityRef = useRef({ x: 0, y: 0 })

const bind = useDrag(
  ({ offset: [ox, oy], velocity: [vx, vy], last, direction: [dx, dy] }) => {
    // Cancel any running inertia
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    offsetRef.current = { x: ox, y: oy }
    setRenderOffset({ x: ox, y: oy })

    if (last) {
      // Start inertia with release velocity (px/frame at 60fps)
      velocityRef.current = {
        x: vx * dx * 15,  // scale velocity to feel natural
        y: vy * dy * 15,
      }
      startInertia()
    }
  },
  {
    from: () => [offsetRef.current.x, offsetRef.current.y],
  }
)

function startInertia() {
  const step = () => {
    const vel = velocityRef.current
    if (Math.abs(vel.x) < 0.5 && Math.abs(vel.y) < 0.5) {
      rafRef.current = null
      return
    }

    // Decay velocity
    velocityRef.current = { x: vel.x * 0.95, y: vel.y * 0.95 }

    offsetRef.current = {
      x: offsetRef.current.x + velocityRef.current.x,
      y: offsetRef.current.y + velocityRef.current.y,
    }
    setRenderOffset({ ...offsetRef.current })

    rafRef.current = requestAnimationFrame(step)
  }
  rafRef.current = requestAnimationFrame(step)
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }
}, [])
```

**Velocity scaling**: `@use-gesture/react` returns `velocity` as px/ms. Multiplied by ~15 to convert to a comfortable px/frame momentum at 60fps. Tune this value during development for feel.

---

## 5.4 Seamless Tiling Render

The inner container is translated by the modulo of the current offset. A 3×3 grid of tile copies ensures the viewport always shows content regardless of position.

```typescript
// Wrap offset into one tile
const wrappedX = ((renderOffset.x % TILE_W) + TILE_W) % TILE_W
const wrappedY = ((renderOffset.y % TILE_H) + TILE_H) % TILE_H

// 3×3 tile offsets
const TILE_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0], [0,  0], [1,  0],
  [-1,  1], [0,  1], [1,  1],
]
```

Render:

```tsx
<div
  className="explorative-inner"
  style={{ transform: `translate(${wrappedX}px, ${wrappedY}px)` }}
  {...bind()}
>
  {TILE_OFFSETS.map(([tx, ty]) => (
    <div
      key={`${tx}-${ty}`}
      style={{
        position: "absolute",
        left: tx * TILE_W,
        top: ty * TILE_H,
        width: TILE_W,
        height: TILE_H,
      }}
    >
      {visibleLayouts.map((layout) => (
        <ExplorativeImage
          key={layout.id}
          layout={layout}
          image={imageMap[layout.id]}
          onFullscreen={() => handleFullscreen(layout.id)}
        />
      ))}
    </div>
  ))}
</div>
```

**`visibleLayouts` optimization**: For 200–500 images × 9 tiles = 1800–4500 potential DOM nodes. To reduce this:

```typescript
// Calculate which images are visible within the current viewport + 1 tile buffer
const visibleLayouts = useMemo(() => {
  const viewW = window.innerWidth
  const viewH = window.innerHeight
  const bufferX = TILE_W * 0.5  // half a tile buffer in each direction
  const bufferY = TILE_H * 0.5

  // In tile-space coordinates (0 to TILE_W/H):
  // The viewport shows: wrappedX ± viewW/2 (approximately)
  // Since we render 3×3 tiles, we can filter at tile level instead

  // Simple approach: always render all images within each tile
  // 200 images × 9 tiles = 1800 nodes — acceptable
  // 500 images × 9 tiles = 4500 nodes — may need optimization

  // If images > 300, filter by proximity to current viewport center:
  if (layouts.length <= 300) return layouts

  const centerX = ((-wrappedX % TILE_W) + TILE_W) % TILE_W
  const centerY = ((-wrappedY % TILE_H) + TILE_H) % TILE_H

  return layouts.filter((l) => {
    const dx = Math.min(Math.abs(l.x - centerX), TILE_W - Math.abs(l.x - centerX))
    const dy = Math.min(Math.abs(l.y - centerY), TILE_H - Math.abs(l.y - centerY))
    return dx < viewW + bufferX && dy < viewH + bufferY
  })
}, [layouts, wrappedX, wrappedY])
```

---

## 5.5 Individual Image Component

```typescript
interface ExplorativeImageProps {
  layout: ImageLayout
  image: GalleryImage
  onFullscreen: () => void
}

function ExplorativeImage({ layout, image, onFullscreen }: ExplorativeImageProps) {
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
      }}
    >
      {/* The image */}
      <LoadableImage
        id={image.id}
        size={500}
        alt={`${image.tag} piece`}
        className="w-full"
      />

      {/* Fullscreen button — visible on hover */}
      <button
        className="
          absolute top-2 right-2 z-10
          h-8 w-8 flex items-center justify-center
          bg-background/80 border border-border rounded-[2px]
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
        "
        onClick={(e) => {
          e.stopPropagation()
          onFullscreen()
        }}
        aria-label="View fullscreen"
      >
        <IconFullscreen />
      </button>
    </div>
  )
}
```

**Touch behavior**: On touch screens, there's no hover state. Instead, the first tap on an image should open the fullscreen button (or directly open the carousel). Implement by detecting touch events:

```typescript
// Add touch-first behavior
const [isTouching, setIsTouching] = useState(false)

// On mobile: single tap opens carousel directly (no hover state needed)
// Detect mobile via pointer type
const isMobileRef = useRef(false)
useEffect(() => {
  isMobileRef.current = window.matchMedia("(pointer: coarse)").matches
}, [])
```

On touch devices, clicking an image directly opens the carousel (same as Classic/Grid).

---

## 5.6 Full Component Structure

```typescript
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useDrag } from "@use-gesture/react"
import { ExplorativeImage } from "./ExplorativeImage"
import type { GalleryImage } from "@/types"
import type { ImageLayout } from "./types"

interface ExplorativeGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

export default function ExplorativeGallery({ images, onImageClick }: ExplorativeGalleryProps) {
  // Generate layout once on mount, random per session
  const layouts = useMemo(() => generateLayout(images), [images])

  // Image lookup map for O(1) access
  const imageMap = useMemo(
    () => Object.fromEntries(images.map((img) => [img.id, img])),
    [images]
  )

  // Drag state
  const offsetRef = useRef({ x: 0, y: 0 })
  const [renderOffset, setRenderOffset] = useState({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const velocityRef = useRef({ x: 0, y: 0 })

  // ... drag and inertia logic (see section 5.3)

  // Computed wrapped offset for tiling
  const wrappedX = ((renderOffset.x % TILE_W) + TILE_W) % TILE_W
  const wrappedY = ((renderOffset.y % TILE_H) + TILE_H) % TILE_H

  // Visible layout subset (performance optimization for 300+ images)
  const visibleLayouts = useMemo(
    () => computeVisibleLayouts(layouts, wrappedX, wrappedY),
    [layouts, wrappedX, wrappedY]
  )

  return (
    <div
      className="explorative-canvas"
      style={{ position: "fixed", inset: 0, overflow: "hidden", touchAction: "none", cursor: "grab" }}
    >
      <div
        className="explorative-inner"
        style={{
          position: "absolute",
          transform: `translate(${wrappedX}px, ${wrappedY}px)`,
          willChange: "transform",
        }}
        {...bind()}
      >
        {TILE_OFFSETS.map(([tx, ty]) => (
          <div
            key={`${tx}-${ty}`}
            style={{ position: "absolute", left: tx * TILE_W, top: ty * TILE_H }}
          >
            {visibleLayouts.map((layout) => (
              <ExplorativeImage
                key={layout.id}
                layout={layout}
                image={imageMap[layout.id]}
                onFullscreen={() => {
                  const index = images.findIndex((img) => img.id === layout.id)
                  if (index !== -1) onImageClick(index)
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 5.7 CSS

Add to `src/app/globals.css`:

```css
.explorative-canvas {
  user-select: none;
  -webkit-user-select: none;
}

.explorative-canvas:active {
  cursor: grabbing;
}

.explorative-image img {
  pointer-events: none; /* Prevent native drag-ghost on images */
  -webkit-user-drag: none;
}
```

---

## 5.8 Performance Summary

| Factor | Impact | Mitigation |
|---|---|---|
| 200 images × 9 tiles | 1800 DOM nodes | All lightweight until loaded; IntersectionObserver delays image load |
| 500 images × 9 tiles | 4500 DOM nodes | Viewport culling reduces to ~400–800 visible nodes |
| CSS transform animation | Paint during drag | `will-change: transform` on inner container promotes to GPU layer |
| Inertia RAF loop | CPU during coast | Stops at velocity < 0.5px/frame; short duration |
| Layout generation | Once per session | `useMemo` with `[images]` dependency |

---

## 5.9 Memory Cleanup

```typescript
useEffect(() => {
  return () => {
    // Cancel inertia RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    // @use-gesture/react cleans up its own event listeners
    // when the component unmounts and bind() is no longer attached
  }
}, [])
```
