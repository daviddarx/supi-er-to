# Phase 3 — Carousel Fixes, ZoomCursor, Routing Refactor, Admin ID Scheme

**Date**: 2026-03-11
**Scope**: CarouselOverlay YARL fixes (slide fade-in, prev/next navigation, close animation), ZoomCursor global component, path-based routing refactor, upload-image ID scheme change, admin sheet padding fix.

---

## 0. Current State Summary

After reading the codebase, here is the exact situation in each area:

**CarouselOverlay** (`src/components/gallery/CarouselOverlay.tsx`):
- Renders YARL (`yet-another-react-lightbox` v3.23.4).
- `render.buttonPrev` and `render.buttonNext` return plain `<button>` elements with no `onClick` handler connected to YARL navigation. The buttons are purely visual — clicking them does nothing.
- `render.buttonClose` calls `onClose()` (a prop from `page.tsx`), which sets `carouselOpen = false` synchronously in React state. This bypasses YARL's exit animation because the `open` prop flips to `false` before YARL can play its closing transition.
- No slide fade-in on image load — images appear immediately at full opacity.

**Routing** (`src/app/page.tsx`, `src/lib/url-state.ts`, `src/components/DeepLinkHandler.tsx`):
- Single-page app on `/`. Mode and filter live in React state only (no URL reflection for mode).
- `?image={id}` query param used for carousel deep links.
- `DeepLinkHandler` reads `?image=` on mount and opens carousel.
- `setImageUrl(id)` / `setImageUrl(null)` manage the param via `window.history.pushState`.

**Upload function** (`netlify/functions/upload-image.ts`):
- Line 204: `const id = `img-${Date.now()}`` — timestamp-based ID.
- `tag` is already validated ("supi" | "bone") and present in the request body.
- `fetchCurrentImages()` is already defined and returns the full `GalleryImage[]` from GitHub.

**Admin sheet** (`src/components/admin/NewPieceSheet.tsx`):
- Tag selector (RadioGroup with "supi" / "bone") exists and sends `tag` to the API.
- Sheet content div has `mt-6` margin but no padding — content sits flush with the sheet edges.
- `SheetContent` wraps the inner `div` with no padding of its own.

**next.config.ts**:
- `output: "export"` has been removed. The project uses `@netlify/plugin-nextjs` as a full SSR adapter. This means `generateStaticParams` is still recommended for pre-rendering mode pages, but it is NOT strictly required (the plugin handles dynamic routes via SSR fallback). However, using `generateStaticParams` keeps the pages fully static and avoids Netlify function cold starts for the gallery routes.

---

## 1. CarouselOverlay — YARL Fixes

### 1.1 Slide Fade-In on Image Load

**File**: `src/components/gallery/CarouselOverlay.tsx`

YARL's `render.slide` prop receives a `{ slide, rect, ... }` argument and replaces the entire slide renderer. We use it to wrap YARL's default `ImageSlide` in a fade wrapper.

The pattern: render a custom slide component that uses YARL's exported `ImageSlide` internally, adds an `onLoad` callback, and transitions from `opacity: 0` to `opacity: 1` over 300ms.

Import `ImageSlide` from `yet-another-react-lightbox`. Create an inline `FadeSlide` component (defined outside `CarouselOverlay` to avoid re-creation on each render). Pass it to `render.slide`.

```tsx
import Lightbox, { ImageSlide } from "yet-another-react-lightbox"
import type { SlotStyles, RenderSlideProps } from "yet-another-react-lightbox"
```

```tsx
// Outside CarouselOverlay — stable reference, not recreated on each render
function FadeSlide({ slide, rect, imageFit, imagePosition }: RenderSlideProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      style={{
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.3s ease",
        width: "100%",
        height: "100%",
      }}
    >
      <ImageSlide
        slide={slide}
        rect={rect}
        imageFit={imageFit}
        imagePosition={imagePosition}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
```

Then in the `<Lightbox>` props:

```tsx
render={{
  slide: (props) => <FadeSlide {...props} />,
  // ... buttonClose, buttonPrev, buttonNext below
}}
```

**Note**: `ImageSlide` accepts an `onLoad` prop (it is wired to the underlying `<img>` element). Verify this is the correct prop name in v3.23.4 — if not, use `render.slideFooter` to observe load via a side effect, or use a `MutationObserver`. The primary path (using `onLoad`) should work.

### 1.2 Fix Prev/Next Buttons — NavButton Pattern

**Root cause**: `render.buttonPrev` and `render.buttonNext` are render prop functions. You cannot call React hooks inside a plain function — only inside a React component. The current implementation returns a `<button>` with no `onClick`, so navigation is completely broken.

**Fix**: Create a `NavButton` React component (capital N — a real component). Inside it, call `useController()` from `yet-another-react-lightbox`. `useController()` is only valid inside YARL's React tree (which render props are rendered inside), so this works correctly.

`useController()` returns `{ prev, next, close }` — these are stable callbacks that trigger YARL's internal navigation with the full animation.

```tsx
import { useController, ACTION_PREV, ACTION_NEXT, ACTION_CLOSE } from "yet-another-react-lightbox"
```

```tsx
interface NavButtonProps {
  direction: "prev" | "next"
  iconColor: string
  btnClass: string
}

// This is a React COMPONENT, not a render-prop callback.
// It can call hooks because it IS a component (capital first letter,
// returned from a render prop as JSX, not called as a function).
function NavButton({ direction, iconColor, btnClass }: NavButtonProps) {
  const { prev, next } = useController()

  return (
    <button
      onClick={() => (direction === "prev" ? prev() : next())}
      className={cn(
        "absolute z-50 -translate-y-1/2",
        direction === "prev" ? "top-1/2 left-4" : "top-1/2 right-4",
        btnClass
      )}
      style={{ color: iconColor }}
      aria-label={direction === "prev" ? "Previous image" : "Next image"}
    >
      {direction === "prev" ? <IconArrowLeft /> : <IconArrowRight />}
    </button>
  )
}
```

Then in the `render` prop:

```tsx
render={{
  slide: (props) => <FadeSlide {...props} />,
  buttonClose: () => <CloseButton iconColor={iconColor} btnClass={btnClass} onClose={onClose} />,
  buttonPrev: () => <NavButton direction="prev" iconColor={iconColor} btnClass={btnClass} />,
  buttonNext: () => <NavButton direction="next" iconColor={iconColor} btnClass={btnClass} />,
}}
```

**Critical**: The render prop functions (`() => <NavButton ... />`) are plain functions that return JSX — React will render `<NavButton>` as a proper component and will correctly call hooks inside it. Do NOT destructure and call `useController()` inside the render prop function itself — that would be calling a hook inside a plain function (not a component), which is a React rules violation.

### 1.3 Fix Close Animation — CloseButton Pattern

**Root cause**: The current `render.buttonClose` calls `onClose()` (the parent prop), which sets `carouselOpen = false` in `page.tsx`, which sets YARL's `open` prop to `false` immediately. YARL's exit animation requires `open` to stay `true` while the animation runs — it fires its own internal close sequence before telling the parent to close (via the YARL `close` callback / `onClose` prop).

**Fix**: Same pattern as `NavButton`. Create a `CloseButton` component that calls `useController().close()`. YARL's `close()` plays the exit animation first, then YARL calls the `close` prop on `<Lightbox>` when the animation completes (which is `onClose` in our case).

