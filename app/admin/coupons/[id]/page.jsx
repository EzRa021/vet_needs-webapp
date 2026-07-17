"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MoreHorizontal,
  TriangleAlert,
  Ticket,
  Users,
  Banknote,
  Copy,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAdminCoupon, useDeleteCoupon, useSaveCoupon } from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"
import { statusMetaFor, describeCoupon } from "@/lib/coupons"

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="px-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            {label}
          </CardDescription>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5 px-4">
        <span className="font-display text-xl font-bold tabular-nums leading-none">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  )
}

export default function CouponDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: coupon, isLoading, isError, error } = useAdminCoupon(id)
  const del = useDeleteCoupon()
  const save = useSaveCoupon()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !coupon) {
    const forbidden = String(error?.message || "").includes("Forbidden")
    return (
      <Alert variant="destructive" className="max-w-lg">
        <TriangleAlert />
        <AlertTitle>{forbidden ? "Admin access required" : "Coupon not found"}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          {forbidden ? "Only administrators can manage discount codes." : "It may have been deleted."}
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/coupons">Back to coupons</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const meta = statusMetaFor(coupon)
  const usagePct = coupon.max_uses
    ? Math.min(100, Math.round((Number(coupon.used_count) / Number(coupon.max_uses)) * 100))
    : null

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({ title: "Couldn't copy", description: "Copy the code manually.", variant: "destructive" })
    }
  }

  const toggleActive = async () => {
    try {
      await save.mutateAsync({ id: coupon.id, is_active: !coupon.is_active })
      toast({
        title: coupon.is_active ? "Coupon disabled" : "Coupon enabled",
        description: `“${coupon.code}” is now ${coupon.is_active ? "off" : "live"}.`,
      })
    } catch (err) {
      toast({ title: "Couldn't update", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    try {
      await del.mutateAsync(coupon.id)
      toast({ title: "Coupon deleted", description: `“${coupon.code}” has been removed.` })
      router.push("/admin/coupons")
    } catch (err) {
      toast({ title: "Can't delete this coupon", description: err.message, variant: "destructive" })
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href="/admin/coupons">
              <ArrowLeft data-icon="inline-start" />
              Back to coupons
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display font-mono text-xl font-bold tracking-wider">
              {coupon.code}
            </h1>
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <Button variant="ghost" size="icon" className="size-7" onClick={copyCode}>
              {copied ? <Check className="text-success" /> : <Copy />}
              <span className="sr-only">Copy code</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{describeCoupon(coupon)}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={`/admin/coupons/${coupon.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={toggleActive}>
                  <Ticket />
                  {coupon.is_active ? "Disable" : "Enable"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Alert variant={meta.variant === "destructive" ? "destructive" : "default"}>
        <Ticket />
        <AlertTitle>{meta.label}</AlertTitle>
        <AlertDescription>{meta.description}</AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={Users}
          label="Times used"
          value={coupon.used_count}
          sub={coupon.max_uses ? `of ${coupon.max_uses} allowed` : "Unlimited uses"}
        />
        <Stat
          icon={Banknote}
          label="Total given away"
          value={formatNaira(coupon.totalGiven)}
          sub="Across all redemptions"
        />
        <Stat
          icon={Ticket}
          label="Per customer"
          value={coupon.max_uses_per_user}
          sub="Max uses each"
        />
      </div>

      {usagePct !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage</CardTitle>
            <CardDescription>
              {coupon.used_count} of {coupon.max_uses} used
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={usagePct} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Redemptions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Redemptions</CardTitle>
            <CardDescription>Most recent first (up to 50).</CardDescription>
          </CardHeader>
          <CardContent className={coupon.redemptions.length ? "p-0" : undefined}>
            {coupon.redemptions.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Ticket />
                  </EmptyMedia>
                  <EmptyTitle>Not used yet</EmptyTitle>
                  <EmptyDescription>
                    Redemptions appear here once customers use this code.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupon.redemptions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link
                            href={`/admin/orders/${r.order_id}`}
                            className="font-medium tabular-nums hover:text-primary hover:underline"
                          >
                            #{String(r.order_id).slice(0, 8).toUpperCase()}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.customerName || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          −{formatNaira(r.discount_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            <Row label="Type">
              {coupon.discount_type === "percent" ? "Percentage" : "Fixed amount"}
            </Row>
            <Row label="Value">
              <span className="tabular-nums">
                {coupon.discount_type === "percent"
                  ? `${Number(coupon.discount_value)}%`
                  : formatNaira(coupon.discount_value)}
              </span>
            </Row>
            <Row label="Minimum order">
              {Number(coupon.min_order_amount) > 0 ? (
                <span className="tabular-nums">{formatNaira(coupon.min_order_amount)}</span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Row>
            <Row label="Max discount">
              {coupon.max_discount_amount ? (
                <span className="tabular-nums">{formatNaira(coupon.max_discount_amount)}</span>
              ) : (
                <span className="text-muted-foreground">No cap</span>
              )}
            </Row>
            <Row label="Starts">
              {new Date(coupon.starts_at).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Row>
            <Row label="Expires">
              {coupon.expires_at ? (
                new Date(coupon.expires_at).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              ) : (
                <span className="text-muted-foreground">Never</span>
              )}
            </Row>
            {coupon.description && <Row label="Note">{coupon.description}</Row>}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{coupon.code}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Codes that have already been redeemed are
              protected — disable them instead so the discount history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
