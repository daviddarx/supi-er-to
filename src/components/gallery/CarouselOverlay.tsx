"use client"

// Note: yet-another-react-lightbox/styles.css is imported globally in globals.css.
// Do NOT import it here to avoid duplicate stylesheet loading.

import { useMemo } from "react"
import Lightbox from "yet-another-react-lightbox"
import type { SlotStyles } from "yet-another-react-lightbox"
import { getImageSrc } from "@/lib/images"
import { IconArrowLeft, IconArrowRight, IconClose } from "@/components/ui/icons"
import type { GalleryImage } from "@/types"

interface CarouselOverlayProps {
  images: GalleryImage[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
  isDarkMode: boolean
}

/**
 * Fullscreen carousel overlay powered by yet-another-react-lightbox (YARL).
 * Filter-aware: only cycles through the currently filtered image set.
 *
 * Purely presentational — URL management belongs entirely in page.tsx.
 * openCarousel() sets ?image={id}, closeCarousel() removes it; navigating
 * prev/next within the carousel does NOT update the URL (no history clutter).
 *
 * Custom render props replace YARL's default nav/close buttons with
 * project-styled controls matching the design system (2px radius, 1px border,
 * no shadows, custom SVG icons).
 */
export function CarouselOverlay({
  images,
  initialIndex,
  isOpen,
  onClose,
  isDarkMode,
}: CarouselOverlayProps) {
  const slides = useMemo(
    () =>
      images.map((img) => ({
        src: getImageSrc(img.id, 2400),
        width: 2400,
        height: 1600, // 3:2 aspect ratio placeholder; actual dimensions are derived by YARL
      })),
    [images]
  )

  const backdropColor = isDarkMode ? "rgba(0, 0, 0, 0.95)" : "rgba(255, 255, 255, 0.95)"
  const iconColor = isDarkMode ? "#ffffff" : "#000000"

  // Shared button class for nav/close controls
  const btnClass =
    "flex h-9 w-9 items-center justify-center rounded-[2px] border border-current bg-background/20 transition-colors has-hover:hover:bg-background/40"

  return (
    <Lightbox
      open={isOpen}
      close={onClose}
      slides={slides}
      index={initialIndex}
      styles={
        {
          container: { backgroundColor: backdropColor },
          // Override YARL's CSS variable for the backdrop colour.
          // The `--yarl__*` keys satisfy SlotCSSProperties which extends React.CSSProperties.
          root: { "--yarl__color_backdrop": backdropColor },
        } as SlotStyles
      }
      render={{
        buttonClose: () => (
          <button
            key="close"
            onClick={onClose}
            className={`absolute top-4 right-4 z-50 ${btnClass}`}
            style={{ color: iconColor }}
            aria-label="Close"
          >
            <IconClose />
          </button>
        ),
        buttonPrev: () => (
          <button
            key="prev"
            className={`absolute top-1/2 left-4 z-50 -translate-y-1/2 ${btnClass}`}
            style={{ color: iconColor }}
            aria-label="Previous image"
          >
            <IconArrowLeft />
          </button>
        ),
        buttonNext: () => (
          <button
            key="next"
            className={`absolute top-1/2 right-4 z-50 -translate-y-1/2 ${btnClass}`}
            style={{ color: iconColor }}
            aria-label="Next image"
          >
            <IconArrowRight />
          </button>
        ),
      }}
      carousel={{ padding: "5%" }}
      animation={{ swipe: 300 }}
      controller={{ closeOnBackdropClick: true }}
    />
  )
}
