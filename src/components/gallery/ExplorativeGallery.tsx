"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDrag } from "@use-gesture/react"
import { LoadableImage } from "@/components/ui/LoadableImage"
import { IconFullscreen } from "@/components/ui/icons"
import type { GalleryImage } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Virtual tile dimensions in pixels. The full infinite canvas tiles these. */
const TILE_W = 5000
const TILE_H = 4000

/**
 * Minimum center-to-center distance between any two image positions within
 * a tile, to avoid heavy overlapping on initial layout generation.
 */
const MIN_SEPARATION = 250

/**
 * 3×3 grid of tile offsets (in tile-units) surrounding the origin tile.
 * Rendering all nine copies ensures the user never sees a seam regardless
 * of how far they scroll.
 */
const TILE_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageLayout {
  id: string
  /** X position within the virtual tile (px). */
  x: number
  /** Y position within the virtual tile (px). */
  y: number
  /** Rotation in degrees, ±8°. */
  rotation: number
  /** Display width, 280–420px. */
  width: number
}

interface ExplorativeGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

interface ExplorativeImageProps {
  layout: ImageLayout
  image: GalleryImage
  onFullscreen: (id: string) => void
}

// ---------------------------------------------------------------------------
// Layout generation
// ---------------------------------------------------------------------------

/**
 * Generates a random, non-overlapping layout for all images within one tile.
 * Positions are regenerated fresh each time the images prop reference changes
 * (mode switch), giving a new arrangement on every visit.
 *
 * Up to 20 placement attempts are made per image to avoid MIN_SEPARATION
 * violations; if exhausted, the last candidate is used to guarantee all
 * images are placed (sparse layouts with many images would otherwise stall).
 *
 * @param images - The filtered, sorted gallery images to lay out.
 * @returns An array of ImageLayout objects, one per image.
 */
function generateLayout(images: GalleryImage[]): ImageLayout[] {
  const layouts: ImageLayout[] = []
  const positions: Array<{ x: number; y: number }> = []

  for (const image of images) {
    const width = Math.round(280 + Math.random() * 140) // 280–420 px
    let x: number = Math.random() * TILE_W
    let y: number = Math.random() * TILE_H
    let attempts = 0

    do {
      x = Math.random() * TILE_W
      y = Math.random() * TILE_H
      attempts++
    } while (attempts < 20 && positions.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_SEPARATION))

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

// ---------------------------------------------------------------------------
// Individual image tile
// ---------------------------------------------------------------------------

/**
 * Renders a single image within the explorative canvas.
 *
 * On desktop (hover-capable devices) the fullscreen button fades in on hover.
 * On touch devices (pointer: coarse) the button is always visible since there
 * is no hover state — matching native mobile UX expectations.
 *
 * The image itself has pointer-events disabled (via the `.explorative-image`
 * CSS class in globals.css) so that drag events propagate to the canvas
 * container without interruption.
 */
const ExplorativeImage = memo(function ExplorativeImage({
  layout,
  image,
  onFullscreen,
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
      }}
    >
      <LoadableImage id={image.id} size={500} alt={`${image.tag} piece`} className="w-full" />

      {/* Fullscreen trigger — fades in on hover (desktop); always visible on touch */}
      <button
        className="border-border bg-background/80 absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-[2px] border opacity-0 transition-opacity duration-200 has-hover:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onFullscreen(layout.id)
        }}
        aria-label="View fullscreen"
      >
        <IconFullscreen className="h-4 w-4" />
      </button>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Explorative gallery mode — an infinite, drag-scrollable canvas of images
 * arranged randomly within a seamlessly tiling 5000×4000px virtual tile.
 *
 * Architecture:
 * - A fixed full-viewport container captures all pointer/touch events.
 * - An inner container applies a CSS translate that wraps via modulo, keeping
 *   the transform value in [0, TILE_W) × [0, TILE_H) to avoid float drift
 *   over extended panning sessions.
 * - Nine tile copies (3×3 grid) are rendered around the origin so the seam
 *   is never visible regardless of scroll direction.
 * - Inertia is implemented via a requestAnimationFrame loop with 5% velocity
 *   decay per frame (~95 damping), matching a natural flick feel.
 * - Cleanup cancels the rAF loop on unmount to prevent memory leaks.
 *
 * @param images - Pre-filtered and sorted gallery images.
 * @param onImageClick - Called with the image's index in the `images` array
 *   when the user requests fullscreen/carousel view.
 */
