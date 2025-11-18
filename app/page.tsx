"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Space_Grotesk } from "next/font/google"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Download, ImageIcon, ZoomIn, ZoomOut, RotateCcw, User } from "lucide-react"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
})

type TemplateId = "speaking" | "attending"

type Template = {
  id: TemplateId
  title: string
  src: string
  // Anchor and size defined on a 980×980 baseline, then scaled to native size.
  innerAnchorPx: { x: number; y: number }
  innerSizePx: { w: number; h: number }
}

// You provided the exact frame metrics on the graphic:
// - Graphic baseline: 980 × 980
// - Photo frame: 450 × 500
// - Offsets: 493 (left), 443 (top)
// These are self-consistent: 493 + 450 = 943 and 443 + 500 = 943
const BASE = 980
// Update these coordinates to match your new template's photo area
const EXACT_FRAME = {
  x: 602, // X position of photo area (adjust for your template)
  y: 443, // Y position of photo area (adjust for your template)
  w: 230, // Width of photo area
  h: 250, // Height of photo area
}

// Update these coordinates to match your template's name area
const NAME_AREA = {
  x: 565, // X position of name area (adjust for your template)
  y: 700, // Y position of name area (adjust for your template)
  w: 300, // Width of name area
  h: 95, // Height of name area
}

const TEMPLATES: Template[] = [
  {
    id: "speaking",
    title: "I am Speaking at",
    src: "/images/Speaker.png",
    innerAnchorPx: { x: EXACT_FRAME.x, y: EXACT_FRAME.y },
    innerSizePx: { w: EXACT_FRAME.w, h: EXACT_FRAME.h },
  },
  {
    id: "attending",
    title: "Thrilled to be attending",
    src: "/images/Attendee.png",
    innerAnchorPx: { x: EXACT_FRAME.x, y: EXACT_FRAME.y },
    innerSizePx: { w: EXACT_FRAME.w, h: EXACT_FRAME.h },
  },
]

// cross‑origin safe loader for canvas export
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function useTemplateImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    let mounted = true
    loadImage(src)
      .then((i) => mounted && setImg(i))
      .catch(() => mounted && setImg(null))
    return () => {
      mounted = false
    }
  }, [src])
  return img
}

