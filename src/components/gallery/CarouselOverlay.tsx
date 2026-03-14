"use client"

// Note: yet-another-react-lightbox/styles.css is imported globally in globals.css.
// Do NOT import it here to avoid duplicate stylesheet loading.

import { useState, useMemo } from "react"
import Lightbox, { ImageSlide, useController } from "yet-another-react-lightbox"
import type { SlotStyles, RenderSlideProps } from "yet-another-react-lightbox"
import { cn } from "@/lib/utils"
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

// ─── FadeSlide ────────────────────────────────────────────────────────────────
// Wraps YARL's built-in ImageSlide with an opacity fade-in on image load.
// Defined outside CarouselOverlay to keep a stable reference — avoids YARL
// unmounting/remounting the slide component on every parent render.

function FadeSlide({ slide, rect }: RenderSlideProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      style={{
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.3s ease",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <ImageSlide slide={slide} rect={rect} onLoad={() => setLoaded(true)} />
    </div>
  )
}

// ─── NavButton ────────────────────────────────────────────────────────────────
// A proper React component (capital N) so it can legally call useController().
// render.buttonPrev / render.buttonNext render props return this as JSX —
// React treats it as a component tree, not a plain function call, so hooks work.

interface NavButtonProps {
  direction: "prev" | "next"
  btnClass: string
}

function NavButton({ direction, btnClass }: NavButtonProps) {
  const { prev, next } = useController()

  return (
    <button
      onClick={() => (direction === "prev" ? prev() : next())}
      className={cn(
        "absolute z-50 max-md:bottom-4 md:top-1/2 md:-translate-y-1/2",
        direction === "prev" ? "left-4" : "right-4",
        btnClass
      )}
      aria-label={direction === "prev" ? "Previous image" : "Next image"}
    >
      {direction === "prev" ? (
        <IconArrowLeft strokeWidth={1} />
      ) : (
        <IconArrowRight strokeWidth={1} />
      )}
    </button>
  )
}

// ─── CloseButton ──────────────────────────────────────────────────────────────
// Uses useController().close() so YARL plays its exit animation before calling
// the parent's onClose prop (which sets carouselOpen = false in page.tsx).
// Calling onClose() directly would flip open=false immediately, bypassing the
// exit transition.

interface CloseButtonProps {
  btnClass: string
}

function CloseButton({ btnClass }: CloseButtonProps) {
  const { close } = useController()

  return (
    <button
      onClick={() => close()}
      className={cn("absolute right-4 z-50 max-md:bottom-4 md:top-4", btnClass)}
      aria-label="Close"
    >
      <IconClose strokeWidth={1} />
    </button>
  )
}

// ─── CarouselOverlay ──────────────────────────────────────────────────────────

/**
 * Fullscreen carousel overlay powered by yet-another-react-lightbox (YARL).
 * Filter-aware: only cycles through the currently filtered image set.
 *
 * Purely presentational — URL management belongs entirely in GalleryPageClient.tsx.
 * openCarousel() pushes the path /{mode}/{id} via pushState, closeCarousel()
 * reverts to /{mode}; navigating prev/next within the carousel does NOT update
 * the URL (no history clutter).
 *
 * Custom render props replace YARL's default nav/close buttons with
 * project-styled controls matching the design system (0px radius, 1px border,
 * no shadows, custom SVG icons). NavButton and CloseButton are real React
 * components so they can call useController() hooks legally.
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
        src: img.previewSrc ?? getImageSrc(img.id, 2400),
        // Use actual intrinsic dimensions so YARL can compute the correct aspect ratio.
        // Fallbacks handle any transition period where images.json lacks dimensions.
        width: img.width ?? 2400,
        height: img.height ?? 1600,
      })),
    [images]
  )

  const backdropColor = isDarkMode ? "rgba(0, 0, 0, 0.95)" : "rgba(255, 255, 255, 0.95)"

  // 40×40px buttons matching the header buttons exactly.
  const btnClass =
    "flex h-10 w-10 cursor-pointer items-center justify-center border bg-transparent transition-colors has-hover:hover:bg-muted"

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
        slide: (props) => <FadeSlide {...props} />,
        buttonClose: () => <CloseButton key="close" btnClass={btnClass} />,
        buttonPrev: () => <NavButton key="prev" direction="prev" btnClass={btnClass} />,
        buttonNext: () => <NavButton key="next" direction="next" btnClass={btnClass} />,
      }}
      carousel={{ padding: "5%" }}
      animation={{ swipe: 300 }}
      controller={{ closeOnBackdropClick: true }}
    />
  )
}
