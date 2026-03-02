# Phase 8: Admin Panel & Image Upload

## Overview

A hidden `/admin` route protected by GitHub OAuth. Only the whitelisted GitHub username can access it. The admin can upload a new image via a slide-in sheet. The upload is processed server-side by a Netlify Function (Sharp compression + atomic GitHub commit), and the new image appears instantly in the admin's session via React state.

---

## 8.1 next-auth Setup

**File**: `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // Only allow the whitelisted GitHub username
      return profile?.login === process.env.ALLOWED_GITHUB_USERNAME
    },
    async session({ session, token }) {
      // Attach the access token to the session for use in the Netlify Function
      ;(session as any).accessToken = token.accessToken
      return session
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
```

**Required env vars**: `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ALLOWED_GITHUB_USERNAME`

**GitHub OAuth App setup**:
1. Go to `github.com/settings/developers` → "OAuth Apps" → "New OAuth App"
2. Homepage URL: your Netlify deployment URL
3. Authorization callback URL: `{NEXTAUTH_URL}/api/auth/callback/github`
4. Copy Client ID → `GITHUB_ID`, generate Client Secret → `GITHUB_SECRET`

---

## 8.2 Admin Page

**File**: `src/app/admin/page.tsx`

Server component that checks session and redirects unauthorized users.

```typescript
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { AdminClient } from "./AdminClient"

export default async function AdminPage() {
  const session = await getServerSession()

  if (!session) {
    // Not logged in — redirect to GitHub login
    redirect("/api/auth/signin")
  }

  return <AdminClient />
}
```

**File**: `src/app/admin/AdminClient.tsx`

```typescript
"use client"

import { signOut } from "next-auth/react"
import { useState } from "react"
import { NewPieceSheet } from "@/components/admin/NewPieceSheet"
import { IconPlus, IconLogOut } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import type { GalleryImage } from "@/types"

export function AdminClient() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [recentlyAdded, setRecentlyAdded] = useState<GalleryImage[]>([])

  const handleImageAdded = (image: GalleryImage) => {
    setRecentlyAdded((prev) => [image, ...prev])
    setSheetOpen(false)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-sm font-bold mb-1">SUPI.ER.TO Admin</h1>
      <p className="text-xs text-muted-foreground mb-6">Add new pieces to the collection.</p>

      <div className="flex gap-2 mb-8">
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => setSheetOpen(true)}
        >
          <IconPlus className="w-3.5 h-3.5" />
          New piece arrival
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <IconLogOut className="w-3.5 h-3.5" />
          Log out
        </Button>
      </div>

      {recentlyAdded.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">Added this session (visible after rebuild):</p>
          <div className="flex flex-col gap-2">
            {recentlyAdded.map((img) => (
              <div key={img.id} className="flex items-center gap-3 border p-2 rounded-[2px] text-xs">
                <img
                  src={`/images/${img.id}.500.webp`}
                  alt=""
                  className="h-12 w-16 object-cover"
                />
                <span>{img.id}</span>
                <span className="text-muted-foreground">{img.tag}</span>
                <span className="text-muted-foreground">{img.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <NewPieceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={handleImageAdded}
      />
    </div>
  )
}
```

---

## 8.3 NewPieceSheet Component

**File**: `src/components/admin/NewPieceSheet.tsx`

```typescript
"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import type { GalleryImage, Tag } from "@/types"

interface NewPieceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (image: GalleryImage) => void
}

function getTodayISO() {
  return new Date().toISOString().split("T")[0] // "YYYY-MM-DD"
}

export function NewPieceSheet({ open, onOpenChange, onSuccess }: NewPieceSheetProps) {
  const { data: session } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [date, setDate] = useState(getTodayISO)
  const [tag, setTag] = useState<Tag>("supi")
  const [sortOrder, setSortOrder] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    // Revoke previous preview URL to avoid memory leaks
    if (previewUrl) URL.revokeObjectURL(previewUrl)

    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const handleSubmit = async () => {
    if (!file || !session) return
    setIsSubmitting(true)
    setError(null)

    try {
      // Convert file to base64 for JSON transport
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      const response = await fetch("/.netlify/functions/upload-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass the GitHub access token for server-side auth validation
          Authorization: `Bearer ${(session as any).accessToken}`,
        },
        body: JSON.stringify({
          file: base64,
          mimeType: file.type,
          date,
          tag,
          sortOrder,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || "Upload failed")
      }

      const { image } = await response.json()
      onSuccess(image)

      // Reset form
      setFile(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setDate(getTodayISO())
      setSortOrder(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle className="text-sm font-bold">New piece arrival</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-6">
          {/* File upload */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Image (JPG or PNG)</Label>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="text-xs cursor-pointer"
            />
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="border rounded-[2px] overflow-hidden">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-[250px] object-contain"
              />
            </div>
          )}

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Tag */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tag</Label>
            <RadioGroup
              value={tag}
              onValueChange={(v) => setTag(v as Tag)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="supi" id="tag-supi" />
                <Label htmlFor="tag-supi" className="text-xs cursor-pointer">SUPI.ER.TO</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="bone" id="tag-bone" />
                <Label htmlFor="tag-bone" className="text-xs cursor-pointer">BONE</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Sort order */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Sort order within this date</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              min={0}
              className="text-xs w-24"
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear earlier within the same date.
            </p>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!file || isSubmitting}
            className="text-xs"
          >
            {isSubmitting ? "Adding to collection…" : "Add to collection"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

---

## 8.4 Netlify Function

**File**: `netlify/functions/upload-image.ts`

```typescript
import type { Handler } from "@netlify/functions"
import sharp from "sharp"
import { commitFiles } from "../../src/lib/github"
import type { GalleryImage } from "../../src/types"

