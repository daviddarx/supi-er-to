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

/**
 * Top-right control bar: image set filter, mode switcher, dark mode toggle,
 * and admin actions (when isAdmin is true).
 * Fixed on desktop, in-flow on mobile.
 */
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
    <div className="fixed top-3 right-3 z-50 flex flex-wrap items-center gap-2 max-md:static max-md:px-5 max-md:py-3">
      {/* Image set selector */}
      <Select value={filter} onValueChange={(v) => onFilterChange(v as ImageFilter)}>
        <SelectTrigger className="h-8 w-[120px] rounded-[2px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everything</SelectItem>
          <SelectItem value="supi">SUPI.ER.TO</SelectItem>
          <SelectItem value="bone">BONE</SelectItem>
        </SelectContent>
      </Select>

      {/* Gallery mode switcher */}
      <div className="flex items-center overflow-hidden rounded-[2px] border">
        {MODES.map(({ mode: m, icon, label }) => (
          <Tooltip key={m}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onModeChange(m)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center border-r transition-colors last:border-r-0",
                  m === mode
                    ? "bg-foreground text-background"
                    : "text-foreground has-hover:hover:bg-muted bg-transparent"
                )}
                aria-label={label}
                aria-pressed={m === mode}
              >
                {icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Dark mode toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onDarkModeToggle}
            className="has-hover:hover:bg-muted flex h-8 w-8 items-center justify-center rounded-[2px] border"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <IconSun /> : <IconMoon />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        </TooltipContent>
      </Tooltip>

      {/* Admin-only actions */}
      {isAdmin && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onNewPiece}
                className="has-hover:hover:bg-muted flex h-8 w-8 items-center justify-center rounded-[2px] border"
                aria-label="New piece arrival"
              >
                <IconPlus />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              New piece arrival
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onLogOut}
                className="has-hover:hover:bg-muted flex h-8 w-8 items-center justify-center rounded-[2px] border"
                aria-label="Log out"
              >
                <IconLogOut />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Log out
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  )
}
