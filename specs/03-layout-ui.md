# Phase 3: Core Layout & UI

## 3.1 Root Layout

**File**: `src/app/layout.tsx`

Sets up fonts, providers, and initial dark mode. The `<html>` element gets the `dark` class by default. The dark mode toggle modifies this class client-side and persists to localStorage.

```typescript
import type { Metadata } from "next"
import { DM_Mono } from "next/font/google"
import "./globals.css"

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
})

export const metadata: Metadata = {
  title: "SUPI.ER.TO",
  description: "BONE is dead — long live SUPI.ER.TO — Zürich",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} dark`} suppressHydrationWarning>
      <body className="font-mono bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
```

`suppressHydrationWarning` is required because the dark mode class is set server-side as `dark` but may be overridden by localStorage on the client.

---

## 3.2 Header

**File**: `src/components/layout/Header.tsx`

```typescript
export function Header() {
  return (
    <header className="
      fixed top-3 left-3 z-50
      md:fixed
      max-md:static max-md:px-5 max-md:pt-4
    ">
      <h1 className="text-xs font-bold leading-tight tracking-tight">
        SUPI.ER.TO
      </h1>
      <p className="text-xs font-normal leading-tight text-muted-foreground">
        BONE is dead — long live SUPI.ER.TO — Zürich
      </p>
    </header>
  )
}
```

**Behavior**:
- Desktop (md+): `position: fixed`, top-left, z-index 50
- Mobile (below md): `position: static`, full-width, in document flow above the options bar
- Both lines: same `text-xs` font size. Title is `font-bold`.

---

## 3.3 OptionsBar

**File**: `src/components/layout/OptionsBar.tsx`

```typescript
interface OptionsBarProps {
  mode: GalleryMode
  filter: ImageFilter
  isDarkMode: boolean
  onModeChange: (mode: GalleryMode) => void
  onFilterChange: (filter: ImageFilter) => void
  onDarkModeToggle: () => void
  isAdmin?: boolean
  onNewPiece?: () => void
  onLogOut?: () => void
}
```

**Layout**:
- Desktop: `position: fixed`, top-right, z-50
- Mobile: `position: static`, in document flow below the header
- Single flex row, `gap-2`, all items vertically centered

```typescript
<div className="
  fixed top-3 right-3 z-50 flex items-center gap-2
  max-md:static max-md:px-5 max-md:py-3
">
  <ImageSetSelector filter={filter} onChange={onFilterChange} />
  <ModeSelector mode={mode} onChange={onModeChange} />
  <DarkModeToggle isDark={isDarkMode} onToggle={onDarkModeToggle} />
  {isAdmin && (
    <>
      <TooltipButton icon={<IconPlus />} label="New piece arrival" onClick={onNewPiece} />
      <TooltipButton icon={<IconLogOut />} label="Log out" onClick={onLogOut} />
    </>
  )}
</div>
```

---

## 3.4 ImageSetSelector

Uses shadcn `<Select>`. No custom trigger needed — use the default but style it to match the compact aesthetic.

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

<Select value={filter} onValueChange={onFilterChange}>
  <SelectTrigger className="h-8 text-xs border rounded-[2px] w-[120px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Everything</SelectItem>
    <SelectItem value="supi">SUPI.ER.TO</SelectItem>
    <SelectItem value="bone">BONE</SelectItem>
  </SelectContent>
</Select>
```

---

## 3.5 ModeSelector

Four icon-only buttons. Active mode button has a filled/distinct style.

```typescript
const MODES: Array<{ mode: GalleryMode; icon: React.ReactNode; label: string }> = [
  { mode: "classic", icon: <IconClassic />, label: "Classic" },
  { mode: "grid", icon: <IconGrid />, label: "Grid" },
  { mode: "explorative", icon: <IconExplorative />, label: "Explorative" },
  { mode: "experimental", icon: <IconExperimental />, label: "Experimental" },
]

<div className="flex items-center border rounded-[2px] overflow-hidden">
  {MODES.map(({ mode: m, icon, label }) => (
    <Tooltip key={m}>
      <TooltipTrigger asChild>
        <button
          onClick={() => onChange(m)}
          className={cn(
            "h-8 w-8 flex items-center justify-center transition-colors",
            "border-r last:border-r-0",
            m === mode
              ? "bg-foreground text-background"
              : "bg-transparent text-foreground hover:bg-muted"
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  ))}
</div>
```

