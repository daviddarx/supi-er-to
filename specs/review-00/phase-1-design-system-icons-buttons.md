# Phase 1 — Design System, Icons, Buttons

Implementation plan for the first review pass. Covers global CSS tokens, favicon, dark-mode flash fix, scrollbar styling, icon redesigns, ButtonGroup component, and OptionsBar refactor.

---

## Table of Contents

1. [Border Radius — Remove Completely](#1-border-radius--remove-completely)
2. [Border Color — Light Mode Opacity Fix](#2-border-color--light-mode-opacity-fix)
3. [Typography — Base Size 12px → 14px](#3-typography--base-size-12px--14px)
4. [Gutter CSS Variable](#4-gutter-css-variable)
5. [Dark Mode Flash Fix](#5-dark-mode-flash-fix)
6. [Scrollbar Styling](#6-scrollbar-styling)
7. [Favicon](#7-favicon)
8. [Icon Redesigns](#8-icon-redesigns)
9. [ButtonGroup Component](#9-buttongroup-component)
10. [OptionsBar Refactor](#10-optionsbar-refactor)
11. [Select Transparency](#11-select-transparency)
12. [Execution Order & Gotchas](#12-execution-order--gotchas)

---

## 1. Border Radius — Remove Completely

**File**: `src/app/globals.css`

### Current state

```css
@theme inline {
  --radius-sm: 2px;
  --radius-md: 2px;
  --radius-lg: 2px;
  --radius-xl: 2px;
  --radius-2xl: 2px;
  --radius-3xl: 2px;
  --radius-4xl: 2px;
}

:root {
  --radius: 2px;
}

@layer base {
  * {
    border-radius: 2px;
  }
}
```

### Required change

Replace every radius value with `0`. The `@layer base` wildcard rule and the `:root --radius` variable both need to change:

```css
@theme inline {
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-xl: 0px;
  --radius-2xl: 0px;
  --radius-3xl: 0px;
  --radius-4xl: 0px;
}

:root {
  --radius: 0px;
  /* ... rest of :root unchanged */
}

@layer base {
  * {
    @apply border-border;
    box-shadow: none !important;
    border-radius: 0;
  }
}
```

### Downstream cleanup

After this change, search the entire `src/` tree for hardcoded `rounded-[2px]` Tailwind classes and remove them — they will be redundant. Known occurrences:

- `src/components/layout/OptionsBar.tsx` line 63: `rounded-[2px]` on `SelectTrigger`
- `src/components/layout/OptionsBar.tsx` line 74: `rounded-[2px]` on the mode switcher wrapper div
- `src/components/layout/OptionsBar.tsx` lines 104, 122, 136: `rounded-[2px]` on standalone buttons

Also check:
- `src/components/ui/tooltip.tsx` — `rounded-md` on `TooltipContent` and `rounded-[2px]` on the `Arrow`
- `src/components/ui/select.tsx` — `rounded-md`, `rounded-sm` throughout
- Any other `rounded-*` Tailwind utility in `src/components/`

Run `grep -r "rounded-" src/` after the CSS change to build a complete list. Remove or replace each one with `rounded-none` where Tailwind overrides are needed, or simply let the `border-radius: 0` wildcard rule take effect. Prefer removing the class rather than adding `rounded-none` since the base rule already sets 0.

**Gotcha**: `overflow: hidden` on rounded containers sometimes also serves a clipping purpose (e.g. the mode-switcher button group div uses `overflow-hidden rounded-[2px]`). After removing radius, `overflow-hidden` on that wrapper div is no longer needed for visual rounding — but it was there to clip child border-right on the last button. Verify the button group still looks correct and remove `overflow-hidden` if it is no longer serving a purpose (it will be replaced by the ButtonGroup component in step 9 anyway).

---

## 2. Border Color — Light Mode Opacity Fix

**File**: `src/app/globals.css`

### Current state

```css
/* Light mode */
:root {
  --border: oklch(0.922 0 0);   /* plain grey, not opacity-based */
  --input: oklch(0.922 0 0);
}

/* Dark mode */
.dark {
  --border: oklch(1 0 0 / 10%);  /* already opacity-based */
  --input: oklch(1 0 0 / 15%);
}
```

### Required change

Update light mode `--border` and `--input` to use opacity-based black so they adapt naturally if any parent background ever changes:

```css
:root {
  /* ... other variables ... */
  --border: oklch(0 0 0 / 12%);
  --input: oklch(0 0 0 / 12%);
  --ring: oklch(0 0 0 / 30%);
}
```

`oklch(0 0 0 / 12%)` is pure black at 12% opacity, which renders visually close to the previous `oklch(0.922 0 0)` on a white background while being opacity-based.

**Gotcha**: `--input` is used as the background of the Select trigger in dark mode via `dark:bg-input/30`. In light mode it was used as a border value. After this change, `--input` in light mode is `oklch(0 0 0 / 12%)` — the same as `--border`. This is fine; both convey the same visual intent (a subtle border/divider tone).

---

## 3. Typography — Base Size 12px → 14px

**File**: `src/app/globals.css`

### Current state

```css
@layer base {
  body {
    @apply bg-background text-foreground font-mono antialiased;
  }
}
```

No explicit `font-size` is set on `body`, so the browser default (16px) applies. The `text-xs` utility (12px) is used pervasively in component-level class names to make everything small.

### Required change

Set `font-size: 14px` as the base on `body` (or equivalently `text-sm`) and remove explicit `text-xs` overrides from components that should inherit body size. This is a two-part change:

**Part A — globals.css:**

```css
@layer base {
  body {
    @apply bg-background text-foreground font-mono antialiased;
    font-size: 14px;
  }
}
```

**Part B — remove explicit `text-xs` from components that should inherit:**

Run `grep -r "text-xs" src/` to find all occurrences. For each one, decide:
- If it is on a button label, tooltip, or general UI text that should be 14px → remove `text-xs`
- If it is intentionally smaller (e.g. a metadata caption, a helper label that should remain 12px) → keep it

Known occurrences in `OptionsBar.tsx` that should be removed:
- `SelectTrigger`: `text-xs` → remove
- `TooltipContent`: `text-xs` → remove (tooltip text should inherit 14px)

**Gotcha**: `TooltipContent` in `src/components/ui/tooltip.tsx` already includes `text-xs` in its base class string. This must be removed from the component source, not just from call sites:

```tsx
// In tooltip.tsx, change:
"... text-xs text-balance"
// to:
"... text-balance"
```

Similarly, shadcn's `SelectLabel` and `SelectItem` in `select.tsx` use `text-xs` / `text-sm`. Leave `text-sm` (14px) alone — it now matches the base. Remove `text-xs` from `SelectLabel` if labels should match body size.

---

## 4. Gutter CSS Variable

### Goal

Centralize the 20px page gutter as `--gutter: 20px` so it can be changed in one place.

### Files to modify

**A. `src/app/globals.css` — declare the variable:**

Add `--gutter: 20px` in both the `:root` block and `.dark` block, or simply in `:root` since it is not theme-dependent:

```css
:root {
  --gutter: 20px;
  --radius: 0px;
  --background: oklch(1 0 0);
  /* ... rest unchanged ... */
}
```

**B. `src/app/globals.css` — masonry grid uses hardcoded 20px:**

```css
/* Current */
.masonry-grid {
  display: flex;
  margin-left: -20px;
  width: auto;
}

.masonry-grid_column {
  padding-left: 20px;
  background-clip: padding-box;
}

/* Updated */
.masonry-grid {
  display: flex;
  margin-left: calc(-1 * var(--gutter));
  width: auto;
}

.masonry-grid_column {
  padding-left: var(--gutter);
  background-clip: padding-box;
}
```

**C. `src/components/gallery/ClassicGallery.tsx`:**

```tsx
// Current
<main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-20 md:py-16">

// Updated — replace px-5 with px-[var(--gutter)]
<main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-[var(--gutter)] py-20 md:py-16">
```

**D. `src/components/gallery/GridGallery.tsx`:**

```tsx
// Current
<div ref={containerRef} className="mx-auto max-w-[2000px] px-5 py-20 md:py-16">

// Updated
<div ref={containerRef} className="mx-auto max-w-[2000px] px-[var(--gutter)] py-20 md:py-16">
```

**E. `src/components/layout/Header.tsx`:**

```tsx
// Current
<header className="fixed top-3 left-3 z-50 max-md:static max-md:px-5 max-md:pt-4">

// Updated
<header className="fixed top-3 left-3 z-50 max-md:static max-md:px-[var(--gutter)] max-md:pt-4">
```

**F. `src/components/layout/OptionsBar.tsx`:**

```tsx
// Current
<div className="fixed top-3 right-3 z-50 flex flex-wrap items-center gap-2 max-md:static max-md:px-5 max-md:py-3">

// Updated
<div className="fixed top-3 right-3 z-50 flex flex-wrap items-center gap-2 max-md:static max-md:px-[var(--gutter)] max-md:py-3">
```

**Gotcha**: Tailwind v4 does not ship a built-in `px-gutter` utility. The `px-[var(--gutter)]` arbitrary value syntax works in Tailwind v4. Do not attempt to register a custom plugin for this — the CSS variable in an arbitrary value is sufficient.

---

## 5. Dark Mode Flash Fix

### Problem

`src/app/page.tsx` reads `localStorage` in a `useEffect` and calls `document.documentElement.classList.toggle("dark", isDark)`. This runs after React hydration, meaning the page briefly renders with the class hardcoded in `layout.tsx` (`className="... dark"`) before the user preference is applied. If the user has saved "light" in localStorage, they see a flash of dark before light kicks in.

### Solution

Add an inline `<script>` to `<head>` in `src/app/layout.tsx` that runs synchronously before HTML is painted. Use `dangerouslySetInnerHTML`. The script reads localStorage and applies or removes the `.dark` class on `<html>` immediately.

**File**: `src/app/layout.tsx`

### Current state

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} dark`} suppressHydrationWarning>
      <body className="bg-background text-foreground font-mono antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### Required change

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} dark`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var isDark = saved ? saved === 'dark' : true;
                  document.documentElement.classList.toggle('dark', isDark);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-background text-foreground font-mono antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### Why this works

- The `<script>` is not `async` or `defer`, so it runs synchronously during HTML parsing, before the browser paints anything.
- The `try/catch` guards against environments where localStorage is blocked (private browsing, SSR).
- `suppressHydrationWarning` on `<html>` is already present — it suppresses the React warning about the class attribute mismatch between server render (always `dark`) and client after the script runs.
- The default remains dark: `saved ? saved === 'dark' : true` defaults to true (dark) when no preference is saved.

### Cleanup in page.tsx

After adding the layout script, the `useEffect` in `page.tsx` that handles the initial dark mode restoration can be simplified. The effect still needs to run to sync React state (`setIsDarkMode`) with the already-applied DOM class, but it no longer needs to call `document.documentElement.classList.toggle` on mount — the DOM is already correct. Update the mount effect to only read the value, not re-apply it:

```tsx
// In page.tsx useEffect for theme
useEffect(() => {
  const saved = localStorage.getItem("theme")
  const isDark = saved ? saved === "dark" : true
  setIsDarkMode(isDark)
  // Do NOT call classList.toggle here — layout script already handled it
}, [])
```

The `handleDarkModeToggle` callback still calls `classList.toggle` on user interaction — that is correct and should not change.

---

## 6. Scrollbar Styling

**File**: `src/app/globals.css`

Add the following to `@layer base` (or below it, in the global scope):

```css
@layer base {
  html {
    scrollbar-gutter: stable;
  }

  body {
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  /* WebKit (Chrome, Safari, Edge) */
  ::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background-color: var(--border);
    border-radius: 0;
  }
}
```

### Why `html` not `body` for `scrollbar-gutter`

`scrollbar-gutter: stable` must be set on the element that has the scrollbar, which is the `<html>` element when using the default browser scroll. Setting it on `body` alone is often ignored.

### Scroll lock conflict with Radix

When Radix/shadcn opens a modal, sheet, or select dropdown, it adds `overflow: hidden` to `<body>`. This removes the scrollbar and causes a layout shift even with `scrollbar-gutter: stable` because `scrollbar-gutter` only reserves space when the scrollbar is rendered in `auto` overflow mode — it does not prevent Radix from forcibly removing it.

**Fix at the component level**: On Sheet, Dialog, or any Radix component that triggers scroll lock, pass the `scrollBehavior` or disable the lock:

For `@radix-ui/react-dialog` (used by shadcn Sheet):
```tsx
// In src/components/ui/sheet.tsx (or dialog.tsx), add to the Content component:
<SheetPrimitive.Content
  onOpenAutoFocus={...}
  // Disable Radix scroll lock:
  // Not directly supported via prop — use CSS approach instead
/>
```

Since Radix does not expose a prop to disable scroll lock on most primitives, the reliable CSS approach is:

```css
/* In globals.css */
body[style*="overflow: hidden"] {
  overflow: hidden !important;
  padding-right: 0 !important; /* Radix adds padding-right to compensate; zero it out */
}
```

Or, if the app uses `@radix-ui/react-scroll-area`, disable the scroll lock via the `preventScrollRestoration` or equivalent prop where available.

**Practical guidance**: Test the admin Sheet (NewPieceSheet) and the Select dropdown after applying `scrollbar-gutter`. If no shift is visible, no further fix is needed. If shift occurs, add the CSS override above.

---

## 7. Favicon

**File to create**: `src/app/icon.svg` (Next.js App Router convention for SVG favicon)

Next.js App Router supports `icon.svg` in the `app/` directory as a favicon source. This replaces the existing `public/favicon.ico`.

### Design

- 32×32 viewBox (or use `0 0 32 32`)
- Black background rectangle filling the entire viewBox
- Letters "SU" in DM Mono bold, white, centered
- Font size: 16px at 32×32 gives good legibility; at render the browser scales it

### SVG source

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" fill="black"/>
  <text
    x="16"
    y="22"
    text-anchor="middle"
    font-family="'DM Mono', ui-monospace, monospace"
    font-weight="700"
    font-size="16"
    fill="white"
    letter-spacing="-0.5"
  >SU</text>
</svg>
```

**Gotcha**: Favicons are rendered by the browser without access to the page's loaded web fonts. `DM Mono` will not be available unless it is embedded. For a fallback-safe favicon, either:

**Option A — embed font subset as base64 data URI in the SVG** (ideal but complex):
Use a tool like `fonttools` or an online base64 font embedder to embed only the characters S, U from DM Mono Bold into the SVG as a `<style>` block with `@font-face`.

**Option B — use system monospace as fallback** (simpler, acceptable):
The fallback `ui-monospace, monospace` will render in the system monospace font (Menlo/Consolas/Courier). The letters SU in any monospace bold font are recognizable at favicon size.

**Option C — use path data** (most reliable):
Convert "SU" in DM Mono Bold at ~16px to SVG path data. This embeds the letter shapes directly with no font dependency. This is the recommended approach for production.

To generate path data: open a design tool (Figma, Inkscape), set text "SU" in DM Mono Bold 16px, convert to outlines, copy the `<path d="...">` elements, and center them at (16, 16) within the 32×32 box.

### Placement

Place the file at `src/app/icon.svg`. Next.js will serve it as `/favicon.ico` and also as `<link rel="icon">` automatically via its metadata conventions.

The existing `public/favicon.ico` can be deleted once `src/app/icon.svg` is verified working.

---

## 8. Icon Redesigns

**File**: `src/components/ui/icons/index.tsx`

### Global change: strokeWidth 1.5 → 1

Every icon in the file uses `strokeWidth={1.5}`. Change all to `strokeWidth={1}`.

Find and replace all `strokeWidth={1.5}` → `strokeWidth={1}` in the file.

### Pixel alignment requirement

All path coordinates must land on whole-pixel or half-integer (0.5) boundaries within the 24×24 viewBox. This prevents sub-pixel antialiasing blur on 1:1 display pixel ratios. On Retina/HiDPI screens this is less critical, but it is still good practice.

---

### 8.1 IconClassic — Redesign

**Concept**: 3 equal-sized rectangles stacked vertically, uniform width and height, equal gaps between them.

**Current (broken) version**:
```svg
<rect x="4" y="4" width="16" height="5" />   <!-- 5px tall -->
<rect x="4" y="11" width="16" height="5" />  <!-- 5px tall -->
<rect x="4" y="18" width="10" height="2" />  <!-- 2px tall, narrower — WRONG -->
```

**Calculation for redesign**:
- Canvas: 24×24
- 3 rectangles of equal width and height
- Margins: 4px left, 4px right → usable width = 16px
- Total vertical space: 24px; top margin = 3px, bottom margin = 3px → usable height = 18px
- 3 rectangles + 2 gaps must fill 18px
- Let rect height = h, gap = g: `3h + 2g = 18`
- Choose g = 2 (clean small gap): `3h = 14` → h = 4.67 (not integer)
- Choose g = 3: `3h = 9` → h = 3 (integer, clean)
- Verify: 3×3 + 2×3 = 9 + 6 = 15 ≠ 18. Off by 3.
- Adjust top/bottom margin to 4.5px each: 24 - 9 - 3 - 3 = 24 - 15 = 9 / 2 = 4.5px margin (valid, half-pixel)
- Or choose different proportions: top margin = 3, bottom margin = 3, rects = 4px each, gaps = 3px: 3 + 4+3+4+3+4 + 3 = 24. Exact.

**Final coordinates** (3 rectangles of 16×4, gaps of 3px, 3px margins top/bottom):

```
Rect 1: x=4, y=3,  width=16, height=4
Rect 2: x=4, y=10, width=16, height=4
Rect 3: x=4, y=17, width=16, height=4
```

Verification: y1=3, h=4, gap=3 → y2 = 3+4+3 = 10. y2=10, h=4, gap=3 → y3 = 10+4+3 = 17. y3+h = 17+4 = 21. Bottom margin = 24-21 = 3. Top margin = 3. Symmetric. All whole pixels.

**Updated component**:

```tsx
export function IconClassic({ className }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="3" width="16" height="4" />
      <rect x="4" y="10" width="16" height="4" />
      <rect x="4" y="17" width="16" height="4" />
    </svg>
  )
}
```

---

### 8.2 IconExplorative — Redesign

**Concept**: 3 rectangles of different sizes in a scattered composition, NO rotation transforms, slight overlap, with the overlapping region clipped so back rectangles are hidden behind front ones (depth illusion via clip paths).

**Current version** (uses rotation transforms — remove these):
```svg
<rect x="3" y="8" width="8" height="6" transform="rotate(-8 7 11)" />
<rect x="13" y="4" width="7" height="5" transform="rotate(6 16.5 6.5)" />
<rect x="11" y="13" width="9" height="7" transform="rotate(-5 15.5 16.5)" />
```

**New layout** — 3 axis-aligned rectangles with slight overlap, no rotation:

The three rectangles are designed to feel scattered at different positions and sizes, reading as "images pinned to a board":

```
Rect A (small, top-left):   x=2,  y=3,  width=10, height=8
Rect B (medium, top-right): x=13, y=2,  width=9,  height=7
Rect C (large, bottom):     x=7,  y=12, width=14, height=10
```

Overlap regions:
- Rect C overlaps Rect A: Rect C's left edge (x=7) is inside Rect A (x=2..12), and Rect C's top edge (y=12) is inside Rect A (y=3..11)? No — Rect A bottom is y=11, Rect C top is y=12. They do not overlap vertically. Adjust.

**Revised layout with intentional overlap**:

```
Rect A (small, top-left):   x=2,  y=4,  width=10, height=8   (covers x:2–12, y:4–12)
Rect B (small, top-right):  x=13, y=2,  width=9,  height=7   (covers x:13–22, y:2–9)
Rect C (large, bottom):     x=6,  y=10, width=14, height=11  (covers x:6–20, y:10–21)
```

Overlaps:
- Rect C top (y=10) vs Rect A bottom (y=12): Rect C top edge y=10 is inside Rect A (y:4–12). Rect C left edge x=6 is inside Rect A (x:2–12). Overlap region: x=6–12, y=10–12 (6×2 px). Small but visible.
- Rect C top (y=10) vs Rect B (y:2–9): No vertical overlap (Rect C starts at y=10, Rect B ends at y=9). No overlap — adjust.

**Final revised layout**:

```
Rect A (top-left):   x=2,  y=4,  width=10, height=9   (covers x:2–12,  y:4–13)
Rect B (top-right):  x=12, y=2,  width=10, height=8   (covers x:12–22, y:2–10)
Rect C (bottom):     x=5,  y=11, width=14, height=11  (covers x:5–19,  y:11–22)
```

Overlaps:
- Rect C vs Rect A: x-overlap = x:5–12 (7px wide), y-overlap = y:11–13 (2px tall). Valid overlap.
- Rect C vs Rect B: x-overlap = x:12–19 (7px wide), y-overlap = y:11–10 → no overlap (Rect B ends y=10, Rect C starts y=11). Miss by 1px. Adjust Rect C to y=10:

```
Rect C (bottom):     x=5,  y=10, width=14, height=12  (covers x:5–19, y:10–22)
```

Overlaps:
- Rect C vs Rect A: x:5–12, y:10–13 — 7×3 px overlap. Rect C is in front of Rect A.
- Rect C vs Rect B: x:12–19, y:10–10 — 7×0px, touching but not overlapping. Increase Rect B height to 9: covers y:2–11. Then overlap = y:10–11, 1px tall. Minimal.

Adjust for cleaner overlaps:

```
Rect A (back-left):  x=2,  y=4,  width=10, height=9   (x:2–12,  y:4–13)
Rect B (back-right): x=12, y=2,  width=10, height=10  (x:12–22, y:2–12)
Rect C (front):      x=5,  y=10, width=14, height=12  (x:5–19,  y:10–22)
```

Overlaps:
- Rect C vs Rect A: x:5–12 (7px), y:10–13 (3px). Clear visible overlap. Rect C is front.
- Rect C vs Rect B: x:12–19 (7px), y:10–12 (2px). Clear visible overlap. Rect C is front.

All coordinates are whole pixels.

**SVG technique for overlap masking (clipPath)**:

To make Rect C appear to be in front of Rect A and Rect B — physically covering the portions of A and B that are behind C — use SVG `<clipPath>` elements. The clip paths define the visible region of each back rectangle: everything EXCEPT where Rect C sits on top.

The clip path for Rect A (visible area = Rect A minus the overlap with Rect C):
- Rect A full bounds: x=2, y=4, w=10, h=9
- Rect C covers: x=5–19, y=10–22
- Overlap with Rect A: x=5–12, y=10–13
- Visible part of Rect A: all of Rect A EXCEPT the overlap region
- This is a non-rectangular shape. Express as a path:
  ```
  M 2 4            (top-left of Rect A)
  L 12 4           (top-right of Rect A)
  L 12 13          (bottom-right of Rect A)
  L 5 13           (where Rect C's left edge meets Rect A's bottom)
  L 5 10           (Rect C top edge, within Rect A)
  L 2 10           (left edge of Rect A at Rect C top level)
  Z
  ```
  Wait — this describes the L-shape remaining after removing the bottom-right corner of Rect A. Let us verify:
  - Rect A: x=2..12, y=4..13
  - Cut-out (Rect C footprint within Rect A): x=5..12, y=10..13
  - L-shaped remainder:
    - Full top band: x=2..12, y=4..10 (width=10, height=6)
    - Left strip below: x=2..5, y=10..13 (width=3, height=3)

  Path for clip:
  ```
  M 2 4   L 12 4   L 12 10   L 5 10   L 5 13   L 2 13   Z
  ```
  This traces: top-left → top-right → right edge down to Rect C top → cut inward to Rect C left edge → down to bottom of Rect A at Rect C left → left edge of Rect A → close. This is the correct L-shape.

The clip path for Rect B (visible area = Rect B minus the overlap with Rect C):
- Rect B full bounds: x=12, y=2, w=10, h=10 (x=12..22, y=2..12)
- Rect C covers: x=5..19, y=10..22
- Overlap with Rect B: x=12..19, y=10..12
- Visible part of Rect B = Rect B minus the overlap:
  - Full top band: x=12..22, y=2..10 (width=10, height=8)
  - Right strip below: x=19..22, y=10..12 (width=3, height=2)

  Path for clip:
  ```
  M 12 2   L 22 2   L 22 12   L 19 12   L 19 10   L 12 10   Z
  ```
  This traces: top-left of Rect B → top-right → bottom-right → cut inward to Rect C right edge → up to Rect C top → left edge of Rect B at Rect C top → close. Correct reverse-L shape.

**Complete SVG with clipPaths**:

```tsx
export function IconExplorative({ className }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <defs>
        {/* Clip Rect A to hide the region covered by Rect C */}
        <clipPath id="clipA">
          <path d="M 2 4 L 12 4 L 12 10 L 5 10 L 5 13 L 2 13 Z" />
        </clipPath>
        {/* Clip Rect B to hide the region covered by Rect C */}
        <clipPath id="clipB">
          <path d="M 12 2 L 22 2 L 22 12 L 19 12 L 19 10 L 12 10 Z" />
        </clipPath>
      </defs>

      {/* Rect A — back-left, clipped by clipA */}
      <rect x="2" y="4" width="10" height="9" clipPath="url(#clipA)" />

      {/* Rect B — back-right, clipped by clipB */}
      <rect x="12" y="2" width="10" height="10" clipPath="url(#clipB)" />

      {/* Rect C — front, no clip needed */}
      <rect x="5" y="10" width="14" height="12" />
    </svg>
  )
}
```

**Important gotcha — clipPath IDs in React**:

Using static IDs like `clipA` and `clipB` is safe for a single instance of the icon per page. However, if `IconExplorative` is ever rendered more than once on the same page (unlikely but possible), duplicate SVG IDs will cause incorrect clipping — the browser uses the first matching ID.

**Solution**: Use a unique ID suffix per instance. Use React's `useId()` hook (React 18+):

```tsx
import { useId } from "react"

export function IconExplorative({ className }: IconProps) {
  const id = useId()
  const clipAId = `explorative-clipA-${id}`
  const clipBId = `explorative-clipB-${id}`

  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <defs>
        <clipPath id={clipAId}>
          <path d="M 2 4 L 12 4 L 12 10 L 5 10 L 5 13 L 2 13 Z" />
        </clipPath>
        <clipPath id={clipBId}>
          <path d="M 12 2 L 22 2 L 22 12 L 19 12 L 19 10 L 12 10 Z" />
        </clipPath>
      </defs>
      <rect x="2" y="4" width="10" height="9" clipPath={`url(#${clipAId})`} />
      <rect x="12" y="2" width="10" height="10" clipPath={`url(#${clipBId})`} />
      <rect x="5" y="10" width="14" height="12" />
    </svg>
  )
}
```

**Gotcha — stroke rendering with clipPath**:

When a `<rect>` is clipped, only the fill is clipped — the stroke is drawn on the geometry's actual boundary, which may still appear in the clipped-away region visually in some browsers. With `fill="none"`, only the stroke path is visible. The stroke is drawn centered on the rectangle edge. With `strokeWidth=1`, 0.5px is inside and 0.5px is outside the geometry boundary.

When the stroke of Rect A or Rect B runs along the boundary shared with Rect C's edge, the clip will cut through the stroke. This is the intended effect — it makes the stroke "stop" exactly at the front rectangle's edge, reinforcing the depth illusion.

To verify: render the icon at 24px and at 2× zoom. The clip should cleanly hide the back rectangle's strokes where Rect C sits on top.

**Gotcha — `clipPath` attribute vs `clip-path` CSS property**:

In SVG, use the attribute `clipPath="url(#id)"` (camelCase) on SVG elements. Do not use the CSS `clip-path` property here. In React JSX, SVG attributes like `clipPath` map correctly to the SVG attribute (React handles SVG namespace attributes properly).

---

### 8.3 All Other Icons — strokeWidth Only

The following icons only need `strokeWidth={1.5}` → `strokeWidth={1}`, no coordinate changes:

- `IconGrid` — coordinates are clean whole-pixel rects, no changes needed
- `IconExperimental` — path coordinates are on 0.5 boundaries (7.5, 16.5), acceptable
- `IconSun` — circle and line endpoints are clean; diagonal lines at 4.22/6.34/17.66/19.78 are irrational but this is inherent to 45° geometry on a 24px grid — acceptable
- `IconMoon` — uses a path, no changes needed beyond strokeWidth
- `IconFullscreen` — uses paths with `a 2 2` arc commands (from the original shadcn source); the arcs produce 2px radius corners. After the global border-radius reset, these are SVG arc commands in the icon paths — they are intentional design (corner notches on the fullscreen icon), NOT CSS border-radius. Leave them as-is; they do not need to change.
- `IconClose` — clean whole-pixel lines
- `IconArrowLeft`, `IconArrowRight` — polyline points are whole pixels
- `IconUpload` — has a bezier path; coordinates are acceptable
- `IconLogOut` — clean coordinates
- `IconPlus` — clean whole-pixel lines

---

## 9. ButtonGroup Component

**File to create**: `src/components/ui/ButtonGroup.tsx`

### Design spec

- No border-radius (0 everywhere)
- Each button is individually bordered
- First child: full border (top + right + bottom + left)
- Subsequent children: no left border (top + right + bottom only) to prevent double borders at joins
- Hover state: border color transitions to match the hovered button's background color — making the border visually "disappear" into the hover bg
- Active/selected state: background = `--foreground`, text/icon = `--background`; borders should also be `--foreground` so the border merges with the active background, making the entire group read as one filled unit at the active position
- The component provides CSS context via a wrapper; callers add their own buttons

### Border behavior detail

The hover border-color = hover bg color trick: when you hover a button and its background becomes `--muted` (or whatever hover color), the border transitions to the same color. This makes the border invisible against the hover background, as if the button has no border while hovered. This is a subtle visual refinement — the layout does not shift because the border still exists and occupies space.

For active buttons: background = `--foreground`, so border should also be `--foreground`. But adjacent buttons have their own borders. The left border of the button AFTER the active button is still the foreground color (from its own left... wait, subsequent buttons have no left border). The right border of the active button is `--foreground`. The left edge of the next button has no left border. So the junction between active and next button: active's right border is foreground color, next button has no left border. This creates a clean right edge on the active button with no double border artifact.

### Props API

```typescript
interface ButtonGroupProps {
  children: React.ReactNode
  className?: string
}
```

The component does not manage state — callers control active state via `aria-pressed` or `data-active` attributes on individual buttons, styled by CSS selectors.

### Full component implementation

```tsx
// src/components/ui/ButtonGroup.tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ButtonGroupProps {
  children: React.ReactNode
  className?: string
}

/**
 * ButtonGroup — wraps icon-only buttons in a flush group.
 *
 * Border logic:
 *   - First child: border on all 4 sides.
 *   - Other children: border on top, right, bottom only (no left — avoids double border).
 *
 * Hover: border-color transitions to match hover background (visually disappears).
 * Active (aria-pressed="true"): bg=foreground, text=background, border=foreground.
 */
export function ButtonGroup({ children, className }: ButtonGroupProps) {
  return (
    <div
      className={cn(
        "button-group flex items-center",
        className
      )}
    >
      {children}
    </div>
  )
}
```

The CSS that powers the border logic lives in `globals.css` rather than as Tailwind utilities, because the `:first-child` / `:not(:first-child)` selectors cannot be expressed as static Tailwind classes applied by the parent:

**Add to `src/app/globals.css`** (after the `@layer base` block):

```css
/* ─── ButtonGroup ─────────────────────────────────────────── */
.button-group > button,
.button-group > [role="button"] {
  /* Shared base styles for all group buttons */
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.5rem;   /* h-10 = 40px */
  width: 2.5rem;    /* w-10 = 40px */
  border-style: solid;
  border-width: 1px;
  border-color: var(--border);
  background: transparent;
  color: var(--foreground);
  cursor: pointer;
  border-radius: 0;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

/* First button: full border */
.button-group > button:first-child,
.button-group > [role="button"]:first-child {
  border-left-width: 1px;
}

/* Subsequent buttons: no left border */
.button-group > button:not(:first-child),
.button-group > [role="button"]:not(:first-child) {
  border-left-width: 0;
}

/* Hover state (hover-capable devices only) */
@media (hover: hover) {
  .button-group > button:hover,
  .button-group > [role="button"]:hover {
    background-color: var(--muted);
    border-color: var(--muted);
  }
}

/* Active / selected state */
.button-group > button[aria-pressed="true"],
.button-group > [role="button"][aria-pressed="true"],
.button-group > button[data-active="true"],
.button-group > [role="button"][data-active="true"] {
  background-color: var(--foreground);
  color: var(--background);
  border-color: var(--foreground);
}

/* When the button BEFORE an active button has right-border = foreground,
   we need no adjustment — the active button's own left... wait, it has no
   left border (it's not first-child). So the right border of the preceding
   button is still --border, but the active button's background is foreground.
   There will be a 1px --border colored right edge of the preceding button
   abutting the active button's left edge (which has no border).
   To make the join look clean, we need the preceding button's right border
   to also be foreground when the NEXT sibling is active.

   CSS cannot select "previous sibling", so handle this differently:
   Give the active button a negative left margin to overlap the preceding
   button's right border, then give it a left border in foreground color.
   This approach is simpler than :has() predecessor selectors.
*/

.button-group > button[aria-pressed="true"]:not(:first-child),
.button-group > [role="button"][aria-pressed="true"]:not(:first-child) {
  /* Restore left border for active non-first buttons to merge with foreground bg */
  border-left-width: 1px;
  margin-left: -1px; /* Overlap the preceding button's right border */
  /* Ensure active button renders on top */
  position: relative;
  z-index: 1;
}
```

### Caller usage pattern

In `OptionsBar.tsx`, the mode switcher buttons become:

```tsx
import { ButtonGroup } from "@/components/ui/ButtonGroup"

<ButtonGroup>
  {MODES.map(({ mode: m, icon, label }) => (
    <Tooltip key={m}>
      <TooltipTrigger asChild>
        <button
          onClick={() => onModeChange(m)}
          aria-label={label}
          aria-pressed={m === mode}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  ))}
</ButtonGroup>
```

Admin buttons:

```tsx
{isAdmin && (
  <ButtonGroup>
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onNewPiece} aria-label="New piece arrival">
          <IconPlus />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">New piece arrival</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onLogOut} aria-label="Log out">
          <IconLogOut />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Log out</TooltipContent>
    </Tooltip>
  </ButtonGroup>
)}
```

**Gotcha**: The dark mode toggle button is a standalone button (not in a group). It should receive the same visual treatment as ButtonGroup buttons: 40px, border on all sides, same hover color transition. Apply the same CSS or create a shared base class. Add it in globals.css:

```css
/* ─── Standalone icon button (same spec as ButtonGroup button) ─── */
.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.5rem;
  width: 2.5rem;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--foreground);
  cursor: pointer;
  border-radius: 0;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

@media (hover: hover) {
  .icon-button:hover {
    background-color: var(--muted);
    border-color: var(--muted);
  }
}
```

Then in `OptionsBar.tsx`:

```tsx
<button
  onClick={onDarkModeToggle}
  className="icon-button"
  aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
>
  {isDarkMode ? <IconSun /> : <IconMoon />}
</button>
```

---

## 10. OptionsBar Refactor

**File**: `src/components/layout/OptionsBar.tsx`

### Summary of all changes

1. Remove `rounded-[2px]` from all elements
2. Update button sizes h-8 w-8 → handled by ButtonGroup/icon-button CSS (40px)
3. Remove `text-xs` from `SelectTrigger` and `TooltipContent` calls
4. Update `SelectTrigger` height from `h-8` to `h-10`
5. Wrap mode switcher in `ButtonGroup`
6. Wrap admin buttons in `ButtonGroup`
7. Update dark mode toggle to use `icon-button` class
8. Remove old wrapper div classes that managed the mode switcher group appearance (`overflow-hidden rounded-[2px] border`)
9. Update mobile gutter `px-5` → `px-[var(--gutter)]`

### Full updated component

```tsx
"use client"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ButtonGroup } from "@/components/ui/ButtonGroup"
import {
  IconClassic,
  IconGrid,
  IconExplorative,
  IconExperimental,
  IconSun,
  IconMoon,
  IconPlus,
  IconLogOut,
} from "@/components/ui/icons"
import type { GalleryMode, ImageFilter } from "@/types"

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

const MODES: Array<{ mode: GalleryMode; icon: React.ReactNode; label: string }> = [
  { mode: "classic", icon: <IconClassic />, label: "Classic" },
  { mode: "grid", icon: <IconGrid />, label: "Grid" },
  { mode: "explorative", icon: <IconExplorative />, label: "Explorative" },
  { mode: "experimental", icon: <IconExperimental />, label: "Experimental" },
]

export function OptionsBar({
  mode,
  filter,
  isDarkMode,
  onModeChange,
  onFilterChange,
  onDarkModeToggle,
  isAdmin,
  onNewPiece,
  onLogOut,
}: OptionsBarProps) {
  return (
    <div className="fixed top-3 right-3 z-50 flex flex-wrap items-center gap-2 max-md:static max-md:px-[var(--gutter)] max-md:py-3">
      {/* Image set selector */}
      <Select value={filter} onValueChange={(v) => onFilterChange(v as ImageFilter)}>
        <SelectTrigger className="h-10 w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everything</SelectItem>
          <SelectItem value="supi">SUPI.ER.TO</SelectItem>
          <SelectItem value="bone">BONE</SelectItem>
        </SelectContent>
      </Select>

      {/* Gallery mode switcher */}
      <ButtonGroup>
        {MODES.map(({ mode: m, icon, label }) => (
          <Tooltip key={m}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onModeChange(m)}
                aria-label={label}
                aria-pressed={m === mode}
              >
                {icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
      </ButtonGroup>

      {/* Dark mode toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onDarkModeToggle}
            className="icon-button"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <IconSun /> : <IconMoon />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        </TooltipContent>
      </Tooltip>

      {/* Admin-only actions */}
      {isAdmin && (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onNewPiece} aria-label="New piece arrival">
                <IconPlus />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New piece arrival</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onLogOut} aria-label="Log out">
                <IconLogOut />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Log out</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )}
    </div>
  )
}
```

---

## 11. Select Transparency

**File**: `src/components/ui/select.tsx`

### Problem

The `SelectTrigger` component applies `dark:bg-input/30` and `dark:hover:bg-input/50`. In dark mode, `--input` is `oklch(1 0 0 / 15%)`, so `bg-input/30` = white at ~4.5% opacity — a slightly visible card-like background that is different from the other buttons which are fully transparent.

In light mode, the default shadcn `SelectTrigger` uses `bg-transparent` (it's in the base class string), but the `--input` dark-mode override creates the inconsistency.

### Required change

In `SelectTrigger`'s className, remove the `dark:bg-input/30` and `dark:hover:bg-input/50` tokens and ensure `bg-transparent` is always applied:

```tsx
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        // Remove: dark:bg-input/30 dark:hover:bg-input/50
        // Keep bg-transparent explicit
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex w-fit items-center justify-between gap-2 border bg-transparent px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}
```

Also add a hover effect consistent with `icon-button` and ButtonGroup buttons:

```tsx
// Add to the className string:
"has-hover:hover:bg-muted has-hover:hover:border-muted"
```

**Note**: The `border-input` class on `SelectTrigger` uses `--input` as the border color. After step 2 (border color fix), `--input` in light mode equals `--border` (`oklch(0 0 0 / 12%)`). In dark mode, `--input` is `oklch(1 0 0 / 15%)`, slightly different from `--border` (`oklch(1 0 0 / 10%)`). For visual consistency, consider changing `border-input` to `border-border` in the SelectTrigger className so all interactive elements use the same border color.

### SelectContent dropdown background

The dropdown (`SelectContent`) uses `bg-popover`, which in both modes is a solid card color. This is intentional — the dropdown needs a solid background to be readable over whatever is behind it. Do not change `SelectContent`'s background.

### SelectItem hover

`SelectItem` uses `focus:bg-accent` for the hover/keyboard-focus highlight. This is the `--accent` variable, same as `--muted`. Consistent with ButtonGroup hover — no change needed.

---

## 12. Execution Order & Gotchas

### Recommended implementation order

Implement in this sequence to minimize conflicts and allow incremental visual verification:

1. **globals.css** — all CSS token changes in one commit:
   - Border radius → 0
   - Light mode `--border` → opacity-based
   - Base font-size 14px
   - `--gutter` variable
   - Masonry grid use `--gutter`
   - Scrollbar styling
   - ButtonGroup and icon-button CSS classes

2. **layout.tsx** — dark mode flash fix script

3. **page.tsx** — simplify mount effect (do not re-apply dark class)

4. **icons/index.tsx** — all icon changes (strokeWidth + Classic redesign + Explorative redesign)

5. **ButtonGroup.tsx** — create new component

6. **OptionsBar.tsx** — full refactor (ButtonGroup, size, gutter, remove hardcoded classes)

7. **tooltip.tsx** — remove `text-xs` from base class, remove `rounded-md` and arrow `rounded-[2px]`

8. **select.tsx** — remove dark:bg-input, add hover consistency, change border-input → border-border

9. **Gutter replacements** — `ClassicGallery.tsx`, `GridGallery.tsx`, `Header.tsx`

10. **Favicon** — create `src/app/icon.svg`

11. **PWA manifest** — create `src/app/manifest.ts` and update `layout.tsx` with iOS meta tags

12. **Run `npm run format`** after all file changes

### Critical gotchas summary

| Area | Gotcha |
|---|---|
| Border radius | `overflow-hidden` on mode-switcher div was doing double duty; remove it when switching to ButtonGroup |
| Tooltip | `text-xs` is baked into `tooltip.tsx` base class string — must be removed there, not just at call sites |
| Tooltip arrow | Has `rounded-[2px]` attribute — remove it |
| Select | `shadow-xs` in SelectTrigger base class — the global `box-shadow: none !important` already neutralizes this, but remove it from the class string anyway to keep it clean |
| Select | Lucide icons (`ChevronDownIcon`, `CheckIcon`) imported in `select.tsx` — these are from `lucide-react`, not the custom icon set. This is an existing exception; do not replace them with custom icons in this phase |
| ButtonGroup active | The negative margin + z-index trick for non-first active buttons must be tested; if Radix `TooltipTrigger` wraps the button in a `<span>`, the `.button-group > button` CSS selector will not match. Check if `asChild` propagates the button element directly. If not, the ButtonGroup CSS selectors need to be broadened to `> *` or use a wrapper approach |
| Explorative icon clipPath | `useId()` from React 18 produces IDs with colons (e.g. `:r0:`). While valid in CSS `url(#id)` references, some older browsers have issues. Sanitize the ID: `id.replace(/:/g, '')` |
| Dark mode flash | After adding the `<head>` script, `suppressHydrationWarning` on `<html>` must remain — the server always renders `class="... dark"` but the client script may remove `dark`. The mismatch is intentional and suppressed |
| Font size | `text-sm` in Tailwind v4 is 14px (0.875rem). The body `font-size: 14px` sets the base. Tailwind's `text-sm` also sets `line-height: 1.25rem` — set `line-height` explicitly on body if needed |
| Gutter | The Tailwind arbitrary value `px-[var(--gutter)]` works in Tailwind v4. If any component uses `gap-5` (20px) to mean the gutter, change those too — but verify they are actually page-gutter usages and not component-internal spacing |
| Icon clipPath in Next.js static export | SVG clip paths work fully client-side; static export has no impact. Confirmed no issue |
| ButtonGroup Tooltip interaction | Radix Tooltip wraps triggers in a `span[data-state]`. With `asChild`, the button itself receives the Tooltip trigger props. Verify in browser DevTools that the rendered child of `.button-group` is indeed a `<button>` element and not a `<span>` |

---

## 13. PWA Manifest & iOS Meta Tags (Item 35)

**Scope**: Manifest + iOS-specific meta tags only. No service worker, no offline caching.

### Goals

- App launches in standalone (fullscreen, no browser chrome) when added to iOS/Android home screen.
- Custom splash screen on launch.
- Status bar color matches the app's dark background. 
- Important: Manage color change when light mode is active.
- Maskable icon fills the home screen icon shape on Android.

### 13.1 App Manifest — `src/app/manifest.ts`

Next.js App Router supports a typed manifest via `src/app/manifest.ts` (auto-served at `/manifest.webmanifest`):

```typescript
// src/app/manifest.ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SUPI.ER.TO",
    short_name: "SUPI",
    description: "BONE is dead — long live SUPI.ER.TO — Zürich",
    start_url: "/classic",
    display: "standalone",           // hides browser chrome on Android
    background_color: "#000000",     // splash screen bg (matches dark mode)
    theme_color: "#000000",          // status bar color
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",         // fills home screen shape on Android
      },
    ],
  }
}
```

### 13.2 iOS-Specific Meta Tags — `src/app/layout.tsx`

iOS Safari requires additional meta tags beyond the manifest (it partially ignores the manifest for some properties):

```tsx
// src/app/layout.tsx — add inside <head>
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
{/* "black" = opaque black status bar; "black-translucent" extends content under it */}
<meta name="apple-mobile-web-app-title" content="SUPI" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
{/* apple-touch-icon.png = 180×180px, used for iOS home screen icon */}
```

`"black"` for `apple-mobile-web-app-status-bar-style` is appropriate for a dark-default app. Note: `"black-translucent"` makes the status bar overlay the app content (extends the viewport to fill the notch area), which requires extra `env(safe-area-inset-*)` CSS padding — avoid this complexity unless explicitly desired.

### 13.3 App Icons to Create

Generate PNG icons from the favicon SVG (the "SU" on black design). Create them at:

| File | Size | Usage |
|---|---|---|
| `public/icons/apple-touch-icon.png` | 180×180 | iOS home screen icon |
| `public/icons/icon-192.png` | 192×192 | Android manifest icon |
| `public/icons/icon-512.png` | 512×512 | Android manifest + install dialog |
| `public/icons/icon-512-maskable.png` | 512×512 | Android maskable icon (safe zone: inner 409×409) |

**Generating**: Use the `sharp` package (already in the project) in a small script, or use an online tool with the SVG. The maskable version should have the "SU" positioned in the center safe zone (80% of dimensions), with the black background extending to the full 512×512.

Script snippet (add to `scripts/generate-icons.ts` or inline in `process-images.ts`):

```typescript
import sharp from "sharp"

const svgBuffer = /* read src/app/icon.svg as buffer */
await sharp(svgBuffer).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png")
await sharp(svgBuffer).resize(192, 192).png().toFile("public/icons/icon-192.png")
await sharp(svgBuffer).resize(512, 512).png().toFile("public/icons/icon-512.png")
// For maskable: add black padding so the "SU" glyph is inset 10% from each edge
await sharp(svgBuffer)
  .resize(410, 410)  // 80% of 512
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: "#000000" })
  .png()
  .toFile("public/icons/icon-512-maskable.png")
```

Add a `generate-icons` script to `package.json`:
```json
"generate-icons": "tsx scripts/generate-icons.ts"
```

### 13.4 Theme Color Dynamic Meta Tag

The manifest hardcodes `theme_color: "#000000"` (dark). iOS Safari also reads `<meta name="theme-color">` for the status bar. To make this dark/light mode aware, add two `theme-color` meta tags with `media` queries:

```html
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
```

Add both to `layout.tsx`. Note: these respond to the **OS** color scheme preference, not the in-app toggle. This is acceptable for the status bar since the OS preference and app preference will usually align.

### 13.5 `next.config.ts` — No Changes Needed

The manifest is handled by Next.js App Router natively via `src/app/manifest.ts`. No plugin or config change required. Icons in `public/` are served as static files at their paths.

### 13.6 Gotchas

| Issue | Notes |
|---|---|
| iOS ignores `display: "standalone"` in manifest | The `apple-mobile-web-app-capable` meta tag is what actually enables standalone mode on iOS — both must be present |
| iOS status bar height | In `standalone` mode with `apple-mobile-web-app-status-bar-style: "black"`, iOS adds ~20px of black status bar area at the top. The sticky header naturally handles this (pushes content below it) |
| Android Chrome install banner | Requires: manifest present, `start_url` accessible, HTTPS, 192px + 512px icons. These are all satisfied |
| Favicon vs apple-touch-icon | `src/app/icon.svg` is used as the browser tab favicon. `apple-touch-icon.png` is the iOS home screen icon — they're separate files, both need to exist |
| `manifest.webmanifest` vs `manifest.json` | Next.js serves at `/manifest.webmanifest` automatically from `src/app/manifest.ts`. No need for `public/manifest.json` |
