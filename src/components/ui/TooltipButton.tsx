"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface TooltipButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  className?: string
  /** "ghost" = no border by default; "outline" = always shows border */
  variant?: "outline" | "ghost"
}

/**
 * An icon-only button always wrapped in a shadcn Tooltip.
 * Per design system: all icon-only buttons must have a tooltip.
 */
export function TooltipButton({
  icon,
  label,
  onClick,
  className,
  variant = "ghost",
}: TooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[2px]",
            variant === "outline" && "border",
            "has-hover:hover:bg-muted",
            className
          )}
          aria-label={label}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
