"use client"

import { useRef, useState } from "react"
import { Upload, X, Loader2, ImageIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import BrandImage from "@/components/brand-image"
import { cn } from "@/lib/utils"

export async function uploadImage(file, folder = "products") {
  const body = new FormData()
  body.append("file", file)
  body.append("folder", folder)

  const res = await fetch("/api/admin/uploads", { method: "POST", body })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Upload failed")
  return json.data // { url, path }
}

// Single-image field with drag-and-drop.
//
// Keeps the URL input alongside the dropzone rather than replacing it: existing
// products already have external image_urls, and pasting a URL has to keep
// working — otherwise this "upgrade" would break every product that predates
// the bucket.
export default function ImageUpload({
  value,
  onChange,
  folder = "products",
  label = "Image",
  className,
}) {
  const { toast } = useToast()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadImage(file, folder)
      onChange(url)
      toast({ title: "Image uploaded" })
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      // Let the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="group relative aspect-square w-40 overflow-hidden rounded-xl border bg-muted">
          <BrandImage src={value} alt={label} fill sizes="160px" className="object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            aria-label="Remove image"
            className="absolute right-1.5 top-1.5 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => onChange("")}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex aspect-square w-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "hover:border-primary/40"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Uploading…</span>
            </>
          ) : (
            <>
              <ImageIcon className="size-6 text-muted-foreground/50" />
              <span className="px-2 text-xs text-muted-foreground">
                Drop an image or click to browse
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="flex gap-2">
        <Input
          value={value || ""}
          placeholder="…or paste an image URL"
          onChange={(e) => onChange(e.target.value)}
          className="text-xs"
        />
        {!value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label="Upload image"
          >
            <Upload className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