export default function ExplorativeGallery({ images, onImageClick }: ExplorativeGalleryProps) {
  // --- Layout (regenerated when images reference changes) ------------------
  const layouts = useMemo(() => generateLayout(images), [images])

  /** Fast id→GalleryImage lookup to avoid O(n) searches in render. */
  const imageMap = useMemo(() => Object.fromEntries(images.map((img) => [img.id, img])), [images])

  // --- Drag + inertia state ------------------------------------------------

  /**
   * offsetRef holds the canonical, unbounded offset. We keep this in a ref
   * (not state) so the rAF loop never triggers unnecessary React re-renders.
   */
  const offsetRef = useRef({ x: 0, y: 0 })

  /**
   * renderOffset is the React state that drives re-renders. Updated both
   * during drag and during each inertia step. Kept separate from offsetRef
   * so the inertia loop can mutate offsetRef synchronously without batching
   * concerns.
   */
  const [renderOffset, setRenderOffset] = useState({ x: 0, y: 0 })

  const rafRef = useRef<number | null>(null)
  const velocityRef = useRef({ x: 0, y: 0 })

  // cullOffset drives visibleLayouts; updated only every CULL_THRESHOLD px of movement
  // so the visibility filter does not re-run on every animation frame.
  const CULL_THRESHOLD = 150
  const [cullOffset, setCullOffset] = useState({ x: 0, y: 0 })
  const lastCullRef = useRef({ x: 0, y: 0 })

  const maybeUpdateCull = useCallback((x: number, y: number) => {
    const dx = Math.abs(x - lastCullRef.current.x)
    const dy = Math.abs(y - lastCullRef.current.y)
    if (dx > CULL_THRESHOLD || dy > CULL_THRESHOLD) {
      lastCullRef.current = { x, y }
      setCullOffset({ x, y })
    }
  }, [])

  /**
   * Starts the inertia animation loop after the user releases a drag.
   * Each frame decays velocity by 5% and accumulates it into the offset.
   * Stops automatically when both axes fall below 0.5 px/frame.
   */
  const startInertia = useCallback(() => {
    const step = () => {
      const vel = velocityRef.current
      if (Math.abs(vel.x) < 0.5 && Math.abs(vel.y) < 0.5) {
        rafRef.current = null
        return
      }
      velocityRef.current = { x: vel.x * 0.95, y: vel.y * 0.95 }
      offsetRef.current = {
        x: offsetRef.current.x + velocityRef.current.x,
        y: offsetRef.current.y + velocityRef.current.y,
      }
      setRenderOffset({ ...offsetRef.current })
      maybeUpdateCull(offsetRef.current.x, offsetRef.current.y)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [maybeUpdateCull])

  const bind = useDrag(
    ({ offset: [ox, oy], velocity: [vx, vy], last, direction: [dx, dy] }) => {
      // Cancel any running inertia — the user has taken control again.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      offsetRef.current = { x: ox, y: oy }
      setRenderOffset({ x: ox, y: oy })
      maybeUpdateCull(ox, oy)

      if (last) {
        // Scale velocity by direction sign and a multiplier that gives a
        // satisfying flick distance without feeling uncontrollable.
        velocityRef.current = {
          x: vx * dx * 15,
          y: vy * dy * 15,
        }
        startInertia()
      }
    },
    {
      // Critical: restore the current offset as the drag origin so that each
      // new gesture continues from wherever the canvas currently sits rather
      // than snapping back to (0, 0).
      from: () => [offsetRef.current.x, offsetRef.current.y],
    }
  )

  // Cancel the rAF loop on unmount to prevent memory leaks / state updates
  // on an unmounted component.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // --- Seamless tiling via modulo wrap ------------------------------------

  /**
   * Wrap the unbounded offset into [0, TILE_W) × [0, TILE_H).
   * The double-modulo pattern handles negative values correctly in JS
   * (JS `%` can return negative results for negative operands).
   */
  const wrappedX = ((renderOffset.x % TILE_W) + TILE_W) % TILE_W
  const wrappedY = ((renderOffset.y % TILE_H) + TILE_H) % TILE_H

  // --- Visible layouts optimisation (for 300+ images) --------------------

  /**
   * For large image sets (>300), only render images whose tile-relative
   * position falls within one viewport + generous buffer of the current
   * view centre. This prevents rendering thousands of DOM nodes while still
   * keeping the visible area fully populated.
   *
   * For smaller sets this is skipped entirely to keep the code path simple.
   *
   * Uses cullOffset (throttled, updates every CULL_THRESHOLD px) rather than
   * renderOffset so this filter does not re-run on every animation frame.
   */

  // Cull-specific wrapped coordinates (throttled — do not use for the CSS transform).
  const cullWrappedX = ((cullOffset.x % TILE_W) + TILE_W) % TILE_W
  const cullWrappedY = ((cullOffset.y % TILE_H) + TILE_H) % TILE_H

  const visibleLayouts = useMemo(() => {
    if (layouts.length <= 300) return layouts

    const viewW = typeof window !== "undefined" ? window.innerWidth : 1920
    const viewH = typeof window !== "undefined" ? window.innerHeight : 1080
    const bufferX = TILE_W * 0.5
    const bufferY = TILE_H * 0.5

    // The "camera centre" in tile-local coordinates is the inverse of the
    // wrapped offset — i.e. the point within the tile that is currently
    // at the screen origin.
    const centerX = ((-cullWrappedX % TILE_W) + TILE_W) % TILE_W
    const centerY = ((-cullWrappedY % TILE_H) + TILE_H) % TILE_H

    return layouts.filter((l) => {
      // Toroidal distance: account for the tile wrapping at both edges.
      const dx = Math.min(Math.abs(l.x - centerX), TILE_W - Math.abs(l.x - centerX))
      const dy = Math.min(Math.abs(l.y - centerY), TILE_H - Math.abs(l.y - centerY))
      return dx < viewW + bufferX && dy < viewH + bufferY
    })
  }, [layouts, cullWrappedX, cullWrappedY])

  // --- Stable fullscreen handler ------------------------------------------

  /**
   * Stable callback so ExplorativeImage (wrapped in memo) can skip re-renders
   * during drag frames. Depends only on images and onImageClick, which change
   * only when the filter/mode changes — not on every animation frame.
   */
  const handleFullscreen = useCallback(
    (id: string) => {
      const index = images.findIndex((img) => img.id === id)
      if (index !== -1) onImageClick(index)
    },
    [images, onImageClick]
  )

  // --- Render -------------------------------------------------------------

  return (
    <div
      className="explorative-canvas"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
        cursor: "grab",
      }}
    >
      {/*
       * Inner container receives the CSS translate and the drag binding.
       * willChange: "transform" promotes this layer to the GPU compositor,
       * eliminating paint during panning and giving smooth 60fps scrolling.
       */}
      <div
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
            style={{
              position: "absolute",
              left: tx * TILE_W,
              top: ty * TILE_H,
              width: TILE_W,
              height: TILE_H,
            }}
          >
            {visibleLayouts.map((layout) => {
              const image = imageMap[layout.id]
              // Guard against stale layout/imageMap mismatches during transitions.
              if (!image) return null

              return (
                <ExplorativeImage
                  key={layout.id}
                  layout={layout}
                  image={image}
                  onFullscreen={handleFullscreen}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
