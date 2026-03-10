"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import type { GalleryImage, Tag } from "@/types"

// Augment next-auth's Session type to include the GitHub OAuth access token
// that next-auth stores under session.accessToken (configured in [...nextauth]/route.ts).
declare module "next-auth" {
  interface Session {
    accessToken?: string
  }
}

interface NewPieceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the newly created GalleryImage entry on successful upload. */
  onSuccess: (image: GalleryImage) => void
}

/** Returns today's date in YYYY-MM-DD format (local timezone). */
function getTodayISO(): string {
  return new Date().toISOString().split("T")[0]
}

/**
 * Safely base64-encodes an ArrayBuffer without hitting the call-stack limit
 * that `btoa(String.fromCharCode(...new Uint8Array(buffer)))` causes for
 * large files (> ~500 KB) due to spreading a large array into Function.apply.
 *
 * @param buffer - Raw file bytes
 * @returns Base64-encoded string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer)
  let binary = ""
  const CHUNK = 8192 // process 8 KB at a time to stay within stack limits
  for (let i = 0; i < uint8.length; i += CHUNK) {
    binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/**
 * Netlify synchronous functions cap the request body at 6 MB.
 * Base64 encoding adds ~33 % overhead, so the raw file must stay under ~4 MB
 * to keep the encoded body comfortably below that limit.
 */
const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4 MB

/**
 * Slide-in sheet form for adding a new graffiti piece to the collection.
 *
 * On submit it:
 * 1. Reads the selected file as an ArrayBuffer and base64-encodes it.
 * 2. POSTs to the Netlify Function with the file, metadata, and the
 *    user's GitHub OAuth access token (forwarded for server-side validation).
 * 3. Calls `onSuccess` with the new GalleryImage entry returned by the function.
 */
export function NewPieceSheet({ open, onOpenChange, onSuccess }: NewPieceSheetProps) {
  const { data: session } = useSession()

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [date, setDate] = useState<string>(getTodayISO)
  const [tag, setTag] = useState<Tag>("supi")
  const [sortOrder, setSortOrder] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (selected.size > MAX_FILE_BYTES) {
      const mb = (selected.size / (1024 * 1024)).toFixed(1)
      setError(
        `File is too large (${mb} MB). Maximum is 4 MB. Please resize or compress the image first.`
      )
      e.target.value = ""
      return
    }

    setError(null)

    // Revoke previous object URL to avoid memory leaks
    if (previewUrl) URL.revokeObjectURL(previewUrl)

    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const handleSubmit = async () => {
    if (!file || !session) return

    setIsSubmitting(true)
    setError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = arrayBufferToBase64(arrayBuffer)

      const response = await fetch("/.netlify/functions/upload-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward the GitHub OAuth token; the Netlify Function validates
          // it against the GitHub API and the ALLOWED_GITHUB_USERNAME env var.
          Authorization: `Bearer ${session?.accessToken}`,
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
        let message = `Upload failed (HTTP ${response.status})`
        try {
          const json = await response.json()
          message = json.message || message
        } catch {
          const text = (await response.text()).trim()
          if (text) message = text
        }
        throw new Error(message)
      }

      const { image } = await response.json()

      // Capture the blob URL before resetForm clears it, so we can pass it
      // to onSuccess for optimistic display in the gallery before rebuild.
      const capturedPreviewSrc = previewUrl ?? undefined

      // Reset form state before calling onSuccess so the sheet closes cleanly
      resetForm()
      onSuccess({ ...image, previewSrc: capturedPreviewSrc })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    // Note: we do NOT revoke previewUrl here — it may be passed to onSuccess
    // for optimistic display in the gallery. The browser releases the blob
    // automatically when the page unloads or when a new file is selected.
    setPreviewUrl(null)
    setDate(getTodayISO())
    setTag("supi")
    setSortOrder(0)
    setError(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle className="text-sm font-bold">New piece arrival</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-5">
          {/* File picker */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Image (JPG or PNG)</Label>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="cursor-pointer text-xs"
            />
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="overflow-hidden rounded-[2px] border">
              <img src={previewUrl} alt="Preview" className="max-h-[250px] w-full object-contain" />
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
            <RadioGroup value={tag} onValueChange={(v) => setTag(v as Tag)} className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="supi" id="tag-supi" />
                <Label htmlFor="tag-supi" className="cursor-pointer text-xs">
                  SUPI.ER.TO
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="bone" id="tag-bone" />
                <Label htmlFor="tag-bone" className="cursor-pointer text-xs">
                  BONE
                </Label>
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
              className="w-24 text-xs"
              placeholder="0"
            />
            <p className="text-muted-foreground text-xs">
              Lower numbers appear earlier within the same date.
            </p>
          </div>

          {/* Error */}
          {error && <p className="text-destructive text-xs break-words">{error}</p>}

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={!file || isSubmitting} className="text-xs">
            {isSubmitting ? "Adding to collection…" : "Add to collection"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
