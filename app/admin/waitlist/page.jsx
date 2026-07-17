"use client"

import { useState } from "react"
import Link from "next/link"
import { BellRing, Send, TriangleAlert, Mail, MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useStockNotifications, useSendStockNotifications } from "@/stores/adminStore"

const STATUS_META = {
  pending: { label: "Waiting", variant: "outline" },
  ready: { label: "Ready to send", variant: "default" },
  sent: { label: "Sent", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
}

const formatWhen = (v) =>
  v ? new Date(v).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"

export default function AdminWaitlistPage() {
  const { toast } = useToast()
  const [status, setStatus] = useState("ready")
  const { data, isLoading, isError } = useStockNotifications(status)
  const send = useSendStockNotifications()

  const rows = data?.data || []

  const drain = () =>
    send.mutate(undefined, {
      onSuccess: (d) =>
        toast({
          title: `${d.sent} sent`,
          description:
            d.skipped || d.failed
              ? `${d.skipped} skipped, ${d.failed} failed.`
              : "Everyone waiting has been emailed.",
        }),
      onError: (err) =>
        toast({ title: "Couldn't send", description: err.message, variant: "destructive" }),
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Back-in-stock waitlist</h1>
          <p className="text-sm text-muted-foreground">
            People who asked to be told when a product returns. Restocking marks them
            ready automatically; sending is one click (or a cron).
          </p>
        </div>
        <Button onClick={drain} disabled={send.isPending}>
          {send.isPending ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
          Send ready now
        </Button>
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ready">Ready to send</SelectItem>
          <SelectItem value="pending">Waiting on restock</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      {isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load the waitlist</AlertTitle>
          <AlertDescription>Run migration 022, then refresh.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <BellRing className="mx-auto mb-3 size-9 text-muted-foreground/40" />
          <h2 className="font-semibold">Nobody waiting</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Requests show up here when a product is out of stock and someone asks to
            be told it&apos;s back.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Product</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Asked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const meta = STATUS_META[r.status] || { label: r.status, variant: "secondary" }
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.item ? (
                            <Link href={`/admin/products/${r.item.id}`} className="hover:text-primary">
                              {r.item.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Deleted product</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            {r.notify_by === "whatsapp" ? (
                              <MessageCircle className="size-3.5 text-muted-foreground" />
                            ) : (
                              <Mail className="size-3.5 text-muted-foreground" />
                            )}
                            {r.email || r.phone}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatWhen(r.created_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
