/**
 * Site header — displays the site title and tagline.
 * Sticky: sticks to the top of the page on both desktop and mobile.
 * bg-background ensures content scrolling behind it is occluded.
 */
export function Header() {
  return (
    <header className="bg-background sticky top-0 z-50 px-3 py-3 max-md:px-5 max-md:pt-4 max-md:pb-0">
      <h1 className="leading-tight font-bold tracking-tight">SUPI.ER.TO</h1>
      <p className="text-muted-foreground leading-tight font-normal">
        BONE is dead — long live SUPI.ER.TO — Zürich
      </p>
    </header>
  )
}
