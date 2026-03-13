import type { MetadataRoute } from "next"

/**
 * PWA Web App Manifest served at /manifest.webmanifest.
 * Enables standalone (fullscreen) mode on iOS and Android when installed
 * to the home screen. No service worker / offline caching is included.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SUPI.ER.TO",
    short_name: "SUPI",
    description: "BONE is dead — long live SUPI.ER.TO — Zürich",
    start_url: "/classic",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
