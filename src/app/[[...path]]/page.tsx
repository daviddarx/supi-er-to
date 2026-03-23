import type { Metadata } from "next"
import { readFileSync } from "fs"
import { join } from "path"
import type { GalleryImage } from "@/types"
import ClientLoader from "./ClientLoader"

const SITE_URL = "https://supi-er-to.com"
const TITLE = "SUPI.ER.TO"
const DESCRIPTION = "BONE is dead — long live SUPI.ER.TO — Zürich"

function loadImages(): GalleryImage[] {
  const filePath = join(process.cwd(), "public", "data", "images.json")
  return JSON.parse(readFileSync(filePath, "utf-8"))
}

function getLatestImage(images: GalleryImage[]): GalleryImage {
  return images.sort((a, b) => b.date.localeCompare(a.date) || b.sortOrder - a.sortOrder)[0]
}

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

export function generateMetadata({ params }: { params: { path?: string[] } }): Metadata {
  const images = loadImages()
  const imageId = params.path?.[1]
  const detailImage = imageId ? images.find((img) => img.id === imageId) : null
  const ogImage = detailImage ?? getLatestImage(images)
  const ogImageUrl = `${SITE_URL}/images/${ogImage.id}.1280.webp`

  const title = detailImage ? `${detailImage.id} — ${TITLE}` : TITLE

  return {
    title,
    description: DESCRIPTION,
    openGraph: {
      title,
      description: DESCRIPTION,
      url: SITE_URL,
      siteName: TITLE,
      images: [
        {
          url: ogImageUrl,
          width: ogImage.width > 1280 ? 1280 : ogImage.width,
          height: Math.round(ogImage.height * (1280 / ogImage.width)),
          type: "image/webp",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: DESCRIPTION,
      images: [ogImageUrl],
    },
  }
}

/**
 * Thin server wrapper for the gallery pages.
 * All state and interactivity lives in GalleryPageClient.
 */
export default function GalleryPage() {
  return <ClientLoader />
}
