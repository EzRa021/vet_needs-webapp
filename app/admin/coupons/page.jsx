"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Search, Ticket, TriangleAlert, X, ChevronRight, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAdminCoupons } from "@/stores/adminStore"
import { statusMetaFor, describeCoupon } from "@/lib/coupons"

export default function AdminCouponsPage() {
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const { data: coupons, isLoading, isError, error } = useAdminCoupons(search)

  const rows = coupons || []
  const forbidden = String(error?.message || "").includes("Forbidden")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Coupons</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} discount code{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Admin only
          </Badge>
          <Button asChild>
            <Link href="/admin/coupons/new">
              <Plus data-icon="inline-start" />
              New coupon
            </Link>
          </Button>
        </div>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{forbidden ? "Admin access required" : "Couldn't load coupons"}</AlertTitle>
          <AlertDescription>
            {forbidden
              ? "Only administrators can manage discount codes."
              : "Refresh the page, or check that migration 003 has been run."}
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <form
              className="relative min-w-[200px] flex-1"
              onSubmit={(e) => {
                e.preventDefault()
                setSearch(searchInput)
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search code or description…"
                className="pl-9"
                aria-label="Search coupons"
              />
            </form>
            {search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchInput("")
                  setSearch("")
                }}
              >
                <X data-icon="inline-start" />
                Clear
              </Button>
            )}
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Ticket />
                  </EmptyMedia>
                  <EmptyTitle>
                    {search ? "No coupons match that search" : "No coupons yet"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {search
                      ? "Try a different code or description."
                      : "Create a discount code to run a promotion."}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  {search ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchInput("")
                        setSearch("")
                      }}
                    >
                      Clear search
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href="/admin/coupons/new">
                        <Plus data-icon="inline-start" />
                        New coupon
                      </Link>
                    </Button>
                  )}
                </EmptyContent>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Used</TableHead>
                      <TableHead className="hidden lg:table-cell">Expires</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((c) => {
                      const meta = statusMetaFor(c)
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Link
                              href={`/admin/coupons/${c.id}`}
                              className="font-mono font-semibold tracking-wider hover:text-primary hover:underline"
                            >
                              {c.code}
                            </Link>
                            {c.description && (
                              <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
                                {c.description}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{describeCoupon(c)}</TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
                            {c.used_count}
                            {c.max_uses ? ` / ${c.max_uses}` : ""}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {c.expires_at
                              ? new Date(c.expires_at).toLocaleDateString("en-NG", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Never"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="size-8" asChild>
                              <Link href={`/admin/coupons/${c.id}`}>
                                <ChevronRight />
                                <span className="sr-only">Open coupon</span>
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
