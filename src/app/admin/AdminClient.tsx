"use client"

import { signOut } from "next-auth/react"
import { useState } from "react"
import { NewPieceSheet } from "@/components/admin/NewPieceSheet"
import { IconPlus, IconLogOut } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import type { GalleryImage } from "@/types"

/**
 * Client-side admin panel UI.
 *
 * Manages local state for the upload sheet and a session-scoped list of
 * recently added pieces. The list is informational only — images are not
 * served from /images/ until the next Netlify rebuild commits them to the repo.
 */
export function AdminClient() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [recentlyAdded, setRecentlyAdded] = useState<GalleryImage[]>([])

  /**
   * Called by NewPieceSheet on successful upload.
   * Prepends the new image to the session list and closes the sheet.
   */
  const handleImageAdded = (image: GalleryImage) => {
    setRecentlyAdded((prev) => [image, ...prev])
    setSheetOpen(false)
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-1 text-sm font-bold">SUPI.ER.TO Admin</h1>
      <p className="text-muted-foreground mb-6 text-xs">Add new pieces to the collection.</p>

      <div className="mb-8 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setSheetOpen(true)}
        >
          <IconPlus className="h-3.5 w-3.5" />
          New piece arrival
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <IconLogOut className="h-3.5 w-3.5" />
          Log out
        </Button>
      </div>

      {recentlyAdded.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-3 text-xs">
            Added this session (visible after rebuild):
          </p>
          <div className="flex flex-col gap-2">
            {recentlyAdded.map((img) => (
              <div key={img.id} className="flex items-center gap-3 border p-2 text-xs">
                {/* Preview shown from the optimistic /images/ path — won't load until rebuild */}
                <img
                  src={`/images/${img.id}.500.webp`}
                  alt={`${img.tag} piece from ${img.date}`}
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

      <NewPieceSheet open={sheetOpen} onOpenChange={setSheetOpen} onSuccess={handleImageAdded} />
    </div>
  )
}
