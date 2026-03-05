"use client"

import dynamic from "next/dynamic"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useSession, signOut } from "next-auth/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Header } from "@/components/layout/Header"
import { OptionsBar } from "@/components/layout/OptionsBar"
import { NewPieceSheet } from "@/components/admin/NewPieceSheet"
import { fetchImages, filterImages, sortImages } from "@/lib/images"
import { setImageUrl } from "@/lib/url-state"
import type { GalleryImage, GalleryMode, ImageFilter } from "@/types"

// ─── Lazy-loaded gallery modes ────────────────────────────────────────────────
// Each mode is code-split to avoid loading Three.js, R3F, etc. upfront.

const ClassicGallery = dynamic(() => import("@/components/gallery/ClassicGallery"), {
  ssr: false,
})

const GridGallery = dynamic(() => import("@/components/gallery/GridGallery"), {
  ssr: false,
})

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

const DeepLinkHandler = dynamic(
  () => import("@/components/DeepLinkHandler").then((m) => ({ default: m.DeepLinkHandler })),
  { ssr: false }
)

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * Root gallery page. Manages all shared state:
 * - images (fetched + sorted)
 * - active gallery mode
 * - active image filter
 * - dark/light mode (synced to localStorage)
 * - carousel open state + current index
 */
export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [mode, setMode] = useState<GalleryMode>("classic")
  const [filter, setFilter] = useState<ImageFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [carouselOpen, setCarouselOpen] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [newPieceSheetOpen, setNewPieceSheetOpen] = useState(false)

  const { data: session } = useSession()
  const isAdmin = !!session

  // Derived: filtered image list passed to all gallery components
  const filteredImages = useMemo(() => filterImages(images, filter), [images, filter])

  // Restore theme from localStorage on mount (avoids flash)
  useEffect(() => {
    const saved = localStorage.getItem("theme")
    // Default to dark if no preference saved
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
      if (imageId) setImageUrl(imageId)
    },
    [filteredImages]
  )

  const closeCarousel = useCallback(() => {
    setCarouselOpen(false)
    setImageUrl(null)
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
        {/* Header + OptionsBar — fixed on desktop, in-flow on mobile */}
        <div className="max-md:flex max-md:flex-col">
          <Header />
          <OptionsBar
            mode={mode}
            filter={filter}
            isDarkMode={isDarkMode}
            onModeChange={setMode}
            onFilterChange={setFilter}
            onDarkModeToggle={toggleDarkMode}
            isAdmin={isAdmin}
            onNewPiece={() => setNewPieceSheetOpen(true)}
            onLogOut={() => signOut({ callbackUrl: "/" })}
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

        {/* Fullscreen carousel overlay */}
        <Suspense fallback={null}>
          <CarouselOverlay
            images={filteredImages}
            initialIndex={carouselIndex}
            isOpen={carouselOpen}
            onClose={closeCarousel}
            isDarkMode={isDarkMode}
          />
        </Suspense>

        {/* Deep link handler — reads ?image= on mount */}
        <Suspense fallback={null}>
          <DeepLinkHandler images={filteredImages} onOpenCarousel={openCarousel} />
        </Suspense>

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
