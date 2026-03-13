"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDrag } from "@use-gesture/react"
import { LoadableImage } from "@/components/ui/LoadableImage"
import type { GalleryImage } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Base virtual tile dimensions in pixels. These are scaled down proportionally
 * when the image set is a subset (filtered), so visual density stays constant.
 */
const BASE_TILE_W = 5000
const BASE_TILE_H = 4000

/**
 * Reference image count used for tile-scaling. The tile is at full size when
 * n === BASE_COUNT. As n decreases the tile shrinks so images remain dense.
 */
const BASE_COUNT = 200

/**
 * Minimum center-to-center distance between images at BASE_COUNT. Scaled with
 * sqrt(n / BASE_COUNT) so the constraint is proportional to the tile size.
 */
const BASE_MIN_SEPARATION = 250

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

interface GeneratedLayout {
  layouts: ImageLayout[]
  /** Effective tile width (px) — scaled from BASE_TILE_W by sqrt(n / BASE_COUNT). */
  tileW: number
  /** Effective tile height (px) — scaled from BASE_TILE_H by sqrt(n / BASE_COUNT). */
  tileH: number
}

interface ExplorativeGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

interface ExplorativeImageProps {
  layout: ImageLayout
  image: GalleryImage
  onClick: (id: string) => void
}

// ---------------------------------------------------------------------------
// Layout generation
// ---------------------------------------------------------------------------

/**
 * Generates a random, non-overlapping layout for all images within one tile.
 * Positions are regenerated fresh each time the images prop reference changes
 * (mode switch), giving a new arrangement on every visit.
 *
 * Tile dimensions are scaled by sqrt(n / BASE_COUNT) so that visual density
 * (images per pixel²) stays roughly constant when filtering to a subset.
 *
 * Up to 20 placement attempts are made per image to avoid MIN_SEPARATION
 * violations; if exhausted, the last candidate is used to guarantee all
 * images are placed (sparse layouts with many images would otherwise stall).
 *
 * @param images - The filtered, sorted gallery images to lay out.
 * @returns Layouts array and effective tile dimensions.
 */
function generateLayout(images: GalleryImage[]): GeneratedLayout {
  const n = images.length
  // Area scales linearly with n when linear dimensions scale with sqrt(n).
  // Math.max(n, 1) guards against sqrt(0) = 0 producing a zero-sized tile.
  const scale = Math.sqrt(Math.max(n, 1) / BASE_COUNT)
  const tileW = Math.round(BASE_TILE_W * scale)
  const tileH = Math.round(BASE_TILE_H * scale)
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
    } while (attempts < 20 && positions.some((p) => Math.hypot(p.x - x, p.y - y) < minSeparation))

    positions.push({ x, y })
    layouts.push({
      id: image.id,
      x,
      y,
      rotation: (Math.random() - 0.5) * 16, // ±8°
      width,
    })
  }

  return { layouts, tileW, tileH }
}

// ---------------------------------------------------------------------------
// Individual image tile
// ---------------------------------------------------------------------------

/**
 * Renders a single image within the explorative canvas.
 *
 * The rotation is stored as a CSS custom property `--rotation` on the element
 * so that `globals.css` can transition it to `0deg` on hover without needing
 * `!important` to override the inline style. On touch devices the hover
 * effect is suppressed via `@media (hover: hover)`.
 *
 * The full image wrapper is clickable — the fullscreen icon button has been
 * removed in favour of making the whole image the click target.
 */
const ExplorativeImage = memo(function ExplorativeImage({
  layout,
  image,
  onClick,
}: ExplorativeImageProps) {
  // Stable per-instance handler — only changes if onClick or layout.id changes,
  // which only happens on filter/mode switch (not on drag frames).
  const handleClick = useCallback(() => onClick(layout.id), [onClick, layout.id])

  return (
    <div
      className="explorative-image"
      style={
        {
          position: "absolute",
          left: layout.x,
          top: layout.y,
          width: layout.width,
          "--rotation": `${layout.rotation}deg`,
          transformOrigin: "center center",
          cursor: "none",
        } as React.CSSProperties
      }
    >
      <LoadableImage
        id={image.id}
        size={500}
        alt={`${image.tag} piece`}
        className="w-full"
        overrideSrc={image.previewSrc}
        width={image.width}
        height={image.height}
        onClick={handleClick}
      />
    </div>
  )
})

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Explorative gallery mode — an infinite, drag-scrollable canvas of images
 * arranged randomly within a seamlessly tiling virtual tile.
 *
 * Architecture:
 * - Tile dimensions are scaled by sqrt(n / BASE_COUNT) to maintain constant
 *   visual density when filtering to a subset of images.
 * - A fixed full-viewport container captures all pointer/touch events.
 * - An inner container applies a CSS translate that wraps via modulo, keeping
 *   the transform value in [0, tileW) × [0, tileH) to avoid float drift
 *   over extended panning sessions.
 * - Nine tile copies (3×3 grid) are rendered around the origin so the seam
 *   is never visible regardless of scroll direction.
 * - Inertia is implemented via a requestAnimationFrame loop with 5% velocity
 *   decay per frame (~95 damping), matching a natural flick feel.
 * - `filterTaps: true` on useDrag lets native onClick events pass through for
 *   short pointer gestures (< 5px movement), enabling click-to-open-carousel.
 * - An `isDraggingRef` guards against synthetic click events fired by some
 *   touch browsers after a drag gesture ends.
 * - Cleanup cancels the rAF loop on unmount to prevent memory leaks.
 *
 * @param images - Pre-filtered and sorted gallery images.
 * @param onImageClick - Called with the image's index in the `images` array
 *   when the user clicks an image to open the carousel.
 */
