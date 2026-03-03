"use client"

import { SessionProvider } from "next-auth/react"

/**
 * Root client providers wrapper.
 * Provides next-auth session context to the entire app.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
