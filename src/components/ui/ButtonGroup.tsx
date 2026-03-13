"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ButtonGroupProps {
  children: React.ReactNode
  className?: string
}

/**
 * ButtonGroup — wraps icon-only buttons in a flush horizontal group.
 *
 * Border logic (applied via globals.css `.button-group` CSS class):
 *   - First child: full border on all 4 sides.
 *   - Subsequent children: border on top, right, bottom only (no left border,
 *     avoids a double-border artifact at the join between buttons).
 *
 * Active state (aria-pressed="true" or data-active="true"):
 *   - bg = --foreground, color = --background, border = --foreground
 *   - Non-first active buttons get a restored left border + negative margin
 *     to cleanly merge with the preceding button's right border.
 *
 * Hover state (hover-capable devices only):
 *   - bg = --muted, border-color = --muted (border "disappears" into bg)
 *
 * The component itself is a thin flex wrapper. All interactive CSS lives in
 * globals.css so that :first-child / :not(:first-child) selectors work
 * without requiring callers to pass positional props.
 */
export function ButtonGroup({ children, className }: ButtonGroupProps) {
  return <div className={cn("button-group flex items-center", className)}>{children}</div>
}
