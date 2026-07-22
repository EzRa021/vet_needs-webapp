"use client"

import { useEffect, useState } from "react"
import { Plus, Megaphone, TriangleAlert, Pencil, Trash2, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import BrandImage from "@/components/brand-image"
import ImageUpload from "@/components/admin/image-upload"
import { useAdminPromotions, useSavePromotion, useDeletePromotion } from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"

const PLACEMENTS = [
  { value: "home_hero", label: "Home hero", hint: "The big banner at the top of the home page" },
  { value: "home_banner", label: "Home banner", hint: "A strip further down the home page" },
  { value: "shop_banner", label: "Shop banner", hint: "Above the product grid" },
  { value: "popup", label: "Popup", hint: "Overlay shown on arrival" },
]

const EMPTY = {
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  placement: "home_hero",
  sort_order: 0,
  starts_at: "",
  ends_at: "",
  is_active: true,
}

const toLocalInput = (iso) => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Live/scheduled/ended is derived, never stored — the DB only knows dates.
function liveState(p) {
  const now = Date.now()
  if (!p.is_active) return { label: "Off", variant: "outline" }
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return { label: "Scheduled", variant: "secondary" }
  if (p.ends_at && new Date(p.ends_at).getTime() <= now) return { label: "Ended", variant: "outline" }
  return { label: "Live", variant: "default" }
}

export default function AdminPromotionsPage() {
  const { toast } = useToast()
  const { data: promos, isLoading, isError } = useAdminPromotions()
  const save = useSavePromotion()
  const del = useDeletePromotion()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  // Submit stays disabled until the banner upload settles, so the promotion
  // can't be saved pointing at the previous image.
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      editing
        ? {
            ...EMPTY,
            ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, editing[k] ?? EMPTY[k]])),
            subtitle: editing.subtitle || "",
            image_url: editing.image_url || "",
            link_url: editing.link_url || "",
            starts_at: toLocalInput(editing.starts_at),
            ends_at: toLocalInput(editing.ends_at),
          }
        : EMPTY
    )
  }, [open, editing])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const openNew = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (p) => {
    setEditing(p)
    setOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) return setError("Give the promotion a title.")
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      return setError("The end date must be after the start date.")
    }
    try {
      await save.mutateAsync({
        id: editing?.id,
        ...form,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      })
      toast({
        title: editing ? "Promotion updated" : "Promotion created",
        description: `“${form.title.trim()}” has been saved.`,
      })
      setOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const toggle = async (p) => {
    try {
      await save.mutateAsync({ id: p.id, is_active: !p.is_active })
      toast({ title: p.is_active ? "Promotion switched off" : "Promotion is live" })
    } catch (err) {
      toast({ title: "Couldn't update", description: err.message, variant: "destructive" })
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await del.mutateAsync(pendingDelete.id)
      toast({ title: "Promotion deleted" })
    } catch (err) {
      toast({ title: "Couldn't delete", description: err.message, variant: "destructive" })
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Banners shown to shoppers on the storefront
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus data-icon="inline-start" />
          New promotion
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load promotions</AlertTitle>
          <AlertDescription>Refresh the page, or check migration 003.</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : !promos || promos.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Megaphone />
            </EmptyMedia>
            <EmptyTitle>No promotions yet</EmptyTitle>
            <EmptyDescription>
              Add a banner to highlight a sale or a new range on the storefront.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openNew}>
              <Plus data-icon="inline-start" />
              New promotion
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {promos.map((p) => {
            const state = liveState(p)
            const placement = PLACEMENTS.find((x) => x.value === p.placement)
            return (
              <Card key={p.id} className="gap-0 overflow-hidden py-0">
                <div className="relative aspect-[21/9] bg-surface-2">
                  <BrandImage
                    src={p.image_url}
                    alt={p.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    placeholderLabel="No image"
                    icon={Megaphone}
                  />
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <Badge variant={state.variant}>{state.label}</Badge>
                    <Badge variant="secondary">{placement?.label || p.placement}</Badge>
                  </div>
                </div>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div>
                    <h3 className="font-semibold">{p.title}</h3>
                    {p.subtitle && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{p.subtitle}</p>
                    )}
                    {p.link_url && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <ExternalLink className="size-3" />
                        {p.link_url}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={() => toggle(p)}
                        aria-label={`Toggle ${p.title}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {p.is_active ? "Showing" : "Hidden"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(p)}
                      >
                        <Trash2 />
                        <span className="sr-only">Delete {p.title}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Editor — short record, so a dialog is right here */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit promotion" : "New promotion"}</DialogTitle>
            <DialogDescription>
              Banners appear on the storefront while they&apos;re live and in date.
            </DialogDescription>
          </DialogHeader>

          <form id="promo-form" onSubmit={submit}>
            <FieldGroup>
              {error && (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Field data-invalid={error && !form.title.trim() ? true : undefined}>
                <FieldLabel htmlFor="pr-title">Title</FieldLabel>
                <Input
                  id="pr-title"
                  value={form.title}
                  onChange={setInput("title")}
                  placeholder="Harvest season sale"
                  aria-invalid={error && !form.title.trim() ? true : undefined}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="pr-sub">Subtitle</FieldLabel>
                <Input
                  id="pr-sub"
                  value={form.subtitle}
                  onChange={setInput("subtitle")}
                  placeholder="Up to 15% off poultry feed"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="pr-place">Placement</FieldLabel>
                <Select value={form.placement} onValueChange={set("placement")}>
                  <SelectTrigger id="pr-place">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PLACEMENTS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {PLACEMENTS.find((p) => p.value === form.placement)?.hint}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="pr-img">Banner image</FieldLabel>
                <ImageUpload
                  value={form.image_url}
                  onChange={(v) => setForm((f) => ({ ...f, image_url: v }))}
                  onUploadingChange={setUploading}
                  folder="promotions"
                  label={form.title || "Banner"}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="pr-link">Links to</FieldLabel>
                <Input
                  id="pr-link"
                  value={form.link_url}
                  onChange={setInput("link_url")}
                  placeholder="/shop?search=feed"
                />
                <FieldDescription>Where clicking the banner takes shoppers.</FieldDescription>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="pr-start">Starts</FieldLabel>
                  <Input
                    id="pr-start"
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={setInput("starts_at")}
                  />
                  <FieldDescription>Blank = now.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pr-end">Ends</FieldLabel>
                  <Input
                    id="pr-end"
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={setInput("ends_at")}
                  />
                  <FieldDescription>Blank = never.</FieldDescription>
                </Field>
              </div>

              <Field orientation="horizontal">
                <FieldLabel htmlFor="pr-order">Sort order</FieldLabel>
                <Input
                  id="pr-order"
                  type="number"
                  className="w-24"
                  value={form.sort_order}
                  onChange={setInput("sort_order")}
                />
              </Field>

              <Field orientation="horizontal">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="pr-active">Active</FieldLabel>
                  <FieldDescription>Turn off to hide immediately.</FieldDescription>
                </div>
                <Switch id="pr-active" checked={form.is_active} onCheckedChange={set("is_active")} />
              </Field>
            </FieldGroup>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="promo-form"
              disabled={save.isPending || uploading}
            >
              {(save.isPending || uploading) && (
                <Spinner data-icon="inline-start" />
              )}
              {uploading
                ? "Uploading image…"
                : editing
                  ? "Save changes"
                  : "Create promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. To hide it temporarily, switch it off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
