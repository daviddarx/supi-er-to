# Phase 7: Fullscreen Carousel & Deep Links

## Overview

Uses `yet-another-react-lightbox` (YARL) for the fullscreen carousel. It sits above all gallery modes as an overlay. Navigation respects the active image filter. A `?image={id}` URL param enables sharing individual images.

---

## 7.1 YARL Setup

```bash
npm install yet-another-react-lightbox
```

Import YARL styles globally in `src/app/globals.css` or `layout.tsx`:
```css
@import "yet-another-react-lightbox/styles.css";
```

---

## 7.2 CarouselOverlay Component

**File**: `src/components/gallery/CarouselOverlay.tsx`

```typescript
"use client"

import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import { getImageSrc } from "@/lib/images"
import { IconArrowLeft, IconArrowRight, IconClose } from "@/components/ui/icons"
import type { GalleryImage } from "@/types"

interface CarouselOverlayProps {
  images: GalleryImage[]        // already filtered set
  initialIndex: number
  isOpen: boolean
  onClose: () => void
  isDarkMode: boolean
}

export function CarouselOverlay({
  images,
  initialIndex,
  isOpen,
  onClose,
  isDarkMode,
}: CarouselOverlayProps) {
  const slides = images.map((img) => ({
    src: getImageSrc(img.id, 2400),
    // YARL uses width/height for layout — we provide approximate 3:2 as placeholder
    // Actual rendering adapts to image dimensions
    width: 2400,
    height: 1600,
  }))

  const backdropColor = isDarkMode
    ? "rgba(0, 0, 0, 0.85)"
    : "rgba(255, 255, 255, 0.85)"

  return (
    <Lightbox
      open={isOpen}
      close={onClose}
      slides={slides}
      index={initialIndex}
      styles={{
        container: { backgroundColor: backdropColor },
        root: { "--yarl__color_backdrop": backdropColor },
      }}
      render={{
        // Custom close button using our icon
        buttonClose: () => (
          <button
            onClick={onClose}
            className="
              absolute top-4 right-4 z-50
              h-9 w-9 flex items-center justify-center
              border border-current rounded-[2px]
              bg-background/20 hover:bg-background/40
              transition-colors
            "
            style={{ color: isDarkMode ? "#fff" : "#000" }}
            aria-label="Close"
          >
            <IconClose />
          </button>
        ),
        // Custom prev/next arrows using our icons
        buttonPrev: () => (
          <button
            className="
              absolute left-4 top-1/2 -translate-y-1/2 z-50
              h-9 w-9 flex items-center justify-center
              border border-current rounded-[2px]
              bg-background/20 hover:bg-background/40
              transition-colors
            "
            style={{ color: isDarkMode ? "#fff" : "#000" }}
            aria-label="Previous"
          >
            <IconArrowLeft />
          </button>
        ),
        buttonNext: () => (
          <button
            className="
              absolute right-4 top-1/2 -translate-y-1/2 z-50
              h-9 w-9 flex items-center justify-center
              border border-current rounded-[2px]
              bg-background/20 hover:bg-background/40
              transition-colors
            "
            style={{ color: isDarkMode ? "#fff" : "#000" }}
            aria-label="Next"
          >
            <IconArrowRight />
          </button>
        ),
      }}
      carousel={{
        padding: "5vw",  // 5vw padding around each image
      }}
      animation={{ swipe: 300 }}
      controller={{ closeOnBackdropClick: true }}
    />
  )
}
```

**Notes**:
- `slides` uses 2400px WebP (full size) for the best quality in fullscreen view
- Backdrop color changes with dark mode via inline `styles` prop
- Custom buttons use our icon system for visual consistency
- `carousel.padding: "5vw"` adds 5vw padding around images
- `controller.closeOnBackdropClick: true` allows clicking the backdrop to close
- Keyboard: YARL has built-in Esc + arrow key support

---

## 7.3 Filter-Aware Navigation

The `images` prop passed to `CarouselOverlay` is always the currently filtered set (`filteredImages` from `page.tsx`). YARL navigates within this array only.

Example: if filter is `supi`, only supi images are in `slides`. Prev/next cycles through supi images only.

This is the correct behavior because the parent passes the filtered array directly.

---

## 7.4 URL Deep Links

### Opening a specific image

When the user opens a carousel, we update the URL to `?image={id}`:

```typescript
// In page.tsx

const openCarousel = useCallback(
  (index: number) => {
    setCarouselIndex(index)
    setCarouselOpen(true)
    const imageId = filteredImages[index]?.id
    if (imageId) {
      setImageUrl(imageId) // from src/lib/url-state.ts
    }
  },
  [filteredImages]
)

const closeCarousel = useCallback(() => {
  setCarouselOpen(false)
  setImageUrl(null) // removes ?image= param
}, [])
```

### Reading deep link on page load

In Next.js App Router, `useSearchParams()` requires a `<Suspense>` boundary. Handle the deep link inside a dedicated client component:

```typescript
// src/components/DeepLinkHandler.tsx

"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { findImageIndex } from "@/lib/images"
import type { GalleryImage } from "@/types"

interface DeepLinkHandlerProps {
  images: GalleryImage[]  // filteredImages (currently "all" filter on initial load)
  onOpenCarousel: (index: number) => void
}

export function DeepLinkHandler({ images, onOpenCarousel }: DeepLinkHandlerProps) {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (images.length === 0) return // wait until images are loaded

    const imageId = searchParams.get("image")
    if (!imageId) return

    const index = findImageIndex(images, imageId)
    if (index !== -1) {
      onOpenCarousel(index)
    }
  }, [images, searchParams]) // re-run when images load

  return null // purely behavioral, no UI
}
```

Wrap in `<Suspense>` in `page.tsx`:

```tsx
<Suspense fallback={null}>
  <DeepLinkHandler
    images={filteredImages}
    onOpenCarousel={openCarousel}
  />
</Suspense>
```

### URL state behavior

| Action | URL Change |
|---|---|
| Open carousel | `/?image={id}` |
| Navigate prev/next in carousel | URL stays at initially opened image (simple) |
| Close carousel | `/` (param removed) |
| Navigate to `/?image={id}` directly | Opens default mode (Classic) + carousel at that image |

**Note on navigation within carousel**: Updating URL on every prev/next would create browser history entries for each image, which is annoying when pressing Back. Keep it simple — URL is set only when first opening, and removed on close.

---

## 7.5 YARL CSS Override

Add to `src/app/globals.css`:

```css
/* Remove YARL's default blue focus rings */
.yarl__root button:focus-visible {
  outline: 1px solid currentColor;
  outline-offset: 2px;
}

/* Override YARL container to ensure it sits above everything */
.yarl__root {
  z-index: 100;
}

/* Ensure our custom buttons don't conflict with YARL's overlay */
.yarl__container {
  padding: 0;
}
```

---

## 7.6 Integration Checklist

- [ ] `CarouselOverlay` rendered in `page.tsx` with `filteredImages`, `carouselIndex`, `carouselOpen`, `isDarkMode`
- [ ] `openCarousel(index)` updates both state and URL
- [ ] `closeCarousel()` resets both state and URL
- [ ] `<DeepLinkHandler>` wrapped in `<Suspense>` handles `?image=` on page load
- [ ] YARL styles imported globally
- [ ] Carousel tested with filter active: confirm prev/next only cycles within filtered set
- [ ] Deep link tested: navigate directly to `/?image=photos-00` → Classic mode + carousel at that image
