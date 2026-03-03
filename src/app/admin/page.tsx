import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { AdminClient } from "./AdminClient"

/**
 * Server component that guards the admin route.
 * Unauthenticated visitors are redirected to the GitHub OAuth sign-in page.
 * Authenticated sessions render the AdminClient component.
 */
export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/api/auth/signin")
  }

  return <AdminClient />
}
