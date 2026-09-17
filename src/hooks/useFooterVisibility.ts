"use client"

import { useEffect, useState } from "react"
import type { GalleryMode } from "@/types"

/** Matches the `max-md` breakpoint the bar is already styled against. */
const MOBILE_QUERY = "(max-width: 767px)"

/** Scroll travel needed before the bar reacts, so jitter doesn't flap it. */
const SCROLL_THRESHOLD = 8

/** Below this the page has nothing above to scroll back through, so the bar stays. */
const TOP_ZONE = 10

/** Pause after an Explorative gesture ends, before the bar comes back. */
const REAPPEAR_DELAY_MS = 1000

/** How long the bar then lingers before retiring again. */
const LINGER_MS = 3000

/**
 * Drives the bottom bar's visibility on phones. Desktop never hides it.
 *
 * Each mode reports interaction differently: Classic and Grid scroll the page,
 * Explorative dispatches gesture events from its canvas, and Experimental
 * already announces focus via the image-zoomed events it uses elsewhere.
 */
export function useFooterVisibility(mode: GalleryMode): boolean {
  const [hidden, setHidden] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Tracked rather than read once: a phone that loads in landscape sits above
  // the breakpoint, and rotating to portrait has to start the rules up
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setHidden(false)
      return
    }

    // Every mode starts visible, including after a mode switch
    setHidden(false)

    let lingerTimer: ReturnType<typeof setTimeout> | null = null
    const clearLinger = () => {
      if (lingerTimer !== null) {
        clearTimeout(lingerTimer)
        lingerTimer = null
      }
    }

    if (mode === "classic" || mode === "grid") {
      let lastY = window.scrollY

      const onScroll = () => {
        const y = window.scrollY
        const delta = y - lastY

        if (y <= TOP_ZONE) {
          lastY = y
          setHidden(false)
          return
        }
        if (Math.abs(delta) < SCROLL_THRESHOLD) return

        lastY = y
        setHidden(delta > 0)
      }

      window.addEventListener("scroll", onScroll, { passive: true })
      return () => window.removeEventListener("scroll", onScroll)
    }

    if (mode === "explorative") {
      const onStart = () => {
        clearLinger()
        setHidden(true)
      }
      // Once the fingers lift: pause, come back, then retire again. Both stages
      // share the one handle, so a new gesture cancels whichever is pending.
      const onEnd = () => {
        clearLinger()
        lingerTimer = setTimeout(() => {
          setHidden(false)
          lingerTimer = setTimeout(() => setHidden(true), LINGER_MS)
        }, REAPPEAR_DELAY_MS)
      }

      window.addEventListener("gallery-interaction-start", onStart)
      window.addEventListener("gallery-interaction-end", onEnd)
      return () => {
        clearLinger()
        window.removeEventListener("gallery-interaction-start", onStart)
        window.removeEventListener("gallery-interaction-end", onEnd)
      }
    }

    if (mode === "experimental") {
      // Driven by which way the corridor is travelling, not by focusing a
      // picture — going deeper hides the bar, coming back out restores it
      const onDepth = (e: Event) => setHidden((e as CustomEvent).detail.deep)

      window.addEventListener("camera-depth", onDepth)
      return () => window.removeEventListener("camera-depth", onDepth)
    }
  }, [mode, isMobile])

  return hidden
}
