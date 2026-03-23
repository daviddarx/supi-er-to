/**
 * Custom SVG icon set for SUPI.ER.TO.
 * All icons: 24×24px, stroke="currentColor", strokeWidth=1,
 * fill="none", strokeLinecap="round", strokeLinejoin="round".
 * No external icon library used.
 */

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
      <path d="M20.5 3.5H3.5V7.5H20.5V3.5Z" />
      <path d="M20.5 9.5H3.5V13.5H20.5V9.5Z" />
      <path d="M20.5 15.5H3.5V20.5H20.5V15.5Z" />
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
      <path d="M10.5 3.5H3.5V8.5H10.5V3.5Z" />
      <path d="M10.5 10.5H3.5V20.5H10.5V10.5Z" />
      <path d="M20.5 3.5H12.5V12.5H20.5V3.5Z" />
      <path d="M20.5 14.5H12.5V20.5H20.5V14.5Z" />
    </svg>
  )
}

export function IconExplorative({ className, strokeWidth = 1 }: IconProps) {
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
      <path d="M20.5 11.5H9.5V20.5H20.5V11.5Z" />
      <path d="M9 16.5H3.5V8.5H12.5V11" />
      <path d="M6.5 8V3.5L18.5 3.5V11.5" />
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
      <path d="M12 3.5L20.5 7.5V16.5L12 20.5L3.5 16.5V7.5L12 3.5Z" />
      <path d="M4 7.5L12 11.5" />
      <path d="M20 7.5L12 11.5" />
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
      <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" />
      <path d="M12 2V5" />
      <path d="M12 19V22" />
      <path d="M2 12H5" />
      <path d="M19 12H22" />
      <path d="M4.22021 4.21997L6.34022 6.33997" />
      <path d="M17.6602 17.66L19.7802 19.78" />
      <path d="M4.22021 19.78L6.34022 17.66" />
      <path d="M17.6602 6.33997L19.7802 4.21997" />
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
      <path d="M20.9999 12.79C20.8426 14.4922 20.2038 16.1144 19.1581 17.4668C18.1125 18.8192 16.7034 19.8458 15.0956 20.4265C13.4878 21.0073 11.7479 21.1181 10.0794 20.7461C8.41092 20.3741 6.8829 19.5345 5.67413 18.3258C4.46536 17.117 3.62584 15.589 3.25381 13.9205C2.88178 12.252 2.99262 10.5121 3.57336 8.9043C4.15411 7.29651 5.18073 5.88737 6.53311 4.84175C7.8855 3.79614 9.5077 3.15731 11.2099 3C10.2133 4.34827 9.73375 6.00945 9.85843 7.68141C9.98312 9.35338 10.7038 10.9251 11.8893 12.1106C13.0748 13.2961 14.6465 14.0168 16.3185 14.1415C17.9905 14.2662 19.6516 13.7866 20.9999 12.79Z" />
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
      className={className}
    >
      <path d="M4.5 10C4.5 10 4.54466 4.66667 4.5 3.5H11" />
      <path d="M15 3.5C15 3.5 20.3333 3.54466 21.5 3.5L21.5 10" />
      <path d="M4.5 14C4.5 14 4.54466 19.3333 4.5 20.5H11" />
      <path d="M15 20.5C15 20.5 20.3333 20.4553 21.5 20.5L21.5 14" />
    </svg>
  )
}

export function IconFullscreenExit({ className, strokeWidth = 1 }: IconProps) {
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
      <path d="M4 10.5H10.5V4" />
      <path d="M20 10.5H13.5V4" />
      <path d="M4 13.5H10.5V20" />
      <path d="M20 13.5H13.5V20" />
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
      <path d="M3.5 3.5L20.5 20.5" />
      <path d="M20.5 3.5L3.5 20.5" />
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
      <path d="M15.5 20.5L7 12L15.5 3.5" />
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
      <path d="M8.5 20.5L17 12L8.5 3.5" />
    </svg>
  )
}

export function IconArrowDown({ className, strokeWidth = 1 }: IconProps) {
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
      <path d="M3.5 8.5L12 17L20.5 8.5" />
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
      <path d="M16 16L12 12L8 16" />
      <path d="M12 12V21" />
      <path d="M20.39 18.39C21.3653 17.8583 22.1358 17.0169 22.5798 15.9986C23.0239 14.9804 23.1162 13.8432 22.8422 12.7667C22.5682 11.6901 21.9434 10.7355 21.0666 10.0534C20.1898 9.37137 19.1108 9.00072 18 8.99998H16.74C16.4373 7.82923 15.8731 6.74232 15.0899 5.82098C14.3067 4.89964 13.3248 4.16783 12.2181 3.68059C11.1113 3.19335 9.90851 2.96334 8.70008 3.00787C7.49164 3.05239 6.30903 3.37028 5.24114 3.93765C4.17325 4.50501 3.24787 5.30709 2.53458 6.28357C1.82129 7.26004 1.33865 8.38552 1.12294 9.57538C0.90723 10.7652 0.964065 11.9885 1.28917 13.1532C1.61428 14.318 2.1992 15.3938 2.99996 16.3" />
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
      <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" />
      <path d="M16 17L21 12L16 7" />
      <path d="M21 12H9" />
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
      <path d="M12 5V19" />
      <path d="M5 12H19" />
    </svg>
  )
}

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
      <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" />
      <path d="M12 7V17" />
      <path d="M7 12H17" />
    </svg>
  )
}

export function IconZoomIn({ className, strokeWidth = 1 }: IconProps) {
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
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M15.5 15.5L21 21" />
      <path d="M10.5 7.5V13.5" />
      <path d="M7.5 10.5H13.5" />
    </svg>
  )
}

export function IconZoomOut({ className, strokeWidth = 1 }: IconProps) {
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
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M15.5 15.5L21 21" />
      <path d="M7.5 10.5H13.5" />
    </svg>
  )
}
