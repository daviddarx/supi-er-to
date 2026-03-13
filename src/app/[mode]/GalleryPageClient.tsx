"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useSession, signOut } from "next-auth/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Header } from "@/components/layout/Header"
import { OptionsBar } from "@/components/layout/OptionsBar"
import { NewPieceSheet } from "@/components/admin/NewPieceSheet"
import { ZoomCursor } from "@/components/ui/ZoomCursor"
import { fetchImages, filterImages, sortImages, findImageIndex } from "@/lib/images"
import {
  getImageIdFromPath,
  getFilterFromQuery,
  pushCarouselUrl,
  pushModeUrl,
} from "@/lib/url-state"
import type { GalleryImage, GalleryMode, ImageFilter } from "@/types"

// ─── Lazy-loaded gallery modes ────────────────────────────────────────────────
// Each mode is code-split to avoid loading Three.js, R3F, etc. upfront.

const ClassicGallery = dynamic(() => import("@/components/gallery/ClassicGallery"), { ssr: false })
const GridGallery = dynamic(() => import("@/components/gallery/GridGallery"), { ssr: false })
const ExplorativeGallery = dynamic(() => import("@/components/gallery/ExplorativeGallery"), {
  ssr: false,
})
const ExperimentalGallery = dynamic(() => import("@/components/gallery/ExperimentalGallery"), {
  ssr: false,
})
const CarouselOverlay = dynamic(
  () =>
    import("@/components/gallery/CarouselOverlay").then((m) => ({ default: m.CarouselOverlay })),
  { ssr: false }
)

const VALID_MODES: GalleryMode[] = ["classic", "grid", "explorative", "experimental"]

/**
 * Main gallery client component — rendered for /classic, /grid, /explorative, /experimental.
 *
 * Manages all shared state:
 * - images (fetched + sorted)
 * - active gallery mode (derived from [mode] URL segment via useParams)
 * - active image filter (from ?filter= query param)
 * - dark/light mode (synced to localStorage)
 * - carousel open state + current index
 *
 * Deep links (/classic/supi-198): handled by reading window.location.pathname
 * after images load. Netlify rewrites /classic/* → /classic so these URLs are
 * served by the same static page; client reads the path on hydration.
 *
 * Browser back/forward: popstate listener keeps carousel state in sync with
 * the pushState history entries written by openCarousel / closeCarousel.
 */
