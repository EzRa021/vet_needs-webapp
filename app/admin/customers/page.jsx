"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Users, TriangleAlert, X, ChevronRight, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAdminCustomers } from "@/stores/adminStore"
import { formatNaira } from "@/lib/pricing"
import { ROLE_META, roleMeta, initialsFor } from "@/lib/roles"

export default function AdminCustomersPage() {
  const [filters, setFilters] = useState({ search: "", role: "all", page: 1, limit: 20 })
  const [searchInput, setSearchInput] = useState("")
  const { data, isLoading, isError, error } = useAdminCustomers(filters)

  const rows = data?.data || []
  const pagination = data?.pagination || { total: 0, page: 1, pages: 0 }
  const hasFilters = filters.search || filters.role !== "all"

  const reset = () => {
    setSearchInput("")
    setFilters({ search: "", role: "all", page: 1, limit: 20 })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total} account{pagination.total === 1 ? "" : "s"}
            {hasFilters ? " matching your filters" : " registered"}
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <ShieldCheck className="size-3.5" />
          Admin only
        </Badge>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load customers</AlertTitle>
          <AlertDescription>
            {String(error?.message || "").includes("Forbidden")
              ? "This page is restricted to administrators."
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
                setFilters((f) => ({ ...f, search: searchInput, page: 1 }))
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name or phone…"
                className="pl-9"
                aria-label="Search customers"
              />
            </form>

            <Select
              value={filters.role}
              onValueChange={(v) => setFilters((f) => ({ ...f, role: v, page: 1 }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X data-icon="inline-start" />
                Clear
              </Button>
            )}
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>
                    {hasFilters ? "No accounts match those filters" : "No customers yet"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasFilters
                      ? "Try a different search or clear the filters."
                      : "Accounts appear here as people register."}
                  </EmptyDescription>
                </EmptyHeader>
                {hasFilters && (
                  <EmptyContent>
                    <Button variant="outline" onClick={reset}>
                      Clear filters
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden sm:table-cell">Orders</TableHead>
                      <TableHead className="text-right">Lifetime spend</TableHead>
                      <TableHead className="hidden lg:table-cell">Joined</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((c) => {
                      const meta = roleMeta(c.role)
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-9">
                                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                  {initialsFor(c.full_name, c.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <Link
                                  href={`/admin/customers/${c.id}`}
                                  className="block truncate font-medium hover:text-primary hover:underline"
                                >
                                  {c.full_name || "Unnamed"}
                                </Link>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {c.email || c.phone || "—"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
                            {c.orderCount}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNaira(c.lifetimeSpend)}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {new Date(c.created_at).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="size-8" asChild>
                              <Link href={`/admin/customers/${c.id}`}>
                                <ChevronRight />
                                <span className="sr-only">Open customer</span>
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

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t p-3">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
