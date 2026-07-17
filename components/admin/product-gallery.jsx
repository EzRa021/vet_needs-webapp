"use client"

import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, X, Loader2, ArrowLeft, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import BrandImage from "@/components/brand-image"
import { uploadImage } from "@/components/admin/image-upload"
import { createClient } from "@/lib/supabase/client"

// Manager for `item_images` — the extra gallery photos.
//
// The table and the storefront gallery have existed since 000; there was simply
// no way for an admin to put a row in it. Reads/writes go through the client
// with the staff RLS policy from 003 ("staff manage item images"), which is a
// genuine row-level rule (this row belongs to this item), unlike the order
// rules that RLS couldn't express.
const useGallery = (itemId) =>
  useQuery({
    queryKey: ["admin", "item-images", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("item_images")
        .select("id, url, alt_text, sort_order")
        .eq("item_id", itemId)
        .order("sort_order", { ascending: true })
      if (error) throw error
      return data || []
    },
  })

export default function ProductGallery({ itemId }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const { data: images, isLoading } = useGallery(itemId)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "item-images", itemId] })
    // The storefront product page reads these too.
    qc.invalidateQueries({ queryKey: ["items", itemId] })
  }

  const add = useMutation({
    mutationFn: async (files) => {
      const supabase = createClient()
      const start = images?.length || 0
      const rows = []
      // Sequential, not Promise.all: a dropped batch of 10 shouldn't open 10
      // simultaneous uploads on a Nigerian mobile connection.
      for (const [i, file] of Array.from(files).entries()) {
        const { url } = await uploadImage(file, "products")
        rows.push({ item_id: itemId, url, sort_order: start + i })
      }
      const { error } = await supabase.from("item_images").insert(rows)
      if (error) throw error
      return rows.length
    },
    onSuccess: (n) => {
      invalidate()
      toast({ title: `${n} ${n === 1 ? "image" : "images"} added` })
    },
    onError: (err) =>
      toast({ title: "Couldn't add images", description: err.message, variant: "destructive" }),
  })

  const remove = useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      const { error } = await supabase.from("item_images").delete().eq("id", id)
      if (error) throw error
      // The file itself is left in Storage on purpose: the same upload may be
      // referenced by another product or by image_url, and an orphaned object
      // costs pennies where a broken image costs a sale. A media-library
      // cleanup is the right place to reap them (P3).
    },
    onSuccess: () => {
      invalidate()
      toast({ title: "Image removed" })
    },
    onError: () => toast({ title: "Couldn't remove image", variant: "destructive" }),
  })

  // Swap sort_order with the neighbour. Two updates rather than a drag library:
  // galleries are 2–6 photos, and arrows work on touch without a dependency.
  const move = useMutation({
    mutationFn: async ({ index, direction }) => {
      const list = images || []
      const target = index + direction
      if (target < 0 || target >= list.length) return
      const supabase = createClient()
      const a = list[index]
      const b = list[target]
      const { error: e1 } = await supabase
        .from("item_images")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from("item_images")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id)
      if (e2) throw e2
    },
    onSuccess: invalidate,
    onError: () => toast({ title: "Couldn't reorder", variant: "destructive" }),
  })

  const handleFiles = async (files) => {
    if (!files?.length) return
    setUploading(true)
    try {
      await add.mutateAsync(files)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gallery</CardTitle>
        <CardDescription>
          Extra photos for the product page, after the main image.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="size-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {(images || []).map((img, i) => (
              <div key={img.id} className="group relative">
                <div className="relative size-24 overflow-hidden rounded-lg border bg-muted">
                  <BrandImage
                    src={img.url}
                    alt={img.alt_text || "Product photo"}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  aria-label="Remove image"
                  className="absolute -right-1.5 -top-1.5 size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => remove.mutate(img.id)}
                >
                  <X className="size-3" />
                </Button>
                <div className="mt-1 flex justify-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Move left"
                    disabled={i === 0 || move.isPending}
                    onClick={() => move.mutate({ index: i, direction: -1 })}
                  >
                    <ArrowLeft className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Move right"
                    disabled={i === (images?.length || 0) - 1 || move.isPending}
                    onClick={() => move.mutate({ index: i, direction: 1 })}
                  >
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="size-5" />
                  <span className="text-[10px]">Add</span>
                </>
              )}
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </CardContent>
    </Card>
  )
}
