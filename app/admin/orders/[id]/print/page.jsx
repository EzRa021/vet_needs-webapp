"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAdminOrder } from "@/stores/adminStore"
import { formatNaira } from "@/lib/pricing"
import { formatQuantity } from "@/lib/units"
import { statusMeta } from "@/lib/order-status"
import { LEGAL } from "@/lib/legal"
import { cn } from "@/lib/utils"

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

// Two documents, deliberately not one:
//
//   INVOICE      — the money. Prices, VAT, discount, total, payment reference.
//   PACKING SLIP — the goods. Names and quantities ONLY, no prices.
//
// The packing slip omits money on purpose: it goes in the box or to whoever
// picks the order, and neither the picker nor the recipient's household needs
// the commercial terms. It's also what makes it usable as a gift/dispatch note.
const DOCS = [
  { value: "invoice", label: "Invoice" },
  { value: "packing", label: "Packing slip" },
]

function DocHeader({ order, title, subtitle }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-6 border-b pb-6">
      <div>
        <p className="font-display text-2xl font-bold">{LEGAL.brand}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {LEGAL.legalName}
          {LEGAL.rcNumber ? ` · RC ${LEGAL.rcNumber}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">{LEGAL.address}</p>
        <p className="text-xs text-muted-foreground">
          {LEGAL.supportEmail} · {LEGAL.supportPhone}
        </p>
      </div>
      <div className="text-right">
        <h1 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h1>
        <p className="mt-1 text-sm font-medium">
          #{order.id.slice(0, 8).toUpperCase()}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  )
}

function AddressBlock({ order }) {
  return (
    <section className="mb-6 grid grid-cols-2 gap-6 text-sm">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Deliver to
        </p>
        <p className="whitespace-pre-line">{order.shipping_address || "—"}</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Order details
        </p>
        <p>Status: {statusMeta(order.status).label}</p>
        {order.paid_at && <p>Paid: {formatDate(order.paid_at)}</p>}
        {order.tracking_number && <p>Tracking: {order.tracking_number}</p>}
      </div>
    </section>
  )
}

function Invoice({ order, items }) {
  return (
    <>
      <DocHeader
        order={order}
        title="Invoice"
        subtitle={order.paid_at ? "Paid" : "Awaiting payment"}
      />
      <AddressBlock order={order} />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-semibold">Item</th>
            <th className="pb-2 text-right font-semibold">Qty</th>
            <th className="pb-2 text-right font-semibold">Unit price</th>
            <th className="pb-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-dashed">
              <td className="py-2">
                {item.name}
                {/* VAT treatment varies per item, so a single footer rate would
                    be a lie — mark inclusive lines individually. */}
                {item.vat_enabled && item.vat_inclusive && (
                  <span className="ml-1 text-xs text-muted-foreground">(VAT incl.)</span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatQuantity(item.quantity, item.unit_type)}
              </td>
              <td className="py-2 text-right tabular-nums">{formatNaira(item.price)}</td>
              <td className="py-2 text-right tabular-nums">
                {formatNaira(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <dl className="w-64 space-y-1 text-sm">
          {order.subtotal != null && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatNaira(order.subtotal)}</dd>
            </div>
          )}
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}
              </dt>
              <dd className="tabular-nums">−{formatNaira(order.discount_amount)}</dd>
            </div>
          )}
          {order.shipping_fee != null && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular-nums">
                {Number(order.shipping_fee) === 0 ? "Free" : formatNaira(order.shipping_fee)}
              </dd>
            </div>
          )}
          {Number(order.tax_amount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">VAT</dt>
              <dd className="tabular-nums">{formatNaira(order.tax_amount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatNaira(order.total_amount)}</dd>
          </div>
        </dl>
      </section>

      {order.payment_reference && (
        <p className="mt-6 text-xs text-muted-foreground">
          Payment reference: {order.payment_reference}
        </p>
      )}
      <p className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
        Thank you for your business. Questions? {LEGAL.supportEmail}
      </p>
    </>
  )
}

function PackingSlip({ order, items }) {
  const totalUnits = items.reduce((n, i) => n + Number(i.quantity || 0), 0)

  return (
    <>
      <DocHeader order={order} title="Packing slip" />
      <AddressBlock order={order} />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {/* A tick column: this sheet is a checklist for whoever picks the
                order, not a document to read. */}
            <th className="w-10 pb-2 font-semibold">✓</th>
            <th className="pb-2 font-semibold">Item</th>
            <th className="pb-2 text-right font-semibold">Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-dashed">
              <td className="py-2.5">
                <span className="inline-block size-4 rounded border border-foreground/40" />
              </td>
              <td className="py-2.5">{item.name}</td>
              <td className="py-2.5 text-right font-medium tabular-nums">
                {formatQuantity(item.quantity, item.unit_type)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-right text-sm">
        <span className="text-muted-foreground">Lines:</span>{" "}
        <span className="font-semibold tabular-nums">{items.length}</span>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="text-muted-foreground">Units:</span>{" "}
        <span className="font-semibold tabular-nums">{totalUnits}</span>
      </p>

      {order.notes && (
        <section className="mt-6 rounded border border-dashed p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
            Customer notes
          </p>
          <p className="whitespace-pre-line text-sm">{order.notes}</p>
        </section>
      )}

      {/* No prices anywhere on this document — see the DOCS comment. */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-xs">
        <div>
          <div className="mb-1 h-8 border-b border-foreground/30" />
          <p className="text-muted-foreground">Packed by</p>
        </div>
        <div>
          <div className="mb-1 h-8 border-b border-foreground/30" />
          <p className="text-muted-foreground">Received by / date</p>
        </div>
      </div>
    </>
  )
}

export default function OrderPrintPage() {
  const { id } = useParams()
  const { data: order, isLoading, isError } = useAdminOrder(id)
  const [doc, setDoc] = useState("invoice")

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Order not found</AlertTitle>
          <AlertDescription>This order could not be loaded.</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/admin/orders">Back to orders</Link>
        </Button>
      </div>
    )
  }

  const items = Array.isArray(order.order_items) ? order.order_items : []

  return (
    <div className="space-y-4">
      {/* Screen-only controls. Printing one document at a time is the point —
          printing both every time wastes half the paper. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/admin/orders/${order.id}`}>
            <ArrowLeft className="size-4" />
            Back to order
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5" role="tablist">
            {DOCS.map((d) => (
              <button
                key={d.value}
                type="button"
                role="tab"
                aria-selected={doc === d.value}
                onClick={() => setDoc(d.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  doc === d.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
        </div>
      </div>

      {/* The sheet. max-w mimics A4 on screen so what you see is what prints. */}
      <div className="mx-auto max-w-[210mm] rounded-xl border bg-card p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
        {doc === "invoice" ? (
          <Invoice order={order} items={items} />
        ) : (
          <PackingSlip order={order} items={items} />
        )}
      </div>
    </div>
  )
}
