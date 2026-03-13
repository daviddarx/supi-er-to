import { GalleryPageClient } from "./GalleryPageClient"

/**
 * Generates static params for all four gallery mode pages at build time.
 * This keeps the mode pages fully static (no SSR cold starts on Netlify).
 *
 * Must live in the server component (page.tsx) — Next.js does not allow
 * generateStaticParams to be co-located with a "use client" component.
 */
export function generateStaticParams() {
  return [{ mode: "classic" }, { mode: "grid" }, { mode: "explorative" }, { mode: "experimental" }]
}

/**
 * Thin server wrapper for the gallery pages (/classic, /grid, /explorative, /experimental).
 * All state and interactivity lives in GalleryPageClient.
 */
export default function GalleryPage() {
  return <GalleryPageClient />
}
