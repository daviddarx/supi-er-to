import ClientLoader from "./ClientLoader"

/**
 * Generates static params for the four gallery mode pages at build time.
 * Deep-link paths like /classic/supi-38 are handled at runtime via
 * Netlify _redirects (catch-all per mode), so they don't need static params.
 *
 * The [[...path]] optional catch-all matches:
 *   /classic          → path = ["classic"]
 *   /classic/supi-38  → path = ["classic", "supi-38"]
 */
export function generateStaticParams() {
  return [
    { path: ["classic"] },
    { path: ["grid"] },
    { path: ["explorative"] },
    { path: ["experimental"] },
  ]
}

/**
 * Thin server wrapper for the gallery pages.
 * All state and interactivity lives in GalleryPageClient.
 */
export default function GalleryPage() {
  return <ClientLoader />
}
