/**
 * Site header — displays the site title and tagline.
 * Fixed on desktop (top-left), in-flow on mobile.
 */
export function Header() {
  return (
    <header className="fixed top-3 left-3 z-50 max-md:static max-md:px-5 max-md:pt-4">
      <h1 className="text-xs leading-tight font-bold tracking-tight">SUPI.ER.TO</h1>
      <p className="text-muted-foreground text-xs leading-tight font-normal">
        BONE is dead — long live SUPI.ER.TO — Zürich
      </p>
    </header>
  )
}