```tsx
interface CloseButtonProps {
  iconColor: string
  btnClass: string
}

function CloseButton({ iconColor, btnClass }: CloseButtonProps) {
  const { close } = useController()

  return (
    <button
      onClick={() => close()}
      className={`absolute top-4 right-4 z-50 ${btnClass}`}
      style={{ color: iconColor }}
      aria-label="Close"
    >
      <IconClose />
    </button>
  )
}
```

**Note on the `onClose` prop**: The `<Lightbox close={onClose}>` prop is still needed — it is what YARL calls after the animation completes to notify the parent. We are NOT removing it. We are only removing the manual `onClose()` call from the button's `onClick`. The flow is now:

1. User clicks our custom `CloseButton`
2. `CloseButton.onClick` → `useController().close()`
3. YARL plays its exit animation (opacity fade, configurable via `animation.fade`)
4. After animation: YARL calls its `close` prop → our `onClose` → `setCarouselOpen(false)`

### 1.4 Button Styling — Match OptionsBar

Current button class in `CarouselOverlay`:
```
"flex h-9 w-9 items-center justify-center rounded-[2px] border border-current bg-background/20 transition-colors has-hover:hover:bg-background/40"
```

Per the decision, buttons should be 40×40px (`h-10 w-10`), match OptionsBar style. The OptionsBar buttons use:
```
"has-hover:hover:bg-muted flex h-8 w-8 items-center justify-center rounded-[2px] border"
```

The carousel buttons need to be readable on top of images, so they keep the `bg-background/20` backdrop + `has-hover:hover:bg-background/40` hover state. Update to `h-10 w-10` and `strokeWidth=1` icons.

For the icons at `strokeWidth=1`: The current icon components in `src/components/ui/icons/index.tsx` have `strokeWidth={1.5}` hardcoded. Add a `strokeWidth` prop to the `IconProps` interface (or use a wrapper with `style`). Simplest approach: pass `className` with an explicit SVG stroke override via `[&>*]:stroke-[1]` Tailwind class, or accept a `strokeWidth` prop in `IconProps`.

Recommended: Add `strokeWidth?: number` to `IconProps` and pass it through:

```tsx
interface IconProps {
  className?: string
  strokeWidth?: number
}

export function IconClose({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      strokeWidth={strokeWidth}
      // ...
    >
```

Then in `CarouselOverlay`, render `<IconClose strokeWidth={1} />` etc.

### 1.5 Complete Updated CarouselOverlay

```tsx
"use client"

import { useState } from "react"
import Lightbox, { ImageSlide, useController } from "yet-another-react-lightbox"
import type { SlotStyles, RenderSlideProps } from "yet-another-react-lightbox"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { getImageSrc } from "@/lib/images"
import { IconArrowLeft, IconArrowRight, IconClose } from "@/components/ui/icons"
import type { GalleryImage } from "@/types"

interface CarouselOverlayProps {
  images: GalleryImage[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
  isDarkMode: boolean
}

// ─── FadeSlide ────────────────────────────────────────────────────────────────
// Wraps YARL's built-in ImageSlide with an opacity fade-in on load.
// Defined outside CarouselOverlay to avoid recreation on every render.

function FadeSlide({ slide, rect, imageFit, imagePosition }: RenderSlideProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      style={{
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.3s ease",
        width: "100%",
        height: "100%",
      }}
    >
      <ImageSlide
        slide={slide}
        rect={rect}
        imageFit={imageFit}
        imagePosition={imagePosition}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

// ─── NavButton ────────────────────────────────────────────────────────────────
// A proper React component (not a plain function) so it can call useController().
// Rendered by the render.buttonPrev / render.buttonNext render props.

interface NavButtonProps {
  direction: "prev" | "next"
  iconColor: string
  btnClass: string
}

function NavButton({ direction, iconColor, btnClass }: NavButtonProps) {
  const { prev, next } = useController()

  return (
    <button
      onClick={() => (direction === "prev" ? prev() : next())}
      className={cn(
        "absolute top-1/2 z-50 -translate-y-1/2",
        direction === "prev" ? "left-4" : "right-4",
        btnClass
      )}
      style={{ color: iconColor }}
      aria-label={direction === "prev" ? "Previous image" : "Next image"}
    >
      {direction === "prev" ? (
        <IconArrowLeft strokeWidth={1} />
      ) : (
        <IconArrowRight strokeWidth={1} />
      )}
    </button>
  )
}

// ─── CloseButton ──────────────────────────────────────────────────────────────
// Uses useController().close() so YARL plays its exit animation before the
// parent's onClose sets carouselOpen = false.

interface CloseButtonProps {
  iconColor: string
  btnClass: string
}

function CloseButton({ iconColor, btnClass }: CloseButtonProps) {
  const { close } = useController()

  return (
    <button
      onClick={() => close()}
      className={cn("absolute top-4 right-4 z-50", btnClass)}
      style={{ color: iconColor }}
      aria-label="Close"
    >
      <IconClose strokeWidth={1} />
    </button>
  )
}

// ─── CarouselOverlay ─────────────────────────────────────────────────────────

export function CarouselOverlay({
  images,
  initialIndex,
  isOpen,
  onClose,
  isDarkMode,
}: CarouselOverlayProps) {
  const slides = useMemo(
    () =>
      images.map((img) => ({
        src: img.previewSrc ?? getImageSrc(img.id, 2400),
        width: 2400,
        height: 1600,
      })),
    [images]
  )

  const backdropColor = isDarkMode ? "rgba(0, 0, 0, 0.95)" : "rgba(255, 255, 255, 0.95)"
  const iconColor = isDarkMode ? "#ffffff" : "#000000"

  const btnClass =
    "flex h-10 w-10 items-center justify-center rounded-[2px] border border-current bg-background/20 transition-colors has-hover:hover:bg-background/40"

  return (
    <Lightbox
      open={isOpen}
      close={onClose}
      slides={slides}
      index={initialIndex}
      styles={
        {
          container: { backgroundColor: backdropColor },
          root: { "--yarl__color_backdrop": backdropColor },
        } as SlotStyles
      }
      render={{
        slide: (props) => <FadeSlide {...props} />,
        buttonClose: () => <CloseButton iconColor={iconColor} btnClass={btnClass} />,
        buttonPrev: () => (
          <NavButton direction="prev" iconColor={iconColor} btnClass={btnClass} />
        ),
        buttonNext: () => (
          <NavButton direction="next" iconColor={iconColor} btnClass={btnClass} />
        ),
      }}
      carousel={{ padding: "5%" }}
      animation={{ swipe: 300 }}
      controller={{ closeOnBackdropClick: true }}
    />
  )
}
```

---

## 2. ZoomCursor Component (Item 30)

### 2.1 Architecture

A single `ZoomCursor` component is rendered once in `page.tsx`, positioned `fixed` on top of everything, and is completely invisible by default. When any gallery image fires `image-hover-start` / `image-hover-end` custom events (dispatched on `window`), the cursor fades in/out and follows the mouse with lerp-based inertia.

The cursor is suppressed in Experimental mode (no carousel images there).

**File**: `src/components/ui/ZoomCursor.tsx`

### 2.2 Custom Event Protocol

Each gallery image component dispatches these events on `window`:

```typescript
// On mouse enter an image:
window.dispatchEvent(new CustomEvent("image-hover-start"))

// On mouse leave an image:
window.dispatchEvent(new CustomEvent("image-hover-end"))
```

`ZoomCursor` listens for these on `window` via `useEffect` and toggles visibility accordingly.

### 2.3 Lerp Animation Loop

The lerp loop runs continuously via `requestAnimationFrame` while the component is mounted. It updates a visual position ref toward the target mouse position with factor `~0.12` per frame. The loop always continues (even when cursor is invisible) to avoid a "jump" when the cursor re-appears.