// Validate GitHub access token by calling the GitHub API
async function validateGithubToken(token: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "supi-er-to-admin" },
  })
  if (!res.ok) return null
  const user = await res.json()
  return user.login as string
}

// Fetch current images.json from the GitHub repo
async function fetchCurrentImages(
  token: string,
  owner: string,
  repo: string
): Promise<GalleryImage[]> {
  const { Octokit } = await import("@octokit/rest")
  const octokit = new Octokit({ auth: token })

  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path: "public/data/images.json",
  })

  if ("content" in data) {
    return JSON.parse(Buffer.from(data.content, "base64").toString("utf8"))
  }
  return []
}

const handler: Handler = async (event) => {
  // ─── Auth validation ───────────────────────────────────────────────────────

  const authHeader = event.headers["authorization"] || ""
  const token = authHeader.replace("Bearer ", "").trim()

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ message: "No token" }) }
  }

  const githubLogin = await validateGithubToken(token)
  if (githubLogin !== process.env.ALLOWED_GITHUB_USERNAME) {
    return { statusCode: 403, body: JSON.stringify({ message: "Unauthorized" }) }
  }

  // ─── Parse request body ───────────────────────────────────────────────────

  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ message: "No body" }) }
  }

  const body = JSON.parse(event.body)
  const { file: base64File, mimeType, date, tag, sortOrder } = body

  if (!base64File || !date || !tag) {
    return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) }
  }

  const imageBuffer = Buffer.from(base64File, "base64")

  // ─── Generate ID ──────────────────────────────────────────────────────────

  const id = `img-${Date.now()}`

  // ─── Compress with Sharp ──────────────────────────────────────────────────

  const SIZES = [500, 1280, 2400] as const
  const compressedBuffers: Buffer[] = await Promise.all(
    SIZES.map((width) =>
      sharp(imageBuffer)
        .resize(width, undefined, { withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
    )
  )

  // ─── Update images.json ───────────────────────────────────────────────────

  const repoOwner = process.env.GITHUB_REPO_OWNER!
  const repoName = process.env.GITHUB_REPO!.split("/")[1]
  const githubToken = process.env.GITHUB_TOKEN!

  const currentImages = await fetchCurrentImages(githubToken, repoOwner, repoName)

  const newEntry: GalleryImage = {
    id,
    filename: `${id}.webp`,
    date,
    sortOrder: Number(sortOrder),
    tag: tag as "bone" | "supi",
  }

  const updatedImages = [...currentImages, newEntry]

  // ─── Atomic GitHub commit ─────────────────────────────────────────────────

  await commitFiles(
    [
      {
        path: `public/images/${id}.500.webp`,
        content: compressedBuffers[0],
        encoding: "base64",
      },
      {
        path: `public/images/${id}.1280.webp`,
        content: compressedBuffers[1],
        encoding: "base64",
      },
      {
        path: `public/images/${id}.2400.webp`,
        content: compressedBuffers[2],
        encoding: "base64",
      },
      {
        path: "public/data/images.json",
        content: Buffer.from(JSON.stringify(updatedImages, null, 2), "utf8"),
        encoding: "base64",
      },
    ],
    `Add new piece: ${id} (${tag}, ${date})`,
    {
      token: githubToken,
      owner: repoOwner,
      repo: repoName,
    }
  )

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, image: newEntry }),
  }
}

export { handler }
```

---

## 8.5 Netlify Function Dependencies

The Netlify Function bundles its dependencies using `nft` (Node File Tracing). Sharp must be included:

```toml
# netlify.toml
[functions]
  directory = "netlify/functions"
  node_bundler = "nft"
  included_files = ["node_modules/sharp/**"]
```

Sharp requires platform-specific binaries. Netlify Functions run on Linux, so install the Linux binary:

```bash
# Netlify automatically installs the correct binary during build
# But add to package.json to ensure it's available:
npm install sharp
```

---

## 8.6 Admin Link (Hidden)

The `/admin` route has no link from the main navigation. Access it by typing the URL directly. There is no breadcrumb or back link — admin is purely a functional tool.

To navigate back to the gallery from admin, the user types `/` or uses the browser back button.

---

## 8.7 Session Provider

next-auth requires a `<SessionProvider>` wrapper. Add it in a client layout or wrapper:

**File**: `src/components/providers.tsx`

```typescript
"use client"

import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

Add to `src/app/layout.tsx`:

```typescript
import { Providers } from "@/components/providers"

export default function RootLayout({ children }) {
  return (
    <html ...>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```
