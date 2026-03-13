import { permanentRedirect } from "next/navigation"

/**
 * Root page — permanently redirects to /classic.
 * This is a server component; no client bundle is needed.
 * The @netlify/plugin-nextjs adapter handles the 308 response.
 */
export default function RootPage() {
  permanentRedirect("/classic")
}
