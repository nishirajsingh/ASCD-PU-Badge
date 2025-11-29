"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Poppins } from "next/font/google"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Download, ImageIcon, ZoomIn, ZoomOut, RotateCcw, User, Share2, X } from "lucide-react"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-poppins",
})

type Template = {
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
  x: 540, // X position of photo area (adjust for your template)
  y: 390, // Y position of photo area (adjust for your template)
  w: 270, // Width of photo area
  h: 280, // Height of photo area
}

// Update these coordinates to match your template's name area
const NAME_AREA = {
  x: 500, // X position of name area (adjust for your template)
  y: 680, // Y position of name area (adjust for your template)
  w: 350, // Width of name area
  h: 100, // Height of name area
}

const TEMPLATE: Template = {
  title: "Thrilled to be attending",
  src: "/images/Attendee.png",
  innerAnchorPx: { x: EXACT_FRAME.x, y: EXACT_FRAME.y },
  innerSizePx: { w: EXACT_FRAME.w, h: EXACT_FRAME.h },
}

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
  const template = TEMPLATE
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
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const [showLinkedInPopup, setShowLinkedInPopup] = useState(false)

  // Drag-to-pan state
  const [panning, setPanning] = useState(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

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
      ctx.font = `bold ${fontSize}px "Poppins", sans-serif`
      ctx.fillStyle = "#000000"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      
      const textX = blockX + blockW / 2
      const lineHeight = fontSize * 1.2
      
      // Split text at 17 characters
      const text = userName.trim()
      const lines: string[] = []
      
      if (text.length <= 17) {
        lines.push(text)
      } else {
        // Find the best break point around 17 characters
        let breakPoint = 17
        while (breakPoint > 0 && text[breakPoint] !== ' ') {
          breakPoint--
        }
        if (breakPoint === 0) breakPoint = 17 // Force break if no space found
        
        lines.push(text.substring(0, breakPoint).trim())
        lines.push(text.substring(breakPoint).trim())
      }
      
      // Draw lines
      if (lines.length === 1) {
        ctx.fillText(lines[0], textX, blockY + blockH / 2)
      } else {
        ctx.fillText(lines[0], textX, blockY + blockH / 2 - lineHeight / 2)
        ctx.fillText(lines[1], textX, blockY + blockH / 2 + lineHeight / 2)
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
    if (!panning || !lastPoint.current || !userImg || !templateImg) return
    const dx = e.clientX - lastPoint.current.x
    const dy = e.clientY - lastPoint.current.y
    lastPoint.current = { x: e.clientX, y: e.clientY }
    
    setOffset((prev) => {
      const W = templateImg.naturalWidth || templateImg.width
      const H = templateImg.naturalHeight || templateImg.height
      const scaleX = W / BASE
      const scaleY = H / BASE
      const inner = {
        w: Math.round(template.innerSizePx.w * scaleX),
        h: Math.round(template.innerSizePx.h * scaleY),
      }
      
      const iw = userImg.naturalWidth || userImg.width
      const ih = userImg.naturalHeight || userImg.height
      const base = Math.max(inner.w / iw, inner.h / ih)
      const scale = base * zoom
      const drawW = iw * scale
      const drawH = ih * scale
      
      // Calculate bounds
      const maxOffsetX = Math.max(0, (drawW - inner.w) / 2)
      const maxOffsetY = Math.max(0, (drawH - inner.h) / 2)
      
      const newX = Math.max(-maxOffsetX, Math.min(maxOffsetX, prev.x + dx))
      const newY = Math.max(-maxOffsetY, Math.min(maxOffsetY, prev.y + dy))
      
      return { x: newX, y: newY }
    })
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
      setZoom((z) => {
        const newZoom = Math.max(1, Math.min(3, Number.parseFloat((z + delta).toFixed(2))))
        // Reset offset when zooming to prevent going out of bounds
        if (newZoom !== z) {
          setOffset({ x: 0, y: 0 })
        }
        return newZoom
      })
    }
  }

  // Download
  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = "attendee-badge.png"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setHasDownloaded(true)
  }

  // Share on LinkedIn
  const shareOnLinkedIn = () => {
    if (!hasDownloaded) {
      alert("Please download the badge first!")
      return
    }
    setShowLinkedInPopup(true)
  }

  const proceedToLinkedIn = async () => {
    const caption = `🎉 Excited to attend 𝗔𝗪𝗦 𝗦𝘁𝘂𝗱𝗲𝗻𝘁 𝗖𝗼𝗺𝗺𝘂𝗻𝗶𝘁𝘆 𝗗𝗮𝘆 𝟮𝟬𝟮𝟱 at 𝗣𝗮𝗿𝘂𝗹 𝗨𝗻𝗶𝘃𝗲𝗿𝘀𝗶𝘁𝘆!\n\nA full day of learning in 𝗰𝗹𝗼𝘂𝗱, 𝗗𝗮𝘁𝗮, 𝗔𝗜, 𝗗𝗲𝘃𝗢𝗽𝘀 and more.\n\nLooking forward to gaining real insights, exploring tech careers and connecting with the AWS community.\n\n📅 𝟭𝟯 𝗗𝗲𝗰 𝟮𝟬𝟮𝟱\n📍 𝗣𝗮𝗿𝘂𝗹 𝗨𝗻𝗶𝘃𝗲𝗿𝘀𝗶𝘁𝘆, 𝗩𝗮𝗱𝗼𝗱𝗮𝗿𝗮, 𝗚𝘂𝗷𝗮𝗿𝗮𝘁\n🎟 Tickets: cloudclubpu.me\n\n#AWS #AWSSTUDENTCOMMUNITYDAY #ParulUniversity #CloudComputing #AI #DevOps #DataEngineering #ASCDPU`;
  
    // Always copy to clipboard (so user can paste if app won't prefill)
    try {
      await navigator.clipboard.writeText(caption);
      // optionally notify user visually in your UI that it's copied
      console.log('Caption copied to clipboard');
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  
    // If Web Share API is available, prefer it — opens native share sheet where LinkedIn appears
    if (navigator.share) {
      try {
        await navigator.share({ text: caption });
        setShowLinkedInPopup(false);
        return;
      } catch (err) {
        // user cancelled or share failed — fall through to other fallbacks
        console.warn('navigator.share failed', err);
      }
    }
  
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
    const encodedCaption = encodeURIComponent(caption);
    const cloudUrl = 'https://cloudclubpu.me'; // LinkedIn share endpoints accept a URL parameter
  
    // Try LinkedIn app deep-link (may or may not be supported on device)
    // summary param often used as post body when using shareArticle scheme
    const linkedinAppUrl = `linkedin://shareArticle?mini=true&url=${encodeURIComponent(cloudUrl)}&summary=${encodedCaption}`;
  
    // Android intent attempt — best-effort. Some Android devices/apps will respond.
    const androidIntent = `intent://share?text=${encodedCaption}#Intent;action=android.intent.action.SEND;type=text/plain;package=com.linkedin.android;end`;
  
    // LinkedIn web share URL (works in browser). It doesn't accept a free text body, only a URL,
    // so we open it and user can paste (clipboard already has caption).
    const linkedinWebShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cloudUrl)}`;
  
    try {
      if (isAndroid) {
        // Try intent first (best chance to open LinkedIn app on Android)
        window.location.href = androidIntent;
  
        // Also try app scheme shortly after as a fallback if intent didn't land in app.
        setTimeout(() => {
          window.location.href = linkedinAppUrl;
        }, 500);
      } else if (isIOS) {
        // Try the linkedin URI scheme on iOS (best-effort)
        // On iOS the app may handle the linkedin:// scheme
        window.location.href = linkedinAppUrl;
  
        // After a short delay, fallback to web share page
        setTimeout(() => {
          window.open(linkedinWebShare, '_blank');
        }, 700);
      } else {
        // Desktop browsers - open LinkedIn web feed. Clipboard already has the caption for manual paste.
        // LinkedIn's web interface does not accept a direct text query param for post body, so we open feed.
        const linkedInWebUrl = `https://www.linkedin.com/feed/?shareActive=true`;
        window.open(linkedInWebUrl, '_blank');
      }
    } catch (e) {
      console.error('Fallback navigation failed, opening web share', e);
      window.open(linkedinWebShare, '_blank');
    } finally {
      setShowLinkedInPopup(false);
    }
  };
  

  return (
    <main
      className={cn("min-h-dvh bg-white text-gray-900 antialiased", poppins.variable)}
      style={{ fontFamily: "var(--font-poppins)" }}
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

        {/* Upload & Adjust */}
        <Card className="bg-white border-gray-200 shadow-lg">
          <CardHeader className="pb-4 md:pb-6">
            <CardTitle className="text-gray-900 text-lg md:text-xl">Upload & Customize</CardTitle>
            <CardDescription className="text-gray-700 text-sm md:text-base">
              Upload your photo and adjust the positioning
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:gap-4 md:gap-5">
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
          <CardFooter className="pt-4 md:pt-6 flex flex-col gap-3">
            <Button
              type="button"
              onClick={downloadImage}
              className="w-full bg-[#FF9900] hover:bg-[#E6890A] text-white h-10 md:h-14 rounded-lg font-medium text-sm md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={!templateImg || !userImg || !userName.trim()}
            >
              <Download className="h-3 w-3 md:h-5 md:w-5 mr-1 md:mr-2" />
              Download Badge
            </Button>
            <Button
              type="button"
              onClick={shareOnLinkedIn}
              className="w-full bg-[#0077B5] hover:bg-[#005885] text-white h-10 md:h-14 rounded-lg font-medium text-sm md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={!templateImg || !userImg || !userName.trim()}
            >
              <Share2 className="h-3 w-3 md:h-5 md:w-5 mr-1 md:mr-2" />
              Share on LinkedIn
            </Button>
          </CardFooter>
        </Card>
        
        <footer className="text-center mt-8 py-4">
          <p className="text-gray-600 text-sm">
            Made with ❤️ by AWS Cloud Club at Parul University
          </p>
        </footer>
      </div>

      {/* LinkedIn Share Popup */}
      {showLinkedInPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 overflow-y-auto">
          <div className="bg-white rounded-lg w-full mx-2 shadow-2xl border border-gray-200 md:max-w-md max-w-xs my-auto">
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h3 className="text-sm md:text-lg font-semibold text-gray-900">Share on LinkedIn</h3>
              <button
                onClick={() => setShowLinkedInPopup(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>
            <div className="p-3 md:p-6">
              <div className="text-center mb-3 md:mb-6">
                <img
                  src={`/images/Share-on-linkedin${/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? '-mobile' : ''}.gif`}
                  alt="How to share on LinkedIn"
                  className="w-3/4 md:w-full mx-auto rounded-lg shadow-md"
                />
              </div>
              <div className="text-center mb-3 md:mb-6">
                <h4 className="text-sm md:text-base font-medium text-gray-900 mb-1 md:mb-2">
                  How to Share on LinkedIn
                </h4>
                <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                  Click OK to open LinkedIn. Upload your downloaded badge image and share it with your network!
                </p>
              </div>
              <div className="flex gap-2 md:gap-3">
                <Button
                  onClick={() => setShowLinkedInPopup(false)}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 text-xs md:text-sm h-8 md:h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={proceedToLinkedIn}
                  className="flex-1 bg-[#0077B5] hover:bg-[#005885] text-white text-xs md:text-sm h-8 md:h-10"
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// utils
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}