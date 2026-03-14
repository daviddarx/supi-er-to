"use client"

import dynamic from "next/dynamic"

const GalleryPageClient = dynamic(() => import("./GalleryPageClient"), {
  ssr: false,
})

export default function ClientLoader() {
  return <GalleryPageClient />
}