export default function ExplorativeGallery({ images, onImageClick }: ExplorativeGalleryProps) {
  // --- Layout (regenerated when images reference changes) ------------------
  const { layouts, tileW, tileH } = useMemo(() => generateLayout(images), [images])

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

  /**
   * Tracks whether a drag gesture is currently active (distance > tap threshold).
   * Guards against synthetic click events fired by some touch browsers after
   * a drag ends — if true, handleImageClick becomes a no-op.
   */
  const isDraggingRef = useRef(false)

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
    ({ offset: [ox, oy], velocity: [vx, vy], last, direction: [dx, dy], tap }) => {
      // Taps (< tapsThreshold px movement) are handled by onClick on image divs.
      // Return early so the drag handler does not update the offset for a tap.
      if (tap) return

      // Mark as active drag so handleImageClick suppresses any synthetic clicks.
      isDraggingRef.current = true

      // Cancel any running inertia — the user has taken control again.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      offsetRef.current = { x: ox, y: oy }
      setRenderOffset({ x: ox, y: oy })
      maybeUpdateCull(ox, oy)

      if (last) {
        isDraggingRef.current = false
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
      // filterTaps: true — gestures < tapsThreshold px do NOT update the drag
      // offset and let native onClick events bubble through to image wrappers.
      filterTaps: true,
      tapsThreshold: 5,
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
   * Wrap the unbounded offset into [0, tileW) × [0, tileH).
   * The double-modulo pattern handles negative values correctly in JS
   * (JS `%` can return negative results for negative operands).
   */
  const wrappedX = ((renderOffset.x % tileW) + tileW) % tileW
  const wrappedY = ((renderOffset.y % tileH) + tileH) % tileH

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
  const cullWrappedX = ((cullOffset.x % tileW) + tileW) % tileW
  const cullWrappedY = ((cullOffset.y % tileH) + tileH) % tileH

  const visibleLayouts = useMemo(() => {
    if (layouts.length <= 300) return layouts

    const viewW = typeof window !== "undefined" ? window.innerWidth : 1920
    const viewH = typeof window !== "undefined" ? window.innerHeight : 1080
    const bufferX = tileW * 0.5
    const bufferY = tileH * 0.5

    // The "camera centre" in tile-local coordinates is the inverse of the
    // wrapped offset — i.e. the point within the tile that is currently
    // at the screen origin.
    const centerX = ((-cullWrappedX % tileW) + tileW) % tileW
    const centerY = ((-cullWrappedY % tileH) + tileH) % tileH

    return layouts.filter((l) => {
      // Toroidal distance: account for the tile wrapping at both edges.
      const dx = Math.min(Math.abs(l.x - centerX), tileW - Math.abs(l.x - centerX))
      const dy = Math.min(Math.abs(l.y - centerY), tileH - Math.abs(l.y - centerY))
      return dx < viewW + bufferX && dy < viewH + bufferY
    })
  }, [layouts, tileW, tileH, cullWrappedX, cullWrappedY])

  // --- Click handler -------------------------------------------------------

  /**
   * Stable callback so ExplorativeImage (wrapped in memo) can skip re-renders
   * during drag frames. Guards against synthetic click events from touch
   * browsers by checking isDraggingRef.
   *
   * Depends only on images and onImageClick, which change only when the
   * filter/mode changes — not on every animation frame.
   */
  const handleImageClick = useCallback(
    (id: string) => {
      if (isDraggingRef.current) return
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
              left: tx * tileW,
              top: ty * tileH,
              width: tileW,
              height: tileH,
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
                  onClick={handleImageClick}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
