import type { Metadata, Viewport } from "next"
import { DM_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
})

export const metadata: Metadata = {
  title: "SUPI.ER.TO",
  description: "BONE is dead — long live SUPI.ER.TO — Zürich",
}

/**
 * Prevent auto-zoom on input focus on iOS by capping maximumScale to 1.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} dark`} suppressHydrationWarning>
      <body className="bg-background text-foreground font-mono antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
