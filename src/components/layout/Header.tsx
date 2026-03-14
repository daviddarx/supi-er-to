/**
 * Site header — displays the site title and tagline.
 * Sticky: sticks to the top of the page on both desktop and mobile.
 * Transparent background — content scrolls visibly behind it.
 */
export function Header() {
  return (
    <header className="p-gutter">
      <h1 className="leading-tight font-bold tracking-tight">SUPI.ER.TO</h1>
      <p className="text-muted-foreground leading-tight font-normal">
        BONE is dead — long live SUPI.ER.TO — Zürich
      </p>
    </header>
  )
}
