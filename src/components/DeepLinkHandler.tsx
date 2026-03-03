"use client"

import { useEffect } from "react"
import { getImageIdFromUrl, setImageUrl } from "@/lib/url-state"
import { findImageIndex } from "@/lib/images"
import type { GalleryImage } from "@/types"

interface DeepLinkHandlerProps {
  images: GalleryImage[]
  onOpenCarousel: (index: number) => void
}

/**
 * Handles the ?image={id} deep link URL parameter on initial image load.
 *
 * Reads the param directly from window.location (no useSearchParams needed)
 * so this component does not require its own Suspense boundary, though page.tsx
 * wraps it in one as a precaution.
 *
 * Behaviour:
 * - If images haven't loaded yet, waits (effect re-runs when images changes).
 * - If ?image= points to a valid image ID, opens the carousel at that index.
 * - If the ID is stale/invalid, clears the param to keep the URL clean.
 *
 * The eslint-disable on the dependency array is intentional: we only want to
 * trigger on the first time images is populated, not on every filter change.
 */
export function DeepLinkHandler({ images, onOpenCarousel }: DeepLinkHandlerProps) {
  useEffect(() => {
    // Wait until images have been fetched
    if (images.length === 0) return

    const id = getImageIdFromUrl()
    if (!id) return

    const index = findImageIndex(images, id)
    if (index === -1) {
      // ID in URL not found in current image set — clear the stale param
      setImageUrl(null)
      return
    }

    onOpenCarousel(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images])

  return null
}