export default function Page() {
  const [templateId, setTemplateId] = useState<TemplateId>("attending")
  const template = useMemo(() => TEMPLATES.find((t) => t.id === templateId)!, [templateId])
  const templateImg = useTemplateImage(template.src)

  // Upload
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [userImg, setUserImg] = useState<HTMLImageElement | null>(null)
  const triggerUpload = () => fileInputRef.current?.click()
  const onFileSelected = (file: File | null) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      URL.revokeObjectURL(url)
      setUserImg(img)
      // Reset placement to cover-fit
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    img.src = url
  }

  // User adjustments (on top of cover-fit)
  const [zoom, setZoom] = useState(1) // 1 = cover fit
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [userName, setUserName] = useState("")

  // Drag-to-pan state
  const [panning, setPanning] = useState(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  // Reset interactions on template change (prevents “hang”)
  useEffect(() => {
    setPanning(false)
    lastPoint.current = null
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [templateId])

  // Canvas drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (!templateImg) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Use native template size for crisp export
    const W = templateImg.naturalWidth || templateImg.width
    const H = templateImg.naturalHeight || templateImg.height
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W
      canvas.height = H
    }
    ctx.clearRect(0, 0, W, H)

    // Draw template first
    ctx.drawImage(templateImg, 0, 0, W, H)

    // Compute inner window from 980 baseline -> native scale
    const scaleX = W / BASE
    const scaleY = H / BASE
    const inner = {
      x: Math.round(template.innerAnchorPx.x * scaleX),
      y: Math.round(template.innerAnchorPx.y * scaleY),
      w: Math.round(template.innerSizePx.w * scaleX),
      h: Math.round(template.innerSizePx.h * scaleY),
    }

    // Draw user photo inside the precise window with rounded corners
    if (userImg) {
      ctx.save()
      const radius = 15 * (W / BASE) // 10px radius scaled to canvas size
      ctx.beginPath()
      ctx.roundRect(inner.x, inner.y, inner.w, inner.h, radius)
      ctx.clip()

      const iw = userImg.naturalWidth || userImg.width
      const ih = userImg.naturalHeight || userImg.height

      // Cover-fit base, then apply user zoom
      const base = Math.max(inner.w / iw, inner.h / ih)
      const scale = base * zoom
      const drawW = iw * scale
      const drawH = ih * scale

      const centerX = inner.x + inner.w / 2 + offset.x
      const centerY = inner.y + inner.h / 2 + offset.y
      const drawX = centerX - drawW / 2
      const drawY = centerY - drawH / 2

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(userImg, drawX, drawY, drawW, drawH)
      ctx.restore()
      
      // Draw border around photo area
      ctx.save()
      const borderWidth = 2 * (W / BASE) // 2px border scaled to canvas size
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = borderWidth
      ctx.beginPath()
      ctx.roundRect(inner.x, inner.y, inner.w, inner.h, radius)
      ctx.stroke()
      ctx.restore()
    }

    // Draw user name if provided in repositionable block
    if (userName.trim()) {
      ctx.save()
      
      // Define text block using NAME_AREA coordinates (scaled to canvas size)
      const blockW = NAME_AREA.w * (W / BASE)
      const blockH = NAME_AREA.h * (H / BASE)
      const blockX = NAME_AREA.x * (W / BASE)
      const blockY = NAME_AREA.y * (H / BASE)
      
      // Clip to text block area
      ctx.beginPath()
      ctx.rect(blockX, blockY, blockW, blockH)
      ctx.clip()
      
      let fontSize = Math.round(blockH * 0.35) // Start with 35% of block height
      ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`
      ctx.fillStyle = "#000000"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      
      const words = userName.trim().split(' ')
      const textX = blockX + blockW / 2
      
      // Check if text fits in one line
      const fullText = words.join(' ')
      let textWidth = ctx.measureText(fullText).width
      
      // Reduce font size if text is too wide
      while (textWidth > blockW * 0.9 && fontSize > 12) {
        fontSize -= 2
        ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`
        textWidth = ctx.measureText(fullText).width
      }
      
      // If still too wide, split into two lines
      if (textWidth > blockW * 0.9 && words.length > 1) {
        const lastWord = words[words.length - 1]
        const firstLine = words.slice(0, -1).join(' ')
        const lineHeight = fontSize * 1.2
        
        ctx.fillText(firstLine, textX, blockY + blockH / 2 - lineHeight / 2)
        ctx.fillText(lastWord, textX, blockY + blockH / 2 + lineHeight / 2)
      } else {
        ctx.fillText(fullText, textX, blockY + blockH / 2)
      }
      
      ctx.restore()
    }
  }, [template, templateImg, userImg, zoom, offset, userName])

  // Pointer handlers for pan (only within photo area)
  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas || !templateImg) return
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY
    
    // Check if click is within photo area
    const W = templateImg.naturalWidth || templateImg.width
    const H = templateImg.naturalHeight || templateImg.height
    const innerScaleX = W / BASE
    const innerScaleY = H / BASE
    const inner = {
      x: Math.round(template.innerAnchorPx.x * innerScaleX),
      y: Math.round(template.innerAnchorPx.y * innerScaleY),
      w: Math.round(template.innerSizePx.w * innerScaleX),
      h: Math.round(template.innerSizePx.h * innerScaleY),
    }
    
    if (canvasX >= inner.x && canvasX <= inner.x + inner.w && 
        canvasY >= inner.y && canvasY <= inner.y + inner.h) {
      setPanning(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      lastPoint.current = { x: e.clientX, y: e.clientY }
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!panning || !lastPoint.current) return
    const dx = e.clientX - lastPoint.current.x
    const dy = e.clientY - lastPoint.current.y
    lastPoint.current = { x: e.clientX, y: e.clientY }
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }
  const endPan = (e: React.PointerEvent) => {
    setPanning(false)
    lastPoint.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }
  }

  // Wheel zoom (only within photo area)
  const onWheelZoom = (e: React.WheelEvent) => {
    const canvas = canvasRef.current
    if (!canvas || !templateImg) return
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY
    
    // Check if mouse is within photo area
    const W = templateImg.naturalWidth || templateImg.width
    const H = templateImg.naturalHeight || templateImg.height
    const innerScaleX = W / BASE
    const innerScaleY = H / BASE
    const inner = {
      x: Math.round(template.innerAnchorPx.x * innerScaleX),
      y: Math.round(template.innerAnchorPx.y * innerScaleY),
      w: Math.round(template.innerSizePx.w * innerScaleX),
      h: Math.round(template.innerSizePx.h * innerScaleY),
    }
    
    if (canvasX >= inner.x && canvasX <= inner.x + inner.w && 
        canvasY >= inner.y && canvasY <= inner.y + inner.h) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.05 : 0.05
      setZoom((z) => clamp(Number.parseFloat((z + delta).toFixed(2)), 1, 3))
    }
  }

  // Download
  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = `${template.id}-badge.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <main
      className={cn("min-h-dvh bg-white text-gray-900 antialiased", spaceGrotesk.variable)}
      style={{ fontFamily: "var(--font-space-grotesk)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <header className="mb-6 md:mb-8 flex items-center justify-between gap-4">
          <img
            src="/images/ASCD-PU-LOGO.png"
            alt="ASCD Parul University logo"
            className="h-16 md:h-20 w-auto"
            crossOrigin="anonymous"
          />
          <img
            src="/images/cloud-club-logo.png"
            alt="Cloud Club logo"
            className="h-16 md:h-20 w-auto"
            crossOrigin="anonymous"
          />
        </header>
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[#FF9900]">ASCDPU - Badge Maker</h1>
          <p className="text-sm sm:text-lg text-gray-700 mt-2 sm:mt-3">
            Create your AWS Student Community Day badge with ease
          </p>
        </div>

        {/* Step 1: Template */}
        <Card className="bg-white border-gray-200 shadow-lg mb-6 sm:mb-8">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-gray-900 text-lg sm:text-xl">Choose Badge Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={templateId} onValueChange={(v) => setTemplateId(v as TemplateId)}>
              <TabsList className="bg-gray-100 w-full max-w-80 mx-auto h-10 sm:h-12">
                <TabsTrigger
                  value="speaking"
                  className="flex-1 h-8 sm:h-10 data-[state=active]:bg-[#FF9900] data-[state=active]:text-white text-xs sm:text-sm"
                >
                  Speaker
                </TabsTrigger>
                <TabsTrigger
                  value="attending"
                  className="flex-1 h-8 sm:h-10 data-[state=active]:bg-[#FF9900] data-[state=active]:text-white text-xs sm:text-sm"
                >
                  Attendee
                </TabsTrigger>
              </TabsList>
              <TabsContent value="speaking" className="mt-4 sm:mt-6">
                <div className="bg-orange-50 rounded-lg p-4 sm:p-6 border border-orange-200">
                  <h3 className="text-base sm:text-lg font-semibold text-[#FF9900] mb-1 sm:mb-2">Speaker Badge</h3>
                  <p className="text-gray-600 text-sm sm:text-base">This will generate an Speaking post.</p>
                </div>
              </TabsContent>
              <TabsContent value="attending" className="mt-4 sm:mt-6">
                <div className="bg-orange-50 rounded-lg p-4 sm:p-6 border border-orange-200">
                  <h3 className="text-base sm:text-lg font-semibold text-[#FF9900] mb-1 sm:mb-2">Attendee Badge</h3>
                  <p className="text-gray-600 text-sm sm:text-base">This will generate an Attending post.</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Step 2: Upload & Adjust */}
        <Card className="bg-white border-gray-200 shadow-lg">
          <CardHeader className="pb-4 md:pb-6">
            <CardTitle className="text-gray-900 text-lg md:text-xl">Upload & Customize</CardTitle>
            <CardDescription className="text-gray-700 text-sm md:text-base">
              Upload your photo and adjust the positioning
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:gap-4 md:gap-5">
            <div className="bg-orange-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-8 border-2 border-dashed border-orange-300 text-center">
              <div className="mb-3 sm:mb-4 md:mb-6">
                <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 md:h-12 md:w-12 text-[#FF9900] mx-auto mb-1 sm:mb-2 md:mb-3" />
                <h3 className="text-xs sm:text-sm md:text-lg font-medium text-gray-900 mb-1 md:mb-2">Upload Your Photo</h3>
                <p className="text-gray-600 text-xs md:text-sm">Choose a clear Photo for best results</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  onFileSelected(file)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
              />
              <Button 
                className="bg-[#FF9900] hover:bg-[#E6890A] text-white w-24 h-8 sm:w-28 sm:h-9 md:w-40 md:h-12 rounded-lg font-medium text-xs sm:text-sm md:text-base" 
                onClick={triggerUpload} 
                type="button"
              >
                Choose Photo
              </Button>
            </div>

            <div className="bg-orange-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border-2 border-dashed border-orange-300">
              <div className="mb-2 sm:mb-3 md:mb-4">
                <User className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-[#FF9900] mx-auto mb-1 md:mb-2" />
                <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 mb-1 md:mb-2 text-center">Enter Your Name</h3>
                <p className="text-gray-600 text-xs md:text-sm text-center mb-2 sm:mb-3 md:mb-4">This will appear on your badge</p>
              </div>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9900] focus:border-transparent text-center font-medium text-xs sm:text-sm md:text-base"
                maxLength={30}
              />
            </div>

            <div
              className="relative mx-auto w-full max-w-[280px] sm:max-w-[400px] md:max-w-[500px] aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-gray-50 border border-gray-200 cursor-grab active:cursor-grabbing touch-none select-none shadow-xl"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPan}
              onPointerCancel={endPan}
              onPointerLeave={(e) => {
                if (panning) endPan(e as unknown as React.PointerEvent)
              }}
              onWheel={onWheelZoom}
              role="img"
              aria-label="Badge preview"
              aria-busy={!templateImg}
            >
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            </div>

            <div>
              <div className="bg-orange-50 rounded-lg p-2 sm:p-3 md:p-4 border border-orange-200">
                <div className="flex items-center justify-between mb-1 sm:mb-2 md:mb-3">
                  <Label className="text-gray-900 font-medium text-xs sm:text-sm md:text-base">Adjust Size</Label>
                  <span className="text-xs md:text-sm text-gray-600">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-orange-300 text-[#FF9900] hover:bg-orange-100 w-6 h-6 sm:w-7 sm:h-7 md:w-10 md:h-10 p-0 flex-shrink-0"
                    onClick={() => setZoom((z) => clamp(Number.parseFloat((z - 0.1).toFixed(2)), 1, 3))}
                  >
                    <ZoomOut className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4" />
                  </Button>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(clamp(Number.parseFloat(e.target.value), 1, 3))}
                    className="flex-1 h-1.5 sm:h-2 rounded-full bg-orange-200"
                    style={{ accentColor: "#FF9900" }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-orange-300 text-[#FF9900] hover:bg-orange-100 w-6 h-6 sm:w-7 sm:h-7 md:w-10 md:h-10 p-0 flex-shrink-0"
                    onClick={() => setZoom((z) => clamp(Number.parseFloat((z + 0.1).toFixed(2)), 1, 3))}
                  >
                    <ZoomIn className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-gray-600 hover:text-gray-900 w-6 h-6 sm:w-7 sm:h-7 md:w-10 md:h-10 p-0 flex-shrink-0"
                    onClick={() => {
                      setZoom(1)
                      setOffset({ x: 0, y: 0 })
                    }}
                  >
                    <RotateCcw className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-4 md:pt-6">
            <Button
              type="button"
              onClick={downloadImage}
              className="w-full bg-[#FF9900] hover:bg-[#E6890A] text-white h-10 md:h-14 rounded-lg font-medium text-sm md:text-lg"
              disabled={!templateImg}
            >
              <Download className="h-3 w-3 md:h-5 md:w-5 mr-1 md:mr-2" />
              Download Badge
            </Button>
          </CardFooter>
        </Card>
        
        <footer className="text-center mt-8 py-4">
          <p className="text-gray-600 text-sm">
            Made with ❤️ by AWS Cloud Club at Parul University
          </p>
        </footer>
      </div>
    </main>
  )
}

// utils
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}
