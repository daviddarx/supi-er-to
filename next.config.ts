import type { NextConfig } from "next"

/**
 * Note: `output: "export"` has been removed.
 *
 * This project is deployed via @netlify/plugin-nextjs, which acts as a
 * full Next.js server adapter on Netlify — it does NOT require a static
 * export. With `output: "export"`, Next.js refuses to compile server
 * components, API routes, and middleware, which breaks:
 *   - next-auth (/api/auth/[...nextauth])
 *   - The admin page (server component + getServerSession)
 *   - Any future server-side features
 *
 * The plugin handles SSR, ISR, and API routes as Netlify Functions, and
 * reads from .next/ — which is what netlify.toml's `publish = ".next"` points at.
 * images.unoptimized stays true because Next.js Image Optimization is not
 * needed; images are already pre-compressed WebPs.
 */
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
}

export default nextConfig
