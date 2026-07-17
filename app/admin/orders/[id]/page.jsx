"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  TriangleAlert,
  Truck,
  MapPin,
  User,
  CreditCard,
  Check,
  Lock,
  Printer,
  StickyNote,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import BrandImage from "@/components/brand-image"
import { useAdminOrder, useUpdateOrder } from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"
import { statusMeta, FULFILMENT_FLOW, isTerminal } from "@/lib/order-status"
import { cn } from "@/lib/utils"

function Timeline({ status }) {
  if (isTerminal(status)) {
    const meta = statusMeta(status)
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{meta.label}</AlertTitle>
        <AlertDescription>{meta.description}</AlertDescription>
      </Alert>
    )
  }
  const currentIndex = FULFILMENT_FLOW.indexOf(status)
  return (
    <ol className="flex items-center">
      {FULFILMENT_FLOW.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        const meta = statusMeta(step)
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "border-2 border-primary bg-primary/10 text-primary",
                  !done && !active && "border-2 border-border bg-background text-muted-foreground"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium sm:text-sm",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {meta.label}
              </span>
            </div>
            {i < FULFILMENT_FLOW.length - 1 && (
              <div
                aria-hidden="true"
                className={cn("mx-2 h-0.5 flex-1 rounded", done ? "bg-primary" : "bg-border")}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium tabular-nums">{children}</span>
    </div>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const { data: order, isLoading, isError } = useAdminOrder(id)
  const update = useUpdateOrder()

  const [tracking, setTracking] = useState("")
  const [notes, setNotes] = useState("")
  const [nextStatus, setNextStatus] = useState("")

  useEffect(() => {
    if (!order) return
    setTracking(order.tracking_number || "")
    setNotes(order.admin_notes || "")
    setNextStatus("")
  }, [order])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <TriangleAlert />
        <AlertTitle>Order not found</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          It may have been deleted.
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/orders">Back to orders</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const meta = statusMeta(order.status)
  const items = Array.isArray(order.order_items) ? order.order_items : []
  const transitions = order.allowedTransitions || []
  const trackingChanged = tracking !== (order.tracking_number || "")
  const notesChanged = notes !== (order.admin_notes || "")

  const save = async (patch, successMsg) => {
    try {
      await update.mutateAsync({ id: order.id, ...patch })
      toast({ title: successMsg })
    } catch (err) {
      toast({ title: "Couldn't update order", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href="/admin/orders">
              <ArrowLeft data-icon="inline-start" />
              Back to orders
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold tabular-nums">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Placed{" "}
            {new Date(order.created_at).toLocaleString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/orders/${order.id}/print`}>
            <Printer data-icon="inline-start" />
            Invoice / packing slip
          </Link>
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <Timeline status={order.status} />
          <p className="mt-4 text-sm text-muted-foreground">{meta.description}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
              <CardDescription>
                {items.reduce((n, i) => n + Number(i.quantity || 0), 0)} item(s) in this order
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {items.map((item, i) => (
                <div key={`${item.id}-${i}`} className="flex items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                    <BrandImage src={item.image} alt={item.name} fill sizes="48px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${item.id}`}
                      className="block truncate text-sm font-medium hover:text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {item.quantity}
                      {item.unit_type === "kg" ? " kg" : " ×"} @ {formatNaira(item.price)}
                      {item.vat_enabled === false && " · VAT exempt"}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatNaira(item.price * item.quantity)}
                  </span>
                </div>
              ))}

              <Separator />

              <div className="flex flex-col">
                {order.subtotal != null && <Row label="Subtotal">{formatNaira(order.subtotal)}</Row>}
                {order.shipping_fee != null && <Row label="Shipping">{formatNaira(order.shipping_fee)}</Row>}
                {order.tax_amount != null && Number(order.tax_amount) > 0 && (
                  <Row label="VAT added">{formatNaira(order.tax_amount)}</Row>
                )}
                {Number(order.discount_amount) > 0 && (
                  <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`}>
                    −{formatNaira(order.discount_amount)}
                  </Row>
                )}
                <Separator />
                <div className="flex items-center justify-between gap-4 pt-2">
                  <span className="font-semibold">Total</span>
                  <span className="font-display text-lg font-bold tabular-nums">
                    {formatNaira(order.total_amount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
              <CardDescription>Only staff can see this — never shown to the customer.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="notes" className="sr-only">
                    Internal notes
                  </FieldLabel>
                  <Textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Customer asked for delivery after 5pm."
                  />
                </Field>
                <Button
                  size="sm"
                  className="w-fit"
                  disabled={!notesChanged || update.isPending}
                  onClick={() => save({ admin_notes: notes }, "Notes saved")}
                >
                  {update.isPending && <Spinner data-icon="inline-start" />}
                  <StickyNote data-icon="inline-start" />
                  Save notes
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        {/* Side */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fulfilment</CardTitle>
              <CardDescription>Move the order forward.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="status">Update status</FieldLabel>
                  {transitions.length === 0 ? (
                    <Alert>
                      <Lock />
                      <AlertDescription>
                        {isTerminal(order.status)
                          ? `This order is ${meta.label.toLowerCase()} — no further changes.`
                          : order.status === "delivered"
                            ? "Delivered — nothing left to move. To return money, use Refunds."
                            : "No status changes available."}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <Select value={nextStatus} onValueChange={setNextStatus}>
                        <SelectTrigger id="status">
                          <SelectValue placeholder="Choose new status…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {transitions.map((s) => (
                              <SelectItem key={s} value={s}>
                                {statusMeta(s).label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {/* "Refunded" used to be in this dropdown and moved no
                          money. Say where it went, or staff will assume it broke. */}
                      <FieldDescription>
                        {order.status === "pending"
                          ? "Payment status is set automatically by Paystack — it can't be set by hand."
                          : "Refunds aren't set here: use Refunds, which returns the money through Paystack."}
                      </FieldDescription>
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!nextStatus || update.isPending}
                        onClick={() =>
                          save({ status: nextStatus }, `Order marked ${statusMeta(nextStatus).label.toLowerCase()}`)
                        }
                      >
                        {update.isPending && <Spinner data-icon="inline-start" />}
                        Update status
                      </Button>
                    </>
                  )}
                </Field>

                <Separator />

                <Field>
                  <FieldLabel htmlFor="tracking">Tracking number</FieldLabel>
                  <Input
                    id="tracking"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="e.g. GIG-123456"
                  />
                  <FieldDescription>Shown to the customer in their orders.</FieldDescription>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!trackingChanged || update.isPending}
                    onClick={() => save({ tracking_number: tracking }, "Tracking saved")}
                  >
                    <Truck data-icon="inline-start" />
                    Save tracking
                  </Button>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{order.customer?.full_name || "Account holder"}</span>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <address className="whitespace-pre-line text-sm not-italic text-muted-foreground">
                  {order.shipping_address || "No address on file"}
                </address>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              <Row label="Method">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5" />
                  Paystack
                </span>
              </Row>
              <Row label="Currency">{order.currency || "NGN"}</Row>
              <Row label="Reference">
                {order.payment_reference ? (
                  <code className="text-xs">{order.payment_reference}</code>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Row>
              <Row label="Paid at">
                {order.paid_at
                  ? new Date(order.paid_at).toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Not paid"}
              </Row>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