---

## 3.6 DarkModeToggle

```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <button
      onClick={onToggle}
      className="h-8 w-8 flex items-center justify-center border rounded-[2px] hover:bg-muted"
    >
      {isDark ? <IconSun /> : <IconMoon />}
    </button>
  </TooltipTrigger>
  <TooltipContent side="bottom" className="text-xs">
    {isDark ? "Switch to light mode" : "Switch to dark mode"}
  </TooltipContent>
</Tooltip>
```

**Dark mode logic** (in `page.tsx`):

```typescript
const [isDarkMode, setIsDarkMode] = useState(true)

// On mount: read from localStorage
useEffect(() => {
  const saved = localStorage.getItem("theme")
  const isDark = saved ? saved === "dark" : true // default dark
  setIsDarkMode(isDark)
  document.documentElement.classList.toggle("dark", isDark)
}, [])

const toggleDarkMode = () => {
  const next = !isDarkMode
  setIsDarkMode(next)
  localStorage.setItem("theme", next ? "dark" : "light")
  document.documentElement.classList.toggle("dark", next)
}
```

---

## 3.7 TooltipButton (reusable)

**File**: `src/components/ui/TooltipButton.tsx`

```typescript
interface TooltipButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  className?: string
  variant?: "outline" | "ghost"
}

export function TooltipButton({ icon, label, onClick, className, variant = "ghost" }: TooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "h-8 w-8 flex items-center justify-center border rounded-[2px]",
            variant === "ghost" ? "hover:bg-muted" : "border hover:bg-muted",
            className
          )}
          aria-label={label}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  )
}
```

Wrap all icon-only buttons with this pattern for consistent tooltip behavior.

---

## 3.8 Custom SVG Icons

**File**: `src/components/ui/icons/index.tsx`

All icons: 24×24px, `stroke="currentColor"`, `strokeWidth={1.5}`, `fill="none"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.

```typescript
interface IconProps {
  className?: string
}

// ─── Gallery mode icons ───────────────────────────────────────────────────────

// Classic: three horizontal lines of different widths (stacked content)
export function IconClassic({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="5" />
      <rect x="4" y="11" width="16" height="5" />
      <rect x="4" y="18" width="10" height="2" />
    </svg>
  )
}

// Grid: masonry-like layout of rectangles
export function IconGrid({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="3" y="15" width="7" height="6" />
      <rect x="14" y="11" width="7" height="10" />
    </svg>
  )
}

// Explorative: scattered dots/cards at various angles
export function IconExplorative({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <rect x="3" y="8" width="8" height="6" transform="rotate(-8 7 11)" />
      <rect x="13" y="4" width="7" height="5" transform="rotate(6 16.5 6.5)" />
      <rect x="11" y="13" width="9" height="7" transform="rotate(-5 15.5 16.5)" />
    </svg>
  )
}

// Experimental: 3D wireframe cube (isometric)
export function IconExperimental({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z" />
      <path d="M12 3 L12 12" />
      <path d="M4 7.5 L12 12" />
      <path d="M20 7.5 L12 12" />
    </svg>
  )
}

// ─── Theme icons ──────────────────────────────────────────────────────────────

// Sun: circle with 8 rays
export function IconSun({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </svg>
  )
}

