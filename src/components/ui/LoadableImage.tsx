"use client"

import { useEffect, useRef, useState } from "react"
import { getImageSrc, type ImageSize } from "@/lib/images"
import { cn } from "@/lib/utils"

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
}

/**
 * Lazily-loaded image component using IntersectionObserver.
 * Fades in when loaded. Shows a muted placeholder while loading.
 * Loads the image 200px before it enters the viewport for smoother UX.
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
}: LoadableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      // Start loading 200px before the image enters the viewport
      { rootMargin: "200px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Use native aspect-ratio syntax (W/H) — avoids pre-dividing to a decimal
  const aspectRatioStyle =
    width && height && width > 0 && height > 0 ? { aspectRatio: `${width}/${height}` } : undefined

  return (
    <div
      ref={containerRef}
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
          src={overrideSrc ?? getImageSrc(id, size)}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
        />
      )}
    </div>
  )
}
