"use client"

import { useState } from "react"
import { Mail, TriangleAlert, Reply, Check, Archive, Phone, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useContactMessages, useUpdateMessage } from "@/stores/adminStore"
import { cn } from "@/lib/utils"

const STATUS_META = {
  new: { label: "New", variant: "default" },
  read: { label: "Read", variant: "secondary" },
  replied: { label: "Replied", variant: "outline" },
  closed: { label: "Closed", variant: "outline" },
}

// Must match SUBJECTS in app/api/contact/route.js — these are the values the
// form actually sends. (I had `delivery`/`wholesale` here, which the form never
// sends, while `bulk`/`return` would have rendered as raw slugs.)
const SUBJECT_LABEL = {
  general: "General",
  order: "Order",
  bulk: "Bulk / wholesale",
  return: "Return",
  product: "Product",
  other: "Other",
}

const formatWhen = (v) =>
  new Date(v).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

function MessageCard({ m }) {
  const { toast } = useToast()
  const update = useUpdateMessage()
  const [notes, setNotes] = useState(m.admin_notes || "")
  const [open, setOpen] = useState(false)

  const meta = STATUS_META[m.status] || { label: m.status, variant: "secondary" }
  const name = [m.first_name, m.last_name].filter(Boolean).join(" ")

  const setStatus = (status) =>
    update.mutate(
      { id: m.id, status },
      {
        onSuccess: () => toast({ title: `Marked ${STATUS_META[status]?.label.toLowerCase()}` }),
        onError: () => toast({ title: "Couldn't update", variant: "destructive" }),
      }
    )

  // Opening a NEW message marks it read — that's what "read" means, and making
  // staff click a second button to say so is how a queue stops reflecting reality.
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && m.status === "new") {
      update.mutate({ id: m.id, status: "read" })
    }
  }

  // mailto rather than an in-app composer: replies come from the shop's real
  // inbox, so the thread lives where staff already work and the customer can
  // just hit reply.
  const mailto = `mailto:${m.email}?subject=${encodeURIComponent(
    `Re: your message to VetNeeds (${SUBJECT_LABEL[m.subject] || m.subject})`
  )}`

  return (
    <Card className={cn(m.status === "new" && "border-primary/40")}>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{name || "Someone"}</span>
              <Badge variant={meta.variant}>{meta.label}</Badge>
              <Badge variant="outline" className="font-normal">
                {SUBJECT_LABEL[m.subject] || m.subject}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {m.email}
              {m.phone && ` · ${m.phone}`} · {formatWhen(m.created_at)}
            </p>
            {!open && (
              <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">
                {m.message}
              </p>
            )}
          </div>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">
              {m.message}
            </p>

            <div className="space-y-1.5">
              <label htmlFor={`n-${m.id}`} className="text-xs font-medium">
                Internal notes
              </label>
              <Textarea
                id={`n-${m.id}`}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Not shown to the customer."
              />
              {notes !== (m.admin_notes || "") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update.mutate(
                      { id: m.id, admin_notes: notes.trim() || null },
                      { onSuccess: () => toast({ title: "Note saved" }) }
                    )
                  }
                >
                  Save note
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <a href={mailto}>
                  <Reply className="size-3.5" />
                  Reply by email
                </a>
              </Button>
              {m.status !== "replied" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("replied")}>
                  <Check className="size-3.5" />
                  Mark replied
                </Button>
              )}
              {m.status !== "closed" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus("closed")}>
                  <Archive className="size-3.5" />
                  Close
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminMessagesPage() {
  const [status, setStatus] = useState("new")
  const { data, isLoading, isError } = useContactMessages(status)
  const messages = data?.data || []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            From the contact form. Opening one marks it read.
          </p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load messages</AlertTitle>
          <AlertDescription>
            Make sure migration 005 has been run, then refresh.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Mail className="mx-auto mb-3 size-9 text-muted-foreground/40" />
          <h2 className="font-semibold">
            {status === "new" ? "Nothing new" : "No messages here"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "new"
              ? "Everything from the contact form has been looked at."
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}
