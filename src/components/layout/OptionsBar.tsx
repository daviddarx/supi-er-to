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
 * Top control bar: image set filter, mode switcher, dark mode toggle,
 * and admin actions (when isAdmin is true).
 * Sticky on both desktop and mobile — sticks to the top of the page.
 * On mobile: Select on its own full-width row; below it, mode buttons
 * left-aligned and dark mode + admin buttons right-aligned.
 * On desktop: all controls in a single horizontal flex row, right-aligned.
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
    <div className="p-gutter flex flex-col items-stretch gap-2 pt-0 min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between md:justify-end">
      {/* Image set selector — full width on xs, auto width on small mobile, min-width on desktop */}
      <Select value={filter} onValueChange={(v) => onFilterChange(v as ImageFilter)}>
        <SelectTrigger
          className="h-10 !w-full min-w-[140px] bg-transparent min-[390px]:!w-auto min-[390px]:min-w-0"
          aria-label="Filter images"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everything</SelectItem>
          <SelectItem value="supi">SUPI.ER.TO</SelectItem>
          <SelectItem value="bone">BONE</SelectItem>
        </SelectContent>
      </Select>

      {/* Mode buttons + dark mode + admin — on desktop md:contents collapses wrapper */}
      <div className="flex w-full items-center justify-between gap-2 min-[390px]:w-auto min-[390px]:justify-start md:contents">
        {/* Gallery mode switcher */}
        <div className="flex items-center">
          {MODES.map(({ mode: m, icon, label }) => (
            <Tooltip key={m}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onModeChange(m)}
                  className={cn(
                    "flex h-10 w-10 cursor-pointer items-center justify-center border transition-colors",
                    "border-l-0 first:border-l",
                    m === mode
                      ? "bg-foreground text-background border-foreground"
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

        {/* Right-side controls: dark mode + admin */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDarkModeToggle}
                className="has-hover:hover:bg-muted flex h-10 w-10 cursor-pointer items-center justify-center border"
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? <IconSun /> : <IconMoon />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            </TooltipContent>
          </Tooltip>

          {isAdmin && (
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onNewPiece}
                    className="has-hover:hover:bg-muted flex h-10 w-10 cursor-pointer items-center justify-center border border-r-0 transition-colors"
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
                    className="has-hover:hover:bg-muted flex h-10 w-10 cursor-pointer items-center justify-center border transition-colors"
                    aria-label="Log out"
                  >
                    <IconLogOut />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Log out
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
