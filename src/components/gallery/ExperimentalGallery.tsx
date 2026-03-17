"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import * as THREE from "three"
import { ThreeDScene, CAMERA_START_Z } from "./experimental/ThreeDScene"
import { getImageSrc } from "@/lib/images"
import type { GalleryImage } from "@/types"

interface ExperimentalGalleryProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

const textureLoader = new THREE.TextureLoader()

const SPINNER_SIZE = 80
const STROKE_WIDTH = 2
const RADIUS = (SPINNER_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ExperimentalGallery({ images, isDarkMode }: ExperimentalGalleryProps) {
  const bgColor = isDarkMode ? "#0a0a0a" : "#f8f8f8"
  const [ready, setReady] = useState(false)

  // Direct DOM refs — bypass React for smooth updates during heavy loading
  const ringRef = useRef<SVGCircleElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const loaderRef = useRef<HTMLDivElement>(null)
  const countRef = useRef(0)

  const color = isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"
  const trackColor = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"

  useEffect(() => {
    if (images.length === 0) {
      setReady(true)
      return
    }

    countRef.current = 0
    const total = images.length

    for (const image of images) {
      const url = getImageSrc(image.id, 1280)
      textureLoader.load(url, () => {
        countRef.current++
        const count = countRef.current

        // Direct DOM mutations — no React, no rAF needed
        if (textRef.current) {
          textRef.current.textContent = `${count}/${total}`
        }
        if (ringRef.current) {
          const progress = count / total
          ringRef.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress))
        }

        if (count >= total) {
          setReady(true)
        }
      })
    }
  }, [images])

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {!ready && (
        <div
          ref={loaderRef}
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div style={{ position: "relative", width: SPINNER_SIZE, height: SPINNER_SIZE }}>
            <svg width={SPINNER_SIZE} height={SPINNER_SIZE} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={SPINNER_SIZE / 2}
                cy={SPINNER_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={trackColor}
                strokeWidth={STROKE_WIDTH}
              />
              <circle
                ref={ringRef}
                cx={SPINNER_SIZE / 2}
                cy={SPINNER_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE}
                strokeLinecap="round"
              />
            </svg>
            <div
              ref={textRef}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "11px",
                color,
              }}
            >
              0/{images.length}
            </div>
          </div>
        </div>
      )}

      <div style={{ width: "100%", height: "100%", opacity: ready ? 1 : 0 }}>
        <Canvas
          camera={{ position: [0, 0, CAMERA_START_Z], fov: 50, near: 0.1, far: 5000 }}
          gl={{ antialias: true, alpha: false, logarithmicDepthBuffer: true }}
          style={{ background: bgColor }}
        >
          <Suspense fallback={null}>
            <ThreeDScene images={images} isDarkMode={isDarkMode} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}