```
displayX += (targetX - displayX) * LERP_FACTOR
displayY += (targetY - displayY) * LERP_FACTOR
```

The cursor element is positioned at `(displayX + 20, displayY + 20)` — offset so it appears to the bottom-right of the actual mouse pointer.

### 2.4 Fade-Out Delay

When `image-hover-end` fires, a 100ms timeout starts. If `image-hover-start` fires within that window (user moved mouse directly from one image to another), the timeout is cleared and the cursor stays visible. After 100ms without `image-hover-start`, the cursor begins fading out.

### 2.5 Full Implementation

```tsx
"use client"

import { useEffect, useRef } from "react"
import type { GalleryMode } from "@/types"

interface ZoomCursorProps {
  mode: GalleryMode
}

const LERP_FACTOR = 0.12
const FADE_OUT_DELAY_MS = 100

/**
 * Global zoom cursor — a "+" inside a solid circle that follows the mouse
 * when hovering over any gallery image (Classic, Grid, Explorative modes).
 *
 * Images dispatch window CustomEvents "image-hover-start" / "image-hover-end"
 * to signal hover state. The cursor fades in/out with a lerp-smoothed position.
 *
 * Not visible in Experimental mode (no carousel there).
 * Not rendered server-side (uses window APIs directly via refs + rAF).
 */
export function ZoomCursor({ mode }: ZoomCursorProps) {
  // The DOM element ref — we manipulate it directly to avoid React re-renders
  // on every animation frame (which would be catastrophic for performance).
  const cursorRef = useRef<HTMLDivElement>(null)

  // Target position (raw mouse coordinates)
  const targetPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  // Display position (lerp-smoothed)
  const displayPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

  // Whether the cursor should be visible
  const isVisible = useRef(false)
  // rAF handle
  const rafHandle = useRef<number | null>(null)
  // Fade-out delay timer
  const fadeOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = cursorRef.current
    if (!el) return

    // Experimental mode: cursor never activates — keep hidden and bail early.
    // We still attach nothing so cleanup is a no-op.
    if (mode === "experimental") {
      el.style.opacity = "0"
      return
    }

    // ── Mouse tracking ──────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      targetPos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMouseMove)

    // ── Hover state from gallery images ─────────────────────────────────────
    const onHoverStart = () => {
      // Cancel any pending fade-out
      if (fadeOutTimer.current !== null) {
        clearTimeout(fadeOutTimer.current)
        fadeOutTimer.current = null
      }
      isVisible.current = true
      if (el) el.style.opacity = "1"
    }

    const onHoverEnd = () => {
      // Delay before fading out — allows quick moves between images
      fadeOutTimer.current = setTimeout(() => {
        isVisible.current = false
        if (el) el.style.opacity = "0"
        fadeOutTimer.current = null
      }, FADE_OUT_DELAY_MS)
    }

    window.addEventListener("image-hover-start", onHoverStart)
    window.addEventListener("image-hover-end", onHoverEnd)

    // ── Lerp animation loop ──────────────────────────────────────────────────
    // The loop runs continuously regardless of visibility so position is always
    // tracking (no "jump" when the cursor becomes visible again).
    const tick = () => {
      const dx = targetPos.current.x - displayPos.current.x
      const dy = targetPos.current.y - displayPos.current.y
      displayPos.current.x += dx * LERP_FACTOR
      displayPos.current.y += dy * LERP_FACTOR

      if (el) {
        el.style.transform = `translate(${displayPos.current.x + 20}px, ${displayPos.current.y + 20}px)`
      }

      rafHandle.current = requestAnimationFrame(tick)
    }
    rafHandle.current = requestAnimationFrame(tick)

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("image-hover-start", onHoverStart)
      window.removeEventListener("image-hover-end", onHoverEnd)
      if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current)
      if (fadeOutTimer.current !== null) clearTimeout(fadeOutTimer.current)
    }
  }, [mode])

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        // Start at top-left; transform positions it via JS
        transform: "translate(0px, 0px)",
        // Start invisible
        opacity: 0,
        // Smooth fade in/out (lerp handles position smoothing, CSS handles opacity)
        transition: "opacity 0.2s ease",
        // Never intercept mouse events
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/*
       * Dark mode: solid black circle, white "+"
       * Light mode: solid white circle with black border, black "+"
       * We use currentColor via CSS so a single className prop on the wrapping
       * page controls both states via the dark class on <html>.
       */}
      <svg
        width={32}
        height={32}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Circle fill: black in dark mode, white in light mode */}
        <circle
          cx="16"
          cy="16"
          r="15"
          className="fill-foreground stroke-foreground"
          strokeWidth={1}
        />
        {/* "+" icon: white in dark mode, black in light mode */}
        <line
          x1="16"
          y1="9"
          x2="16"
          y2="23"
          className="stroke-background"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1="9"
          y1="16"
          x2="23"
          y2="16"
          className="stroke-background"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
```

**Note on SVG color**: Using Tailwind's `fill-foreground` and `stroke-background` (shadcn CSS variables). In dark mode: `foreground` is white → white circle. In light mode: `foreground` is black → black circle. The "+" strokes use `stroke-background` (inverted). This auto-adapts with the dark class on `<html>`.

If the SVG fill classes don't resolve correctly (Tailwind doesn't know about `fill-foreground` by default without config), use inline styles instead:

```tsx
// Alternative: inline style
<circle
  cx="16" cy="16" r="15"
  style={{ fill: "var(--foreground)", stroke: "var(--foreground)" }}
  strokeWidth={1}
/>
<line ... style={{ stroke: "var(--background)" }} />
```

This is safer since shadcn defines `--foreground` and `--background` as CSS custom properties on `:root`.

### 2.6 Hiding the System Cursor on Hover

Add CSS to `globals.css` to hide the default cursor when hovering over images in the three gallery modes:

```css
/* Hide system cursor on gallery images in carousel-supporting modes */
.classic-gallery img,
.grid-gallery img,
.explorative-image {
  cursor: none;
}
```

Or equivalently, apply `cursor-none` Tailwind class to the clickable image containers in `ClassicGallery`, `GridGallery`, and `ExplorativeImage`. This is cleaner. The `cursor-none` class must be added to the outer `div` in `LoadableImage` when `onClick` is present, or the gallery image wrappers themselves.

Simpler approach: add `cursor-none` to the `onClick` path in `LoadableImage`:

```tsx
// In LoadableImage.tsx
className={cn("relative overflow-hidden", onClick && "cursor-none", className)}
```

Since `LoadableImage` already has `cursor-pointer` when `onClick` is set, replace it with `cursor-none`.

### 2.7 Event Dispatch in Gallery Components

#### ClassicGallery and GridGallery — via LoadableImage

Both use `<LoadableImage onClick={() => onImageClick(index)} />`. The hover events need to be dispatched from the image container. The cleanest approach: add `onMouseEnter` and `onMouseLeave` props to `LoadableImage`, or dispatch directly in the gallery's wrapper div if it wraps each image.

Since `LoadableImage` is the image element in both cases, add `onMouseEnter` / `onMouseLeave` dispatch to `LoadableImage` when it has an `onClick` (i.e., it is a clickable gallery image):

```tsx
// In LoadableImage.tsx — add to the outer div when onClick is present
<div
  ref={containerRef}
  onClick={onClick}
  onMouseEnter={onClick ? () => window.dispatchEvent(new CustomEvent("image-hover-start")) : undefined}
  onMouseLeave={onClick ? () => window.dispatchEvent(new CustomEvent("image-hover-end")) : undefined}
  className={cn("relative overflow-hidden", onClick && "cursor-none", className)}
  style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
>
```

