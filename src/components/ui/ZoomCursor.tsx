"use client"

import { useEffect, useRef, useState } from "react"
import type { GalleryMode } from "@/types"

interface ZoomCursorProps {
  mode: GalleryMode
}

const LERP_FACTOR = 0.12
const FADE_OUT_DELAY_MS = 100

/** Returns true when the primary input is touch (no fine pointer). */
function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches
}

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
 * Also visible in Experimental mode (hover on 3D wall image planes).
 * Not shown on touch devices — touch never fires mousemove so the cursor
 * simply stays at opacity:0 forever.
 *
 * @param mode - The current gallery mode. Used to suppress the cursor in
 *   Experimental mode and to re-initialize position when switching modes.
 */
export function ZoomCursor({ mode }: ZoomCursorProps) {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(isTouchDevice())
  }, [])

  // Direct DOM refs — manipulated via JS to avoid per-frame React renders
  const cursorRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const verticalLineRef = useRef<SVGLineElement>(null)

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
    if (isTouch) return

    const el = cursorRef.current
    const inner = innerRef.current
    if (!el || !inner) return

    // Initialise positions to viewport centre so the cursor doesn't fly in
    // from (0, 0) the first time it becomes visible.
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    targetPos.current = { x: cx, y: cy }
    displayPos.current = { x: cx, y: cy }
    el.style.transform = `translate(${cx + 20}px, ${cy + 20}px)`
    inner.style.transform = "rotate(180deg) scale(0)"

    // ── Mouse tracking ──────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      targetPos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMouseMove)

    // ── Hover events from gallery image components ───────────────────────────
    const onHoverStart = () => {
      if (fadeOutTimer.current !== null) {
        clearTimeout(fadeOutTimer.current)
        fadeOutTimer.current = null
      }
      inner.style.transform = "rotate(0deg) scale(1)"
    }

    const onHoverEnd = () => {
      fadeOutTimer.current = setTimeout(() => {
        inner.style.transform = "rotate(180deg) scale(0)"
        fadeOutTimer.current = null
      }, FADE_OUT_DELAY_MS)
    }

    // ── Zoom state (toggle "+" to "−") ────────────────────────────────────
    const onZoomIn = () => {
      if (verticalLineRef.current) verticalLineRef.current.style.display = "none"
    }
    const onZoomOut = () => {
      if (verticalLineRef.current) verticalLineRef.current.style.display = ""
    }

    window.addEventListener("image-hover-start", onHoverStart)
    window.addEventListener("image-hover-end", onHoverEnd)
    window.addEventListener("image-zoomed-in", onZoomIn)
    window.addEventListener("image-zoomed-out", onZoomOut)

    // ── Lerp animation loop ──────────────────────────────────────────────────
    // Runs continuously regardless of visibility so position always tracks the
    // mouse. This prevents a jarring snap-to-cursor when re-appearing.
    const tick = () => {
      displayPos.current.x += (targetPos.current.x - displayPos.current.x) * LERP_FACTOR
      displayPos.current.y += (targetPos.current.y - displayPos.current.y) * LERP_FACTOR

      el.style.transform = `translate(${displayPos.current.x + 20}px, ${displayPos.current.y + 20}px)`

      rafHandle.current = requestAnimationFrame(tick)
    }
    rafHandle.current = requestAnimationFrame(tick)

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("image-hover-start", onHoverStart)
      window.removeEventListener("image-hover-end", onHoverEnd)
      window.removeEventListener("image-zoomed-in", onZoomIn)
      window.removeEventListener("image-zoomed-out", onZoomOut)
      if (rafHandle.current !== null) {
        cancelAnimationFrame(rafHandle.current)
        rafHandle.current = null
      }
      if (fadeOutTimer.current !== null) {
        clearTimeout(fadeOutTimer.current)
        fadeOutTimer.current = null
      }
      inner.style.transform = "rotate(180deg) scale(0)"
    }
  }, [mode, isTouch])

  if (isTouch) return null

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        transform: "translate(0px, 0px)",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <div
        ref={innerRef}
        style={{
          transform: "rotate(180deg) scale(0)",
          transition: "transform 0.2s ease",
        }}
      >
        <svg
          width={32}
          height={32}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="16"
            cy="16"
            r="15"
            style={{ fill: "var(--foreground)", stroke: "var(--foreground)" }}
            strokeWidth={1}
          />
          <line
            x1="9"
            y1="16"
            x2="23"
            y2="16"
            style={{ stroke: "var(--background)" }}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <line
            ref={verticalLineRef}
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
    </div>
  )
}