// Moon: crescent (circle with overlapping circle cut out)
export function IconMoon({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// ─── Action icons ─────────────────────────────────────────────────────────────

// Fullscreen: four corner arrows pointing outward
export function IconFullscreen({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

// Close: X
export function IconClose({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ArrowLeft: left-pointing chevron
export function IconArrowLeft({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

// ArrowRight: right-pointing chevron
export function IconArrowRight({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// Upload: arrow pointing up with cloud base
export function IconUpload({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

// LogOut: rectangle with arrow pointing right out of it
export function IconLogOut({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

// Plus: simple + sign
export function IconPlus({ className }: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
```

---

## 3.9 LoadableImage Component

**File**: `src/components/ui/LoadableImage.tsx`

```typescript
"use client"

import { useEffect, useRef, useState } from "react"
import { getImageSrc, type ImageSize } from "@/lib/images"
import { cn } from "@/lib/utils"

interface LoadableImageProps {
  id: string
  size: ImageSize
  alt: string
  aspectRatio?: number    // width/height, e.g. 4/3 = 1.333. If not provided, no fixed ratio.
  className?: string
  onClick?: () => void
}

export function LoadableImage({ id, size, alt, aspectRatio, className, onClick }: LoadableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Intersection Observer: start loading 200px before entering viewport
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
      { rootMargin: "200px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden",
        onClick && "cursor-pointer",
        className
      )}
      style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
    >
      {/* Placeholder background */}
      <div
        className="absolute inset-0 bg-white/5 dark:bg-white/5 light:bg-black/5"
        style={{ backgroundColor: "rgba(128, 128, 128, 0.05)" }}
      />

      {/* Image — only rendered when visible */}
      {isVisible && (
        <img
          src={getImageSrc(id, size)}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
        />
      )}
    </div>
  )
}
```

**Notes**:
- `aspectRatio` prop: when set, the container has a fixed aspect ratio box (placeholder maintains correct size before image loads). In Classic mode, we don't know aspect ratios upfront, so this is omitted and the container reflows on image load — acceptable.
- `object-cover` ensures images fill the container without distortion (especially important in Grid/masonry where thumbnails are cropped).
- Placeholder color: `rgba(128, 128, 128, 0.05)` works in both dark and light modes without needing conditional logic.

---

## 3.10 Mobile Layout

Mobile breakpoint: `max-md` (below 768px).

On mobile:
- Header: `static` position, full-width, `px-5 pt-4`
- OptionsBar: `static` position, displayed below header, `px-5 py-3`, same flex row layout
- Gallery: full-width, no centered max-width constraint needed (padding via container)
- Grid mode: single column (see Grid spec)
- Explorative: full viewport canvas (works the same)
- Experimental: full viewport canvas (works the same)
- Carousel: full screen (YARL is already responsive)

There is no separate mobile navigation. The flex row in OptionsBar wraps gracefully if needed (use `flex-wrap`).

---

## 3.11 Main Page Structure (page.tsx)

```typescript
"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Header } from "@/components/layout/Header"
import { OptionsBar } from "@/components/layout/OptionsBar"
import { CarouselOverlay } from "@/components/gallery/CarouselOverlay"

// Lazy-load heavy gallery modes
const ClassicGallery = dynamic(() => import("@/components/gallery/ClassicGallery"))
const GridGallery = dynamic(() => import("@/components/gallery/GridGallery"))
const ExplorativeGallery = dynamic(() => import("@/components/gallery/ExplorativeGallery"))
const ExperimentalGallery = dynamic(() => import("@/components/gallery/ExperimentalGallery"))

export default function GalleryPage() {
  // ... state management (see section 2.5)

  const renderGallery = () => {
    const props = {
      images: filteredImages,
      onImageClick: (index: number) => openCarousel(index),
    }

    switch (mode) {
      case "classic": return <ClassicGallery {...props} />
      case "grid": return <GridGallery {...props} />
      case "explorative": return <ExplorativeGallery {...props} />
      case "experimental": return <ExperimentalGallery images={filteredImages} />
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Fixed header + options — in-flow on mobile */}
        <div className="max-md:flex max-md:flex-col max-md:gap-0">
          <Header />
          <OptionsBar
            mode={mode}
            filter={filter}
            isDarkMode={isDarkMode}
            onModeChange={handleModeChange}
            onFilterChange={handleFilterChange}
            onDarkModeToggle={toggleDarkMode}
          />
        </div>

        {/* Gallery area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${filter}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderGallery()}
          </motion.div>
        </AnimatePresence>

        {/* Carousel overlay */}
        <CarouselOverlay
          images={filteredImages}
          initialIndex={carouselIndex}
          isOpen={carouselOpen}
          onClose={closeCarousel}
        />
      </div>
    </TooltipProvider>
  )
}
```

**Mode change cleanup**: When `mode` changes, the current gallery component unmounts (via AnimatePresence) and its `useEffect` cleanup runs — this handles Three.js disposal, RAF cancellation, etc.
