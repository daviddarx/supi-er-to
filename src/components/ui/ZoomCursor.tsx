"use client"

import { useEffect, useRef } from "react"
import type { GalleryMode } from "@/types"

interface ZoomCursorProps {
  mode: GalleryMode
}

const LERP_FACTOR = 0.12
const FADE_OUT_DELAY_MS = 100

/**
 * Global zoom cursor — a solid circle with a "+" sign that follows the mouse
 * when hovering over any gallery image in Classic, Grid, and Explorative modes.
 *
 * Gallery image components dispatch window CustomEvents "image-hover-start" /
 * "image-hover-end" to signal hover state changes. The cursor fades in/out
 * with a 100ms debounce (prevents flicker when moving between adjacent images)
 * and uses a lerp-smoothed position (factor 0.12) for a fluid trailing feel.
 *
 * The cursor element is manipulated directly via refs to avoid React re-renders
 * on every animation frame. The rAF loop runs continuously even while invisible
 * so there is no position jump when re-appearing.
 *
 * Not visible in Experimental mode (no carousel / no image hover there).
 * Not shown on touch devices — touch never fires mousemove so the cursor
 * simply stays at opacity:0 forever.
 *
 * @param mode - The current gallery mode. Used to suppress the cursor in
 *   Experimental mode and to re-initialize position when switching modes.
 */
export function ZoomCursor({ mode }: ZoomCursorProps) {
  // Direct DOM ref — manipulated via JS to avoid per-frame React renders
  const cursorRef = useRef<HTMLDivElement>(null)

  // Raw mouse position (updated on every mousemove).
  // Initialised to viewport centre; the DOM transform is set to match in the
  // useEffect so there is no jump from (0,0) when the cursor first appears.
  const targetPos = useRef({ x: 0, y: 0 })
  // Lerp-smoothed display position — same initial value as targetPos.
  const displayPos = useRef({ x: 0, y: 0 })

  // rAF handle for the lerp loop
  const rafHandle = useRef<number | null>(null)
  // Fade-out debounce timer (100ms)
  const fadeOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = cursorRef.current
    if (!el) return

    // Initialise positions to viewport centre so the cursor doesn't fly in
    // from (0, 0) the first time it becomes visible.
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    targetPos.current = { x: cx, y: cy }
    displayPos.current = { x: cx, y: cy }
    // Sync the DOM transform immediately so it matches the refs — prevents a
    // visual jump from translate(0,0) to the centre position on first hover.
    el.style.transform = `translate(${cx + 20}px, ${cy + 20}px)`

    // Experimental mode has no carousel images — keep cursor permanently hidden.
    if (mode === "experimental") {
      el.style.opacity = "0"
      return
    }

    // ── Mouse tracking ──────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      targetPos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMouseMove)

    // ── Hover events from gallery image components ───────────────────────────
    const onHoverStart = () => {
      // Cancel any pending fade-out (user moved directly from one image to another)
      if (fadeOutTimer.current !== null) {
        clearTimeout(fadeOutTimer.current)
        fadeOutTimer.current = null
      }
      el.style.opacity = "1"
    }

    const onHoverEnd = () => {
      // Defer fade-out so quick moves between images don't cause a flicker
      fadeOutTimer.current = setTimeout(() => {
        el.style.opacity = "0"
        fadeOutTimer.current = null
      }, FADE_OUT_DELAY_MS)
    }

    window.addEventListener("image-hover-start", onHoverStart)
    window.addEventListener("image-hover-end", onHoverEnd)

    // ── Lerp animation loop ──────────────────────────────────────────────────
    // Runs continuously regardless of visibility so position always tracks the
    // mouse. This prevents a jarring snap-to-cursor when re-appearing.
    const tick = () => {
      displayPos.current.x += (targetPos.current.x - displayPos.current.x) * LERP_FACTOR
      displayPos.current.y += (targetPos.current.y - displayPos.current.y) * LERP_FACTOR

      // Offset by +20px on both axes so the cursor sits below-right of the pointer
      el.style.transform = `translate(${displayPos.current.x + 20}px, ${displayPos.current.y + 20}px)`

      rafHandle.current = requestAnimationFrame(tick)
    }
    rafHandle.current = requestAnimationFrame(tick)

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("image-hover-start", onHoverStart)
      window.removeEventListener("image-hover-end", onHoverEnd)
      if (rafHandle.current !== null) {
        cancelAnimationFrame(rafHandle.current)
        rafHandle.current = null
      }
      if (fadeOutTimer.current !== null) {
        clearTimeout(fadeOutTimer.current)
        fadeOutTimer.current = null
      }
      // Ensure cursor is hidden after cleanup so it doesn't linger across
      // mode transitions.
      el.style.opacity = "0"
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
        // JS sets the translate on every rAF tick
        transform: "translate(0px, 0px)",
        // Invisible until an image-hover-start event arrives
        opacity: 0,
        // CSS handles the fade; JS lerp handles the position
        transition: "opacity 0.2s ease",
        // Must never intercept pointer events — would break image clicks
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/*
       * Solid filled circle with contrasting "+" lines.
       * Uses CSS custom properties (--foreground / --background from shadcn)
       * so it automatically adapts to dark/light mode without extra class logic.
       *
       * Dark mode:  --foreground = near-white  → white circle, dark "+"
       * Light mode: --foreground = near-black  → black circle, white "+"
       */}
      <svg
        width={32}
        height={32}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Filled circle — same colour as text/foreground */}
        <circle
          cx="16"
          cy="16"
          r="15"
          style={{ fill: "var(--foreground)", stroke: "var(--foreground)" }}
          strokeWidth={1}
        />
        {/* "+" horizontal arm — inverted (background colour) */}
        <line
          x1="9"
          y1="16"
          x2="23"
          y2="16"
          style={{ stroke: "var(--background)" }}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        {/* "+" vertical arm — inverted (background colour) */}
        <line
          x1="16"
          y1="9"
          x2="16"
          y2="23"
          style={{ stroke: "var(--background)" }}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
