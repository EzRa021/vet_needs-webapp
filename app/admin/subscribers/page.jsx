"use client"

import { useState } from "react"
import { Download, Mail, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { downloadCsv } from "@/lib/csv"
import { useSubscribers } from "@/stores/adminStore"

const formatDate = (v) =>
  new Date(v).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })

export default function AdminSubscribersPage() {
  const [activeOnly, setActiveOnly] = useState(true)
  const { data, isLoading, isError } = useSubscribers(activeOnly)

  const subscribers = data?.data || []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Subscribers</h1>
          <p className="text-sm text-muted-foreground">
            Newsletter sign-ups. {data?.total ?? 0}{" "}
            {activeOnly ? "subscribed" : "total"}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="active" checked={activeOnly} onCheckedChange={setActiveOnly} />
            <Label htmlFor="active" className="text-sm font-normal">
              Subscribed only
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={subscribers.length === 0}
            onClick={() =>
              downloadCsv(
                `vetneeds-subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
                subscribers,
                [
                  { key: "email", label: "Email" },
                  { key: "source", label: "Source" },
                  {
                    key: "is_active",
                    label: "Status",
                    format: (v) => (v ? "Subscribed" : "Unsubscribed"),
                  },
                  { key: "created_at", label: "Joined", format: (v) => formatDate(v) },
                  {
                    key: "unsubscribed_at",
                    label: "Unsubscribed",
                    format: (v) => (v ? formatDate(v) : ""),
                  },
                  // unsubscribe_token deliberately not exported — it's a
                  // capability, and a CSV is the easiest thing in the world to
                  // forward to someone.
                ]
              )
            }
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load subscribers</AlertTitle>
          <AlertDescription>
            Make sure migration 005 has been run, then refresh.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : subscribers.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Mail className="mx-auto mb-3 size-9 text-muted-foreground/40" />
          <h2 className="font-semibold">No subscribers yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign-ups from the footer will appear here.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Email</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.email}</TableCell>
                      <TableCell className="text-muted-foreground">{s.source}</TableCell>
                      <TableCell>
                        {s.is_active ? (
                          <Badge variant="secondary">Subscribed</Badge>
                        ) : (
                          <Badge variant="outline">
                            Left {s.unsubscribed_at ? formatDate(s.unsubscribed_at) : ""}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(s.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