This means `LoadableImage` instances without `onClick` (e.g., admin preview) do NOT dispatch events.

#### ExplorativeGallery — via ExplorativeImage

The `ExplorativeImage` component has a wrapping `div.explorative-image`. Add `onMouseEnter` / `onMouseLeave` there:

```tsx
// In ExplorativeGallery.tsx — ExplorativeImage component
<div
  className="explorative-image group"
  onMouseEnter={() => window.dispatchEvent(new CustomEvent("image-hover-start"))}
  onMouseLeave={() => window.dispatchEvent(new CustomEvent("image-hover-end"))}
  style={{ ... }}
>
```

**Note**: In Explorative mode, the outer container has `cursor: grab`. The individual image divs should override to `cursor: none` when hovered. Add to globals.css or inline:

```css
.explorative-image:hover {
  cursor: none;
}
```

### 2.8 Remove ExplorativeImage Fullscreen Button (Item 25)

Per the interview decisions, the per-image fullscreen icon in Explorative mode is being replaced by the ZoomCursor. Remove the `<button>` (the "absolute top-2 right-2" fullscreen icon) from `ExplorativeImage`. The `onFullscreen` prop and `handleFullscreen` callback in `ExplorativeGallery` still work — they are just invoked via `onClick` on the image container instead of the button.

Change `ExplorativeImage` to propagate clicks from the image `div` itself:

```tsx
// ExplorativeImage — updated
const ExplorativeImage = memo(function ExplorativeImage({
  layout,
  image,
  onFullscreen,
}: ExplorativeImageProps) {
  return (
    <div
      className="explorative-image group"
      onMouseEnter={() => window.dispatchEvent(new CustomEvent("image-hover-start"))}
      onMouseLeave={() => window.dispatchEvent(new CustomEvent("image-hover-end"))}
      onClick={(e) => {
        e.stopPropagation()
        onFullscreen(layout.id)
      }}
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.width,
        transform: `rotate(${layout.rotation}deg)`,
        transformOrigin: "center center",
        cursor: "none",
      }}
    >
      <LoadableImage
        id={image.id}
        size={500}
        alt={`${image.tag} piece`}
        className="w-full"
        overrideSrc={image.previewSrc}
      />
      {/* Fullscreen button REMOVED — ZoomCursor replaces it */}
    </div>
  )
})
```

**Note on pointer events in Explorative mode**: The explorative canvas captures all drag events. An `onClick` on the image div might conflict with drag gestures. The existing code had a separate `<button>` with `e.stopPropagation()` — which already worked. Moving the click to the div itself should be fine as long as `@use-gesture/react` distinguishes taps from drags (it does, via a distance threshold). If issues arise, keep a transparent clickable overlay div inside the image div.

### 2.9 Render ZoomCursor in page.tsx

```tsx
// In page.tsx — add import and render alongside other overlays
import { ZoomCursor } from "@/components/ui/ZoomCursor"

// Inside the return JSX, after the AnimatePresence block:
<ZoomCursor mode={mode} />
```

