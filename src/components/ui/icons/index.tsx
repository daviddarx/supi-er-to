/**
 * Custom SVG icon set for SUPI.ER.TO.
 * All icons: 24×24px, stroke="currentColor", strokeWidth=1,
 * fill="none", strokeLinecap="round", strokeLinejoin="round".
 * No external icon library used.
 */

import { useId } from "react"

interface IconProps {
  className?: string
  strokeWidth?: number
}

export function IconClassic({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 3 equal rectangles, 16×4 each, 3px gaps, 3px top/bottom margins */}
      {/* Verification: 3 + 4 + 3 + 4 + 3 + 4 + 3 = 24 ✓ */}
      <rect x="4" y="3" width="16" height="4" />
      <rect x="4" y="10" width="16" height="4" />
      <rect x="4" y="17" width="16" height="4" />
    </svg>
  )
}

export function IconGrid({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="8" height="8" />
      <rect x="13" y="3" width="8" height="8" />
      <rect x="3" y="13" width="8" height="8" />
      <rect x="13" y="13" width="8" height="8" />
    </svg>
  )
}

/**
 * IconExplorative — 3 overlapping rectangles at different positions and sizes,
 * no rotation transforms. Rect C is in front; Rect A and Rect B are clipped
 * where Rect C covers them, creating a depth/layering illusion.
 *
 * Uses useId() to generate unique clipPath IDs per instance, preventing
 * incorrect clipping when multiple instances are rendered on the same page.
 */
export function IconExplorative({ className, strokeWidth = 1 }: IconProps) {
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
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <defs>
        {/*
         * Clip Rect A (x:2–12, y:4–13) to exclude the region covered by Rect C (x:5–19, y:10–22).
         * Overlap: x:5–12, y:10–13 (bottom-right corner of Rect A).
         * Visible L-shape: full top band (x:2–12, y:4–10) + left strip (x:2–5, y:10–13).
         */}
        <clipPath id={clipAId}>
          <path d="M 2 4 L 12 4 L 12 10 L 5 10 L 5 13 L 2 13 Z" />
        </clipPath>
        {/*
         * Clip Rect B (x:12–22, y:2–12) to exclude the region covered by Rect C (x:5–19, y:10–22).
         * Overlap: x:12–19, y:10–12 (bottom-left corner of Rect B).
         * Visible reverse-L shape: full top band (x:12–22, y:2–10) + right strip (x:19–22, y:10–12).
         */}
        <clipPath id={clipBId}>
          <path d="M 12 2 L 22 2 L 22 12 L 19 12 L 19 10 L 12 10 Z" />
        </clipPath>
      </defs>

      {/* Rect A — back-left, clipped where Rect C overlaps */}
      <rect x="2" y="4" width="10" height="9" clipPath={`url(#${clipAId})`} />

      {/* Rect B — back-right, clipped where Rect C overlaps */}
      <rect x="12" y="2" width="10" height="10" clipPath={`url(#${clipBId})`} />

      {/* Rect C — front, unclipped */}
      <rect x="5" y="10" width="14" height="12" />
    </svg>
  )
}

export function IconExperimental({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 3D cube wireframe — outer hexagon + internal spokes to center */}
      <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z" />
      <path d="M12 3 L12 12" />
      <path d="M4 7.5 L12 12" />
      <path d="M20 7.5 L12 12" />
    </svg>
  )
}

export function IconSun({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      {/* Diagonal rays — 45° geometry on 24px grid, irrational coordinates are inherent */}
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </svg>
  )
}

export function IconMoon({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function IconFullscreen({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/*
       * Corner notches for fullscreen indicator.
       * The arc commands (a 2 2) are intentional SVG arc design — NOT CSS border-radius.
       * They are preserved as-is from the original shadcn source.
       */}
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

export function IconClose({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconArrowLeft({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export function IconArrowRight({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function IconUpload({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

export function IconLogOut({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function IconPlus({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

/**
 * IconPlusCircle — a plus sign inside a circle.
 * Used as the zoom cursor indicator for gallery images in Classic, Grid, and Explorative modes.
 *
 * Circle: cx=12, cy=12, r=9 (2px margin from canvas edge on each side).
 * Plus arms: 6px reach from center in each direction (x: 6–18, y: 6–18).
 * All coordinates are whole pixels.
 */
export function IconPlusCircle({ className, strokeWidth = 1 }: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7" x2="12" y2="17" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  )
}