export function GalleryPageClient() {
  const router = useRouter()
  const params = useParams<{ mode: string }>()
  const { data: session } = useSession()
  const isAdmin = !!session

  // Derive mode directly from the [mode] URL segment — no local state needed.
  // useParams() stays live if the segment changes (e.g. programmatic navigation),
  // whereas a useState initializer would only run once on mount.
  const rawMode = params?.mode as GalleryMode
  const mode: GalleryMode = VALID_MODES.includes(rawMode) ? rawMode : "classic"

  // Read initial filter from ?filter= query param
  const [filter, setFilter] = useState<ImageFilter>(() => getFilterFromQuery())

  const [images, setImages] = useState<GalleryImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [carouselOpen, setCarouselOpen] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [newPieceSheetOpen, setNewPieceSheetOpen] = useState(false)

  // Derived: filtered image list passed to all gallery components
  const filteredImages = useMemo(() => filterImages(images, filter), [images, filter])

  // Sync React state with the theme already applied by the inline <head> script
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
  // (e.g. /classic/supi-198 → open carousel at supi-198).
  // Only runs once on initial image load — not on every filter change.
  //
  // We search the full unfiltered `images` array first: if the linked image
  // exists but isn't in the current filtered set (e.g. /classic/supi-198?filter=bone),
  // we clear the filter so the carousel can open it rather than silently failing.
  useEffect(() => {
    if (images.length === 0) return

    const imageId = getImageIdFromPath()
    if (!imageId) return

    // Check existence in the full set first
    const existsInFull = findImageIndex(images, imageId) !== -1
    if (!existsInFull) {
      // Stale / unknown ID — clear the path segment so the URL is clean
      pushCarouselUrl(mode, null, filter)
      return
    }

    // Image exists — ensure it's visible by clearing any conflicting filter
    let targetImages = filteredImages
    if (findImageIndex(filteredImages, imageId) === -1) {
      // Image is filtered out; reset the filter so it becomes visible
      setFilter("all")
      window.history.replaceState({}, "", `/${mode}`)
      targetImages = images
    }

    const index = findImageIndex(targetImages, imageId)
    setCarouselIndex(index)
    setCarouselOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images])

  // Handle browser back/forward navigation.
  // pushState writes to history when the carousel opens/closes. When the user
  // presses Back (from /classic/supi-198 → /classic), we close the carousel;
  // pressing Forward re-opens it.
  //
  // We search the full `images` array (not filteredImages) so that back/forward
  // works even after the user has changed the filter. If the target image is
  // present in the full set but not in the current filtered set, we clear the
  // filter so the image becomes visible before opening the carousel.
  useEffect(() => {
    const onPopState = () => {
      const imageId = getImageIdFromPath()
      if (!imageId) {
        setCarouselOpen(false)
        return
      }

      // First check the full unfiltered set
      const fullIndex = findImageIndex(images, imageId)
      if (fullIndex === -1) {
        // Unknown ID — close the carousel
        setCarouselOpen(false)
        return
      }

      // Check if image is visible in the current filtered set
      const filteredIndex = findImageIndex(filteredImages, imageId)
      if (filteredIndex !== -1) {
        setCarouselIndex(filteredIndex)
        setCarouselOpen(true)
      } else {
        // Image exists but is filtered out — clear the filter so it's visible
        setFilter("all")
        // After clearing filter, the full images array becomes the carousel list.
        // Use the full index since filteredImages will equal images once filter is "all".
        setCarouselIndex(fullIndex)
        setCarouselOpen(true)
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [images, filteredImages])

  const toggleDarkMode = useCallback(() => {
    const next = !isDarkMode
    setIsDarkMode(next)
    localStorage.setItem("theme", next ? "dark" : "light")
    document.documentElement.classList.toggle("dark", next)
  }, [isDarkMode])

  /**
   * Opens the carousel at a given index within the current filtered set,
   * and pushes the image ID to the URL for deep linking.
   */
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

  /**
   * Switches gallery mode via Next.js router (real navigation to /[mode]).
   * Preserves the current filter in the URL query string.
   *
   * No setMode() call needed: router.push() triggers a full component remount
   * and the new instance derives mode from useParams. Calling setMode() here
   * would be a no-op (unmount discards local state) and causes a warning.
   */
  const handleModeChange = useCallback(
    (newMode: GalleryMode) => {
      pushModeUrl(newMode, filter, router)
    },
    [filter, router]
  )

  /**
   * Updates the filter via replaceState (no navigation).
   * Keeps the user on the same mode page.
   * Closes the carousel when the filter changes — the previously open index
   * may no longer be valid in the new filtered set.
   */
  const handleFilterChange = useCallback((newFilter: ImageFilter) => {
    setFilter(newFilter)
    setCarouselOpen(false)
    const url = new URL(window.location.href)
    if (newFilter === "all") {
      url.searchParams.delete("filter")
    } else {
      url.searchParams.set("filter", newFilter)
    }
    window.history.replaceState({}, "", url.toString())
  }, [])

  /**
   * Called by the admin panel after a successful upload.
   * Closes the sheet and adds the new image (with its local blob URL for
   * optimistic display) to the front of the list without a page reload.
   */
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
        {/* Sticky header unit — Header + OptionsBar stick together as one block */}
        <div className="bg-background sticky top-0 z-50 flex flex-col">
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
            onLogOut={() => signOut({ callbackUrl: "/classic" })}
          />
        </div>

        {/* Gallery — fades between mode/filter changes */}
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

        {/* Zoom cursor — follows mouse over images in Classic, Grid, Explorative modes */}
        <ZoomCursor mode={mode} />

        {/* Fullscreen carousel overlay */}
        <CarouselOverlay
          images={filteredImages}
          initialIndex={carouselIndex}
          isOpen={carouselOpen}
          onClose={closeCarousel}
          isDarkMode={isDarkMode}
        />

        {/* Admin upload sheet — only mounted when the user is authenticated */}
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
