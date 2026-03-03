/**
 * Reads the ?image= query parameter from the current URL.
 * Returns null on the server or if the param is absent.
 */
export function getImageIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  return params.get("image")
}

/**
 * Pushes a new history state with or without the ?image= param.
 * Pass null to remove it.
 */
export function setImageUrl(id: string | null): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (id) {
    url.searchParams.set("image", id)
  } else {
    url.searchParams.delete("image")
  }
  window.history.pushState({}, "", url.toString())
}
