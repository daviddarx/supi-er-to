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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var isDark = saved ? saved === 'dark' : true;
                  document.documentElement.classList.toggle('dark', isDark);
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* PWA: standalone mode on iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="SUPI" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* Theme color responds to OS color scheme preference */}
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      </head>
      <body className="bg-background text-foreground font-mono antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
