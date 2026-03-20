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
 * Updates the URL to reflect a mode change using window.history.pushState.
 * Does NOT trigger a Next.js navigation — keeps the SPA mounted so
 * AnimatePresence can animate exit/enter transitions between modes.
 */
export function pushModeUrl(mode: GalleryMode, filter: ImageFilter): void {
  if (typeof window === "undefined") return
  const url = new URL(`/${mode}`, window.location.origin)
  if (filter !== "all") url.searchParams.set("filter", filter)
  window.history.pushState({}, "", url.toString())
}