The component should be outside the `AnimatePresence` block (so it persists across mode transitions and doesn't fade out with the gallery).

**Important**: `ZoomCursor` uses `window` on initialization (`targetPos.current = { x: window.innerWidth / 2, ... }`). This must be wrapped in a check or moved inside `useEffect`. Since `page.tsx` is a client component (`"use client"`), and `ZoomCursor` is also a client component, this is fine at runtime. But to be safe for SSR (since `output: "export"` is gone and the page may be server-rendered on first load), initialize `targetPos` and `displayPos` with `{ x: 0, y: 0 }` as the default and set them to `window.innerWidth / 2` inside `useEffect`.

Updated initialization in `ZoomCursor`:

```tsx
const targetPos = useRef({ x: 0, y: 0 })
const displayPos = useRef({ x: 0, y: 0 })

useEffect(() => {
  // Safe to access window here (client-only)
  targetPos.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  displayPos.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  // ... rest of effect
}, [mode])
```

---

## 3. Routing Refactor (Item 31)

### 3.1 Route Architecture

Switch from a single-page `src/app/page.tsx` to path-based routes:

| URL | Page | Notes |
|-----|------|-------|
| `/` | redirect → `/classic` | Handled by `src/app/page.tsx` |
| `/classic` | Classic gallery | `src/app/[mode]/page.tsx` |
| `/grid` | Grid gallery | same |
| `/explorative` | Explorative gallery | same |
| `/experimental` | Experimental gallery | same |
| `/classic/supi-198` | Classic + carousel open | SPA: served by `/classic`, reads path client-side |
| `/classic?filter=supi` | Classic with filter | Query param |

The `[imageId]` segment does NOT get its own static page. Instead:
- A Netlify redirect rule serves `/classic/supi-198` from the `/classic` page.
- On mount, the `[mode]/page.tsx` reads `window.location.pathname` to extract the image ID and opens the carousel.

This avoids having to `generateStaticParams` for every image × mode combination (which would be 200+ × 4 = 800+ static pages, though that is technically feasible).

### 3.2 File Structure Changes

**Files to create**:
- `src/app/[mode]/page.tsx` — main gallery page (replaces `src/app/page.tsx`)
- `public/_redirects` — Netlify rewrite rules

**Files to delete**:
- `src/components/DeepLinkHandler.tsx` — replaced by inline mount logic in `[mode]/page.tsx`

**Files to modify**:
- `src/app/page.tsx` — becomes a redirect to `/classic`
- `src/lib/url-state.ts` — full replacement with path-based API

### 3.3 src/app/page.tsx — Root Redirect

Since `output: "export"` is gone and we have SSR via `@netlify/plugin-nextjs`, we can use Next.js `permanentRedirect` in a server component:

```tsx
// src/app/page.tsx
import { permanentRedirect } from "next/navigation"

export default function RootPage() {
  permanentRedirect("/classic")
}
```

This is a server component (no `"use client"` directive). `permanentRedirect` throws a Next.js redirect internally, resulting in a 308 response. On the client, Next.js router handles it transparently.

**Alternative** (if server component redirect causes issues with next-auth session context): use a client component:

```tsx
"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/classic")
  }, [router])
  return null
}
```

The server component approach is cleaner and preferred.

### 3.4 src/app/[mode]/page.tsx — Main Gallery Page

```tsx
"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useSession, signOut } from "next-auth/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Header } from "@/components/layout/Header"
import { OptionsBar } from "@/components/layout/OptionsBar"
import { NewPieceSheet } from "@/components/admin/NewPieceSheet"
import { ZoomCursor } from "@/components/ui/ZoomCursor"
import { fetchImages, filterImages, sortImages } from "@/lib/images"
import {
  getModeFromPath,
  getImageIdFromPath,
  getFilterFromQuery,
  pushCarouselUrl,
  pushModeUrl,
} from "@/lib/url-state"
import { findImageIndex } from "@/lib/images"
import type { GalleryImage, GalleryMode, ImageFilter } from "@/types"

// Lazy-loaded gallery modes
const ClassicGallery = dynamic(() => import("@/components/gallery/ClassicGallery"), { ssr: false })
const GridGallery = dynamic(() => import("@/components/gallery/GridGallery"), { ssr: false })
const ExplorativeGallery = dynamic(() => import("@/components/gallery/ExplorativeGallery"), { ssr: false })
const ExperimentalGallery = dynamic(() => import("@/components/gallery/ExperimentalGallery"), { ssr: false })
const CarouselOverlay = dynamic(
  () => import("@/components/gallery/CarouselOverlay").then((m) => ({ default: m.CarouselOverlay })),
  { ssr: false }
)

const VALID_MODES: GalleryMode[] = ["classic", "grid", "explorative", "experimental"]

export default function GalleryPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = !!session

  // Read initial mode from the URL path segment (e.g. /classic → "classic")
  const [mode, setMode] = useState<GalleryMode>(() => getModeFromPath())
  // Read initial filter from ?filter= query param
  const [filter, setFilter] = useState<ImageFilter>(() => getFilterFromQuery())

  const [images, setImages] = useState<GalleryImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [carouselOpen, setCarouselOpen] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [newPieceSheetOpen, setNewPieceSheetOpen] = useState(false)

  const filteredImages = useMemo(() => filterImages(images, filter), [images, filter])

  // Restore theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme")
    const isDark = saved ? saved === "dark" : true
    setIsDarkMode(isDark)
    document.documentElement.classList.toggle("dark", isDark)
  }, [])

  // Fetch images on mount
  useEffect(() => {
    fetchImages()
      .then((imgs) => {
        setImages(imgs)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load images:", err)
        setIsLoading(false)
      })
  }, [])

  // Deep link: once images are loaded, check if URL has an image ID path segment
  useEffect(() => {
    if (images.length === 0) return

    const imageId = getImageIdFromPath()
    if (!imageId) return

    const index = findImageIndex(filteredImages, imageId)
    if (index === -1) {
      // Stale ID — clear the path segment
      pushCarouselUrl(mode, null, filter)
      return
    }

    setCarouselIndex(index)
    setCarouselOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images])

  const toggleDarkMode = useCallback(() => {
    const next = !isDarkMode
    setIsDarkMode(next)
    localStorage.setItem("theme", next ? "dark" : "light")
    document.documentElement.classList.toggle("dark", next)
  }, [isDarkMode])

  const openCarousel = useCallback(
    (index: number) => {
      setCarouselIndex(index)
      setCarouselOpen(true)
      const imageId = filteredImages[index]?.id
      pushCarouselUrl(mode, imageId ?? null, filter)
    },
    [filteredImages, mode, filter]
  )

  const closeCarousel = useCallback(() => {
    setCarouselOpen(false)
    pushCarouselUrl(mode, null, filter)
  }, [mode, filter])

  const handleModeChange = useCallback(
    (newMode: GalleryMode) => {
      setMode(newMode)
      pushModeUrl(newMode, filter, router)
    },
    [filter, router]
  )

  const handleFilterChange = useCallback(
    (newFilter: ImageFilter) => {
      setFilter(newFilter)
      // Update query param without navigation
      const url = new URL(window.location.href)
      if (newFilter === "all") {
        url.searchParams.delete("filter")
      } else {
        url.searchParams.set("filter", newFilter)
      }
      window.history.replaceState({}, "", url.toString())
    },
    []
  )

  const handleImageAdded = useCallback((newImage: GalleryImage) => {
    setNewPieceSheetOpen(false)
    setImages((prev) => sortImages([newImage, ...prev]))
  }, [])

  const renderGallery = () => {
    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground text-xs">Loading…</p>
        </div>
      )
    }

    const galleryProps = {
      images: filteredImages,
      onImageClick: openCarousel,
    }

    switch (mode) {
      case "classic":
        return <ClassicGallery {...galleryProps} />
      case "grid":
        return <GridGallery {...galleryProps} />
      case "explorative":
        return <ExplorativeGallery {...galleryProps} />
      case "experimental":
        return <ExperimentalGallery images={filteredImages} isDarkMode={isDarkMode} />
    }
  }

  return (
    <TooltipProvider>
      <div className="bg-background min-h-screen">
        <div className="max-md:flex max-md:flex-col">
          <Header />
          <OptionsBar
            mode={mode}
            filter={filter}
            isDarkMode={isDarkMode}
            onModeChange={handleModeChange}
            onFilterChange={handleFilterChange}
            onDarkModeToggle={toggleDarkMode}
            isAdmin={isAdmin}
            onNewPiece={() => setNewPieceSheetOpen(true)}
            onLogOut={() => signOut({ callbackUrl: "/" })}
          />
        </div>

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

        <CarouselOverlay
          images={filteredImages}
          initialIndex={carouselIndex}
          isOpen={carouselOpen}
          onClose={closeCarousel}
          isDarkMode={isDarkMode}
        />

        <ZoomCursor mode={mode} />

        {isAdmin && (
          <NewPieceSheet
            open={newPieceSheetOpen}
            onOpenChange={setNewPieceSheetOpen}
            onSuccess={handleImageAdded}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
```

**Notes**:
- The `Suspense` wrappers from old `page.tsx` around `CarouselOverlay` and `DeepLinkHandler` are removed. `CarouselOverlay` uses `dynamic()` with `ssr: false` which handles its own Suspense internally. The deep link logic is inlined into the component's `useEffect`.
- Mode state is initialized from `getModeFromPath()` on first render. When the user navigates to `/grid`, Next.js renders this page component fresh, so `getModeFromPath()` returns `"grid"`.
- The `[mode]` path segment parameter is available via Next.js `useParams()` if preferred, but reading from `window.location.pathname` directly is simpler and avoids a hook dependency.

**Alternative using useParams**:

```tsx
import { useParams } from "next/navigation"

// Inside component:
const params = useParams<{ mode: string }>()
const [mode, setMode] = useState<GalleryMode>(() => {
  const m = params.mode as GalleryMode
  return VALID_MODES.includes(m) ? m : "classic"
})
```

Using `useParams` is the "correct" Next.js App Router approach. Both work. `useParams` is preferred because it avoids touching `window` directly.

### 3.5 generateStaticParams

Since `output: "export"` is removed and `@netlify/plugin-nextjs` handles SSR, `generateStaticParams` is optional. However, it is recommended to keep the gallery pages fully static (no SSR cold starts, no function invocations for the main gallery routes).

Add to `src/app/[mode]/page.tsx` (as a named export alongside the default export, outside the component):

```typescript
export function generateStaticParams() {
  return [
    { mode: "classic" },
    { mode: "grid" },
    { mode: "explorative" },
    { mode: "experimental" },
  ]
}
```

This generates four static HTML pages at build time. The `[imageId]` sub-routes (`/classic/supi-198`) are handled entirely by the Netlify `_redirects` rule — they rewrite to `/classic` which serves the static HTML, and JS reads the path on hydration.

### 3.6 new url-state.ts

Full replacement of `src/lib/url-state.ts`:

```typescript
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import type { GalleryMode, ImageFilter } from "@/types"

const VALID_MODES: GalleryMode[] = ["classic", "grid", "explorative", "experimental"]

/**
 * Reads the gallery mode from the current URL pathname.
 * The mode is the first path segment: /classic → "classic".
 * Falls back to "classic" for unknown segments (e.g. "/" before redirect resolves).
 */
export function getModeFromPath(): GalleryMode {
  if (typeof window === "undefined") return "classic"
  const segments = window.location.pathname.split("/").filter(Boolean)
  const first = segments[0] as GalleryMode
  return VALID_MODES.includes(first) ? first : "classic"
}

/**
 * Reads the image ID from the URL path, if present.
 * Path structure: /[mode]/[imageId] → returns imageId.
 * Returns null if no image segment exists or on the server.
 */
export function getImageIdFromPath(): string | null {
  if (typeof window === "undefined") return null
  const segments = window.location.pathname.split("/").filter(Boolean)
  // segments[0] = mode, segments[1] = imageId (optional)
  return segments.length >= 2 ? segments[1] : null
}

/**
 * Reads the active filter from the ?filter= query parameter.
 * Returns "all" if the param is absent or invalid.
 */
export function getFilterFromQuery(): ImageFilter {
  if (typeof window === "undefined") return "all"
  const params = new URLSearchParams(window.location.search)
  const v = params.get("filter")
  if (v === "supi" || v === "bone") return v
  return "all"
}

/**
 * Updates the URL to reflect the open carousel state using window.history.pushState.
 * Does NOT trigger a Next.js navigation — the SPA stays on the same JS bundle.
 *
 * Examples:
 *   pushCarouselUrl("classic", "supi-198", "all")   → /classic/supi-198
 *   pushCarouselUrl("classic", null, "supi")         → /classic?filter=supi
 *   pushCarouselUrl("grid", "bone-12", "bone")       → /grid/bone-12?filter=bone
 */
export function pushCarouselUrl(
  mode: GalleryMode,
  imageId: string | null,
  filter: ImageFilter
): void {
  if (typeof window === "undefined") return
  const base = `/${mode}`
  const path = imageId ? `${base}/${imageId}` : base
  const url = new URL(path, window.location.origin)
  if (filter !== "all") url.searchParams.set("filter", filter)
  window.history.pushState({}, "", url.toString())
}

/**
 * Navigates to a new gallery mode using the Next.js router (real navigation).
 * Preserves the active filter in the query string.
 * Closes the carousel (no imageId in the URL).
 *
 * @param mode - The target gallery mode
 * @param filter - The current active filter
 * @param router - The Next.js App Router instance from useRouter()
 */
export function pushModeUrl(
  mode: GalleryMode,
  filter: ImageFilter,
  router: AppRouterInstance
): void {
  const path = filter !== "all" ? `/${mode}?filter=${filter}` : `/${mode}`
  router.push(path)
}
```

**Important notes on `pushModeUrl`**:
- `AppRouterInstance` is imported from Next.js internals. If this causes TypeScript issues (unstable path), use `{ push: (path: string) => void }` as the type instead.
- `router.push()` causes a real Next.js navigation (full page component re-render with the new `[mode]` param). This is correct behavior — each mode is a separate page in the routing model.
- Mode-switch navigation closes the carousel naturally (new page mount, carousel starts closed).

### 3.7 public/_redirects

Create `public/_redirects` (this file is served as-is by Netlify and processed before `@netlify/plugin-nextjs`):

```
# Rewrite /classic/<anything> to /classic — SPA handles carousel state
/classic/*  /classic  200

# Same for other modes
/grid/*  /grid  200
/explorative/*  /explorative  200
/experimental/*  /experimental  200

# Catch-all: unknown paths → classic (404 fallback)
/*  /classic  200
```

**Note on Netlify + Next.js plugin interaction**: When using `@netlify/plugin-nextjs`, the plugin generates its own redirect rules in `.netlify/`. There can be conflicts between `public/_redirects` and the plugin's rules. The order of precedence on Netlify is: `_redirects` file → `netlify.toml` redirects → plugin-generated rules. Since our `_redirects` rules come first, they should take effect. However, test this in staging — if the Next.js plugin's rules override `_redirects`, move the redirect rules into `netlify.toml` under `[[redirects]]` sections instead.

**netlify.toml alternative** (if `_redirects` conflicts with the plugin):

```toml
[[redirects]]
  from = "/classic/*"
  to = "/classic"
  status = 200

[[redirects]]
  from = "/grid/*"
  to = "/grid"
  status = 200

[[redirects]]
  from = "/explorative/*"
  to = "/explorative"
  status = 200

[[redirects]]
  from = "/experimental/*"
  to = "/experimental"
  status = 200

[[redirects]]
  from = "/*"
  to = "/classic"
  status = 200
```

Add these after the existing `[functions."upload-image"]` section in `netlify.toml`.

### 3.8 Deep Link Flow (End-to-End)

User shares URL `https://supi.er.to/classic/supi-198`:

1. Netlify receives request for `/classic/supi-198`.
2. `_redirects` rule `/classic/*` rewrites to `/classic` with status 200 (transparent to the client).
3. Next.js serves the static `/classic` page (generated by `generateStaticParams`).
4. React hydrates. `GalleryPage` component mounts.
5. `mode` state initialized to `"classic"` (from `getModeFromPath()` which reads `/classic/supi-198` and returns `"classic"`).
6. `getImageIdFromPath()` reads `/classic/supi-198` → returns `"supi-198"`.
7. Images fetch completes → the deep-link `useEffect` fires → finds `"supi-198"` in `filteredImages` → `setCarouselOpen(true)`, `setCarouselIndex(index)`.
8. CarouselOverlay opens at the correct image.

User closes carousel:
1. `closeCarousel()` calls `pushCarouselUrl("classic", null, "all")`.
2. `window.history.pushState` updates URL to `/classic` (no SPA navigation).
3. URL is clean.

### 3.9 Browser Back Button Behavior

With `window.history.pushState`, the browser's back button will navigate back through the history stack. When the user pressed back from `/classic/supi-198` to `/classic`, the page does NOT re-mount (no Next.js navigation happened). The URL changes but React state stays as-is (carousel still open).

To handle `popstate` events (back/forward navigation), add a `popstate` listener in `GalleryPage`:

```tsx
useEffect(() => {
  const onPopState = () => {
    const imageId = getImageIdFromPath()
    if (!imageId) {
      // Back to mode page — close carousel if open
      setCarouselOpen(false)
    } else {
      // Forward to an image URL — open carousel
      const index = findImageIndex(filteredImages, imageId)
      if (index !== -1) {
        setCarouselIndex(index)
        setCarouselOpen(true)
      }
    }
  }
  window.addEventListener("popstate", onPopState)
  return () => window.removeEventListener("popstate", onPopState)
}, [filteredImages])
```

This makes the back button work correctly: pressing back while the carousel is open closes it (navigating back to `/classic`), and pressing forward re-opens it.

---

## 4. Image ID Scheme (Item 32)

### 4.1 Change in netlify/functions/upload-image.ts

**Current** (line 204):
```typescript
const id = `img-${Date.now()}`
```

**Replacement** — compute `{tag}-{N+1}` based on the highest existing numeric ID for that tag:

```typescript
/**
 * Generates the next sequential ID for a given tag.
 * Scans existing images to find the highest numeric suffix for the tag.
 * Returns "{tag}-1" if no images with that tag exist yet.
 *
 * Examples:
 *   existingImages has supi-1 through supi-197 → returns "supi-198"
 *   existingImages has no "bone" entries → returns "bone-1"
 *
 * Robustness: ignores entries whose ID doesn't match "{tag}-{number}" pattern.
 */
function generateNextId(tag: "supi" | "bone", existingImages: GalleryImage[]): string {
  const tagImages = existingImages.filter((img) => img.tag === tag)

  let maxNum = 0
  for (const img of tagImages) {
    // Match "{tag}-{digits}" — skip IDs that don't follow this pattern
    const match = img.id.match(/^[a-z]+-(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }

  return `${tag}-${maxNum + 1}`
}
```

**Where to insert**: After `fetchCurrentImages()` returns `currentImages` (around line 237), before building `newEntry`:

```typescript
const currentImages = await fetchCurrentImages(githubToken, repoOwner, repoName)

// Replace: const id = `img-${Date.now()}`
const id = generateNextId(tag as "supi" | "bone", currentImages)
```

**Update the `newEntry` filename** — it currently uses `${id}.webp` as `filename`. The WebP files are named `${id}.500.webp`, `${id}.1280.webp`, `${id}.2400.webp` — `filename` in the JSON appears to be a legacy field (the gallery uses `getImageSrc(img.id, size)` which constructs the path from `id` directly). Keep `filename: `${id}.webp`` as-is for backward compatibility.

**Update the commit message** (line 275):
```typescript
`Add new piece: ${id} (${tag}, ${date})`
```
This already uses `id` dynamically so no change needed here.

### 4.2 Edge Cases

| Scenario | Result | Reason |
|---|---|---|
| No images for tag `bone` yet | `bone-1` | `maxNum` stays 0, returns `0 + 1 = 1` |
| No images for tag `supi` yet | `supi-1` | Same |
| Only `img-{timestamp}` IDs exist for a tag | `supi-1` | The regex `^[a-z]+-(\d+)$` won't match since `img-1773059485098` has prefix `img`, not `supi`. `maxNum` stays 0. |
| Mixed old (`img-{ts}`) and new (`supi-N`) IDs | Correctly picks max of new IDs | `img-{ts}` IDs have tag `supi` or `bone` in the JSON — the filter is by `img.tag`, not `img.id`. The regex on `img.id` will not match `img-1773059485098` (regex requires the prefix to match `[a-z]+` before `-digits`; `img-1773059485098` DOES match `^[a-z]+-(\d+)$` — `img` is the prefix, `1773059485098` is the digits). **This is a concern.** |

**Regex concern**: `img-1773059485098` DOES match `^[a-z]+-(\d+)$` — it has alphabetic prefix `img` and numeric suffix. This means old `img-{timestamp}` IDs would be parsed as `13-digit numbers`, yielding `maxNum = 1773059485098`. The next `supi` or `bone` ID would be `supi-1773059485099` — clearly wrong.

**Fix**: Filter by the tag-specific prefix pattern, not just any `[a-z]+-(\d+)` pattern:

```typescript
function generateNextId(tag: "supi" | "bone", existingImages: GalleryImage[]): string {
  const prefix = `${tag}-`
  // The pattern for NEW-style IDs is exactly "{tag}-{digits}"
  const pattern = new RegExp(`^${tag}-(\\d+)$`)

  let maxNum = 0
  for (const img of existingImages) {
    if (!img.id.startsWith(prefix)) continue  // skip old img-{ts} and other-tag IDs
    const match = img.id.match(pattern)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }

  return `${tag}-${maxNum + 1}`
}
```

Now `img-1773059485098` starts with `img-`, not `supi-`, so it is skipped by `startsWith(prefix)`. Only `supi-N` format IDs count toward `maxNum`. This is correct and safe.

**Note on existing `supi-29`, `bone-81` IDs**: These already exist in `images.json` (per the CLAUDE.md). They follow the new `{tag}-{N}` pattern and will be correctly picked up by `generateNextId`. The first new upload will be `supi-{max+1}` which is consistent.

### 4.3 Backward Compatibility

Existing image IDs (`supi-29`, `bone-81`, `photos-27`, `img-{timestamp}`) are never modified. The `generateNextId` function is only called for new uploads. All existing entries in `images.json` continue to work because `getImageSrc(img.id, size)` just builds `/images/${id}.${size}.webp` from the `id` string. No migration of existing data is needed.

---

## 5. Admin Sheet Padding (Item 34)

### 5.1 Fix in src/components/admin/NewPieceSheet.tsx

**Current**: The content div inside `SheetContent` uses `mt-6` for top spacing but no horizontal or vertical padding. The shadcn `Sheet` component renders `SheetHeader` with its own padding (typically `px-6 pt-6`), but `SheetContent` itself has no padding by default in this project's shadcn setup.

Looking at the JSX:

```tsx
<SheetContent side="right" className="w-[400px] sm:w-[500px]">
  <SheetHeader>
    <SheetTitle className="text-sm font-bold">New piece arrival</SheetTitle>
  </SheetHeader>

  <div className="mt-6 flex flex-col gap-5">
    {/* form fields */}
  </div>
</SheetContent>
```

**Fix**: Add `px-6 pb-6` to the inner content div to match shadcn Sheet's standard header padding:

```tsx
<div className="mt-6 flex flex-col gap-5 px-6 pb-6">
```

If `SheetHeader` also lacks horizontal padding, check the shadcn component definition. shadcn's default `SheetHeader` applies `px-6` in most configurations. If the header looks misaligned, add `className="px-6 pt-6"` to `SheetHeader` explicitly as well.

**Alternative**: Add `p-6` to `SheetContent` instead of the inner div:

```tsx
<SheetContent side="right" className="w-[400px] sm:w-[500px] p-6">
```

This is cleaner — all padding is in one place. The `<SheetHeader>` and the content div both benefit. Check that `SheetTitle` doesn't double-apply padding.

The simplest, safest fix: add `px-6 pb-6` to the inner div only (the header already has its own spacing from shadcn's default styles), keeping the change minimal:

```tsx
<div className="mt-6 flex flex-col gap-5 px-6 pb-6">
```

---

## 6. Files to Delete

| File | Reason |
|------|--------|
| `src/components/DeepLinkHandler.tsx` | Logic inlined into `[mode]/page.tsx`'s `useEffect`. The component is no longer imported anywhere. |
| `src/app/page.tsx` | Replaced by redirect-only root page (keep the file, just replace its content — do not delete). |

**Note**: Do not delete `src/app/page.tsx` — it must exist to handle the `/` route. Replace its content with the redirect.

---

## 7. Files to Modify Summary

| File | Change |
|------|--------|
| `src/app/page.tsx` | Replace content with `permanentRedirect("/classic")` server component |
| `src/app/[mode]/page.tsx` | **Create new** — main gallery page (full content in section 3.4) |
| `src/lib/url-state.ts` | **Full replacement** with path-based API (section 3.6) |
| `src/components/gallery/CarouselOverlay.tsx` | YARL fixes: FadeSlide, NavButton, CloseButton (section 1.5) |
| `src/components/ui/ZoomCursor.tsx` | **Create new** — global zoom cursor (section 2.5) |
| `src/components/ui/icons/index.tsx` | Add `strokeWidth?: number` prop to relevant icons |
| `src/components/ui/LoadableImage.tsx` | Add `onMouseEnter` / `onMouseLeave` event dispatch; change `cursor-pointer` → `cursor-none` |
| `src/components/gallery/ExplorativeGallery.tsx` | Remove fullscreen button from `ExplorativeImage`; add hover event dispatch; move click handler to div |
| `src/components/gallery/ClassicGallery.tsx` | No direct changes needed — events handled via LoadableImage |
| `src/components/gallery/GridGallery.tsx` | No direct changes needed — events handled via LoadableImage |
| `src/components/admin/NewPieceSheet.tsx` | Add `px-6 pb-6` padding to content div |
| `netlify/functions/upload-image.ts` | Replace `img-${Date.now()}` with `generateNextId()`; add `generateNextId` function |
| `public/_redirects` | **Create new** — Netlify rewrite rules for image deep links |

---

## 8. Implementation Order

Complete these in sequence to avoid broken intermediate states:

1. **url-state.ts** — Replace first (other files depend on it). Remove `setImageUrl`, `getImageIdFromUrl`. Add new functions.

2. **CarouselOverlay.tsx** — Fix prev/next/close, add slide fade-in. Standalone change, no dependencies on routing.

3. **icons/index.tsx** — Add `strokeWidth` prop (needed by CarouselOverlay).

4. **[mode]/page.tsx** — Create the new gallery page. Depends on updated url-state.ts.

5. **page.tsx** — Replace root with redirect. Can only do this after `[mode]/page.tsx` exists and works.

6. **public/_redirects** — Create Netlify rewrite rules.

7. **ZoomCursor.tsx** — Create component.

8. **LoadableImage.tsx** — Add hover event dispatch, change cursor.

9. **ExplorativeGallery.tsx** — Remove fullscreen button, add hover events, move click handler.

10. **NewPieceSheet.tsx** — Add padding (trivial, do last).

11. **upload-image.ts** — Add `generateNextId`, update ID generation.

12. **Delete** `src/components/DeepLinkHandler.tsx` — After verifying `[mode]/page.tsx` handles deep links correctly.

---

## 9. Testing Checklist

### Carousel
- [ ] Open carousel — slide fades in (opacity 0 → 1, ~300ms)
- [ ] Click Prev button — navigates to previous image with animation
- [ ] Click Next button — navigates to next image with animation
- [ ] Click Close button — YARL plays exit animation before disappearing
- [ ] Click backdrop — closes carousel (via `controller.closeOnBackdropClick`)
- [ ] Keyboard arrows — navigate (YARL built-in keyboard handler)
- [ ] Keyboard Escape — closes carousel

### ZoomCursor
- [ ] Classic mode: hover image → "+" cursor appears, follows mouse with lerp inertia
- [ ] Grid mode: same
- [ ] Explorative mode: hover image div → cursor appears
- [ ] Experimental mode: cursor never appears
- [ ] Mouse between images: cursor stays visible (no flicker)
- [ ] Mouse outside gallery: cursor fades out after ~100ms
- [ ] Light mode: black circle, black "+"
- [ ] Dark mode: white circle, white "+"
- [ ] System cursor hidden (cursor-none on gallery images)

### Routing
- [ ] `/` → redirects to `/classic`
- [ ] `/classic` → loads Classic gallery, mode = "classic"
- [ ] `/grid` → loads Grid gallery, mode = "grid"
- [ ] `/explorative` → loads Explorative gallery
- [ ] `/experimental` → loads Experimental gallery
- [ ] `/classic/supi-198` → loads Classic gallery, carousel opens at supi-198
- [ ] `/classic?filter=supi` → loads Classic, filter = supi
- [ ] `/classic/supi-198?filter=supi` → loads Classic, filter supi, carousel at supi-198
- [ ] Open carousel → URL updates to `/classic/supi-198`
- [ ] Close carousel → URL returns to `/classic`
- [ ] Switch mode → URL changes to `/grid` (router.push)
- [ ] Change filter → URL updates to `?filter=supi` (replaceState, no navigation)
- [ ] Back button while carousel open → closes carousel, URL = `/classic`
- [ ] Share URL with image → carousel opens on direct load

### Admin
- [ ] Upload sheet opens with proper padding (aligned with sheet header)
- [ ] Upload supi image → new ID is `supi-{N+1}` not `img-{timestamp}`
- [ ] Upload bone image → new ID is `bone-{N+1}`
- [ ] First upload of a tag with no existing entries → starts at `{tag}-1`
- [ ] Existing `img-{timestamp}` IDs not affected by new scheme

### Backward Compatibility
- [ ] Old `?image={id}` URLs no longer work (no longer read — acceptable, no external links use old format)
- [ ] Existing image IDs (`supi-29`, `bone-81`) still display in gallery
- [ ] No runtime errors from `photos` tag legacy IDs (not a tag in the system, but IDs exist in JSON)

---

## 10. Edge Cases and Gotchas

### YARL useController Context Requirement
`useController()` must be called inside a component that is rendered inside YARL's React tree. This is guaranteed when the component is returned as JSX from a render prop — React renders it as a proper child inside YARL's provider tree. If you ever need to call `useController` outside a render prop (e.g., in a plugin), use the plugin API instead.

### YARL render.slide and ImageSlide Props
YARL v3's `RenderSlideProps` interface: verify the exact props passed to `render.slide`. In v3.23.4, the render callback receives `{ slide, offset, rect, imageFit, imagePosition }`. `ImageSlide` accepts `{ slide, rect, imageFit, imagePosition, onLoad, onError }`. If TypeScript reports unknown props on `ImageSlide`, check the exact signature in `node_modules/yet-another-react-lightbox/dist/index.d.ts`.

### window.history.pushState and Next.js Router Sync
When using `window.history.pushState` to update the URL (for carousel open/close), Next.js's router is NOT notified. This means `usePathname()` and `useSearchParams()` hooks elsewhere in the tree may return stale values. This is acceptable since:
1. Only `GalleryPage` reads the URL (via `getImageIdFromPath` on mount, and `getFilterFromQuery` on mount).
2. The popstate listener handles back/forward.
3. No other components depend on the URL state being live-synced via Next.js hooks.

### Next.js @netlify/plugin-nextjs + generateStaticParams
With `output: "export"` removed, the behavior of `generateStaticParams` changes: it now pre-renders pages at build time (SSG) rather than being required for static export. Pages NOT in `generateStaticParams` can still be served by the plugin via SSR (on-demand rendering). This means `generateStaticParams` for the 4 modes is optional but strongly recommended for performance.

### Netlify _redirects vs Plugin Routes
If the `@netlify/plugin-nextjs` plugin generates catch-all routes that conflict with `_redirects`, the plugin's routes may take precedence. In that case, the plugin's catch-all would try to serve `/classic/supi-198` as a Next.js route, which would 404 (no page exists for that path). Test by deploying a staging branch. The fix is to add the redirects to `netlify.toml` instead (plugin respects `netlify.toml` redirects via the `[[redirects]]` sections, which are processed before the plugin's generated functions).

### ExplorativeGallery Click vs Drag Discrimination
`@use-gesture/react`'s `useDrag` tracks movement distance. Clicks (no movement) are recognized as taps and do not fire the drag handler. However, the click event on the image `div` may fire even after a drag (browsers fire click on mouseup if no significant movement). Add a drag-state guard:

```tsx
// In ExplorativeGallery, inside the bind() handler:
const isDraggingRef = useRef(false)

const bind = useDrag(
  ({ movement: [mx, my], dragging }) => {
    isDraggingRef.current = Math.hypot(mx, my) > 5
    // ... existing drag logic
  },
  { ... }
)

// In ExplorativeImage onClick:
onClick={(e) => {
  if (isDraggingRef.current) return  // ignore click after drag
  e.stopPropagation()
  onFullscreen(layout.id)
}}
```

Pass `isDraggingRef` down to `ExplorativeImage` or use a shared context.

### Custom CSS cursor in Explorative mode
The `.explorative-canvas` div sets `cursor: grab` and `.explorative-canvas:active { cursor: grabbing }`. Individual `.explorative-image` divs with `cursor: none` should override this when hovering. Test that the `cursor: none` style on the image div takes precedence over `cursor: grab` on the canvas. If not, use a more specific CSS selector or `!important` (not ideal).

### ZoomCursor and Touch Devices
On touch devices, there is no mousemove event and no hover state. The ZoomCursor will simply never appear (target events never fire). This is correct behavior — the cursor is a desktop-only affordance. No special handling needed.

### Filter URL State on Mode Switch
When switching modes via `pushModeUrl()`, the filter is preserved in the new URL: `/grid?filter=supi`. When the new mode page mounts, `getFilterFromQuery()` reads the `?filter=supi` param and initializes filter state correctly. This works seamlessly.
