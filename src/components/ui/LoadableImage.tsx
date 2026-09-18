"use client"

import { useEffect, useRef, useState } from "react"
import { getImageSrc, type ImageSize } from "@/lib/images"
import { cn } from "@/lib/utils"

/** Module-level cache of image srcs that have already loaded — survives remounts. */
const loadedSrcs = new Set<string>()

/**
 * How far outside the viewport to start loading, as a share of viewport height.
 * Expressed relative rather than in pixels so it scales with the screen: in
 * Classic mode an image is most of a viewport tall, so this is a couple of
 * images of runway — enough to stay ahead of a quick scroll.
 */
const PRELOAD_MARGIN = "200% 0px"

interface LoadableImageProps {
  id: string
  size: ImageSize
  alt: string
  /** Intrinsic width in pixels — sets aspect-ratio on the container before the image loads. */
  width?: number
  /** Intrinsic height in pixels — sets aspect-ratio on the container before the image loads. */
  height?: number
  className?: string
  onClick?: () => void
  /** Override the computed image src (e.g. a local blob URL for optimistic display). */
  overrideSrc?: string
  /** When true, skip lazy loading — load immediately with high fetch priority (for LCP image). */
  priority?: boolean
  /** When true, skip IntersectionObserver — render img immediately (e.g. explorative canvas). */
  eager?: boolean
}

/**
 * Lazily-loaded image component using IntersectionObserver.
 * Fades in when loaded. Shows a muted placeholder while loading.
 * Starts loading well before the image enters the viewport (see PRELOAD_MARGIN).
 *
 * If intrinsic `width` and `height` are provided, the container holds its
 * aspect-ratio before the image loads, preventing layout shift (CLS).
 */
export function LoadableImage({
  id,
  size,
  alt,
  width,
  height,
  className,
  onClick,
  overrideSrc,
  priority = false,
  eager = false,
}: LoadableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const src = overrideSrc ?? getImageSrc(id, size)
  const alreadyCached = loadedSrcs.has(src)
  const skipLazy = priority || eager || alreadyCached
  const [isVisible, setIsVisible] = useState(skipLazy)
  const [isLoaded, setIsLoaded] = useState(alreadyCached)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (skipLazy) return
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: PRELOAD_MARGIN }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [skipLazy])

  // Use native aspect-ratio syntax (W/H) — avoids pre-dividing to a decimal
  const aspectRatioStyle =
    width && height && width > 0 && height > 0 ? { aspectRatio: `${width}/${height}` } : undefined

  return (
    <div
      ref={containerRef}
      data-image-id={id}
      onClick={onClick}
      onMouseEnter={
        onClick ? () => window.dispatchEvent(new CustomEvent("image-hover-start")) : undefined
      }
      onMouseLeave={
        onClick ? () => window.dispatchEvent(new CustomEvent("image-hover-end")) : undefined
      }
      className={cn("relative overflow-hidden", onClick && "cursor-pointer", className)}
      style={aspectRatioStyle}
    >
      {/* Placeholder background — always rendered, stays below the image */}
      {/* Placeholder — no z-index to avoid creating stacking contexts on every
           image (1800+ in explorative mode). Natural DOM order ensures the img
           rendered after this div paints on top. */}
      <div className="bg-muted/20 absolute inset-0" />

      {isVisible && !hasError && (
        <img
          src={src}
          alt={alt}
          onLoad={() => {
            loadedSrcs.add(src)
            setIsLoaded(true)
          }}
          onError={() => setHasError(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
          // The observer above is the lazy gate. Native lazy loading on top of
          // it is a second, blinder gate that can only hold the fetch back
          // further, so once we've decided to render, fetch now.
          loading="eager"
          decoding="async"
          {...(priority ? { fetchPriority: "high" } : {})}
        />
      )}
    </div>
  )
}
