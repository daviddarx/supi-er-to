import NextAuth, { type NextAuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"

/**
 * next-auth configuration.
 * Exported so server components can pass it to getServerSession(authOptions)
 * without re-declaring providers in multiple places.
 *
 * Sign-in is restricted to a single GitHub username via the ALLOWED_GITHUB_USERNAME
 * environment variable, enforced in the signIn callback.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    /**
     * Allow sign-in only if the GitHub login matches the configured allowlist.
     * Returns false → next-auth shows the built-in "AccessDenied" page.
     */
    async signIn({ profile }) {
      // next-auth's base Profile type omits provider-specific fields.
      // GitHub always returns `login`; cast to access it safely.
      return (profile as { login?: string })?.login === process.env.ALLOWED_GITHUB_USERNAME
    },

    /**
     * Attach the OAuth access token to the session object so client code
     * can forward it to the Netlify Function for server-side validation.
     */
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(session as any).accessToken = token.accessToken
      return session
    },

    /**
     * Persist the OAuth access token in the JWT on first sign-in so it
     * survives across session refreshes without re-prompting the user.
     */
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
