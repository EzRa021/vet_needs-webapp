"use client"

import Link from "next/link"
import {
  Boxes,
  Wallet,
  TrendingUp,
  PackageX,
  PackageMinus,
  Download,
  TriangleAlert,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNaira } from "@/lib/pricing"
import { formatQuantity } from "@/lib/units"
import { downloadCsv } from "@/lib/csv"
import { useInventory } from "@/stores/adminStore"

const STATUS = {
  out: { label: "Out of stock", variant: "destructive" },
  low: { label: "Low", variant: "outline" },
  ok: { label: "OK", variant: "secondary" },
  untracked: { label: "Not tracked", variant: "secondary" },
}

function Stat({ icon: Icon, label, value, hint, tone }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className={`size-4 ${tone === "danger" ? "text-destructive" : ""}`} />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminInventoryPage() {
  const { data, isLoading, isError } = useInventory()
  const rows = data?.rows || []
  const t = data?.totals

  // Reorder list: everything out or low, worst first. This is the sheet you
  // take to the supplier.
  const reorder = rows
    .filter((r) => r.status === "out" || r.status === "low")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "out" ? -1 : 1
      return (a.stock ?? 0) - (b.stock ?? 0)
    })

  // Concern first in the main table too.
  const sorted = [...rows].sort((a, b) => {
    const rank = { out: 0, low: 1, ok: 2, untracked: 3 }
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
    return b.stock_cost - a.stock_cost
  })

  const exportReorder = () =>
    downloadCsv(
      `vetneeds-reorder-${new Date().toISOString().slice(0, 10)}.csv`,
      reorder,
      [
        { key: "sku", label: "SKU" },
        { key: "name", label: "Product" },
        { key: "category", label: "Category" },
        { key: "stock", label: "In stock", format: (v, r) => formatQuantity(v ?? 0, r.unit_type) },
        { key: "threshold", label: "Reorder at" },
        { key: "status", label: "Status", format: (v) => STATUS[v]?.label || v },
      ]
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            What your stock is worth, and what needs reordering. Cost figures are
            staff-only.
          </p>
        </div>
        <Button variant="outline" disabled={reorder.length === 0} onClick={exportReorder}>
          <Download data-icon="inline-start" />
          Reorder list ({reorder.length})
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load inventory</AlertTitle>
          <AlertDescription>Refresh, or check migration 023 has run.</AlertDescription>
        </Alert>
      )}

      {isLoading || !t ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={Wallet}
              label="Stock value (cost)"
              value={formatNaira(t.cost_value)}
              hint={`Retail ${formatNaira(t.retail_value)}`}
            />
            <Stat
              icon={TrendingUp}
              label="Potential margin"
              value={formatNaira(t.potential_margin)}
              hint="If all stock sold at list price"
            />
            <Stat
              icon={PackageX}
              label="Out of stock"
              value={t.out_of_stock}
              tone={t.out_of_stock > 0 ? "danger" : undefined}
            />
            <Stat icon={PackageMinus} label="Low stock" value={t.low_stock} />
          </div>

          {/* The valuation is only as honest as the cost data. Say when it isn't
              — an unqualified "stock value" that quietly excludes half the
              catalogue is the VAT-report mistake all over again. */}
          {t.missing_cost > 0 && (
            <Alert>
              <TriangleAlert className="size-4" />
              <AlertTitle>Stock value is understated</AlertTitle>
              <AlertDescription>
                {t.missing_cost} in-stock{" "}
                {t.missing_cost === 1 ? "product has" : "products have"} no cost price
                set, so {t.missing_cost === 1 ? "it counts" : "they count"} as ₦0 toward
                the cost value above. Add cost prices on those products for an accurate
                figure.
              </AlertDescription>
            </Alert>
          )}

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">In stock</TableHead>
                      <TableHead className="text-right">Unit cost</TableHead>
                      <TableHead className="text-right">Stock value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((r) => {
                      const meta = STATUS[r.status] || STATUS.ok
                      return (
                        <TableRow key={r.id} className={!r.is_active ? "opacity-60" : undefined}>
                          <TableCell>
                            <Link
                              href={`/admin/products/${r.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {r.name}
                            </Link>
                            {r.category && (
                              <span className="block text-xs text-muted-foreground">
                                {r.category}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.stock === null ? "—" : formatQuantity(r.stock, r.unit_type)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {r.cost === null ? "—" : formatNaira(r.cost)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {r.status === "untracked" ? "—" : formatNaira(r.stock_cost)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
