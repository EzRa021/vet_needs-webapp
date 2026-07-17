"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Download,
  TriangleAlert,
  TrendingUp,
  Receipt,
  ShoppingBag,
  Package,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
import { formatNaira } from "@/lib/pricing"
import { downloadCsv } from "@/lib/csv"
import { useReports } from "@/stores/adminStore"

const iso = (d) => d.toISOString().slice(0, 10)

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "This year", days: null },
]

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminReportsPage() {
  const today = new Date()
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)

  const [from, setFrom] = useState(iso(monthAgo))
  const [to, setTo] = useState(iso(today))

  // `to` is exclusive server-side, so send the start of the NEXT day —
  // otherwise picking "today" silently excludes today's sales.
  const toExclusive = (() => {
    const d = new Date(to)
    d.setDate(d.getDate() + 1)
    return iso(d)
  })()

  const { data, isLoading, isError, error } = useReports({ from, to: toExclusive })

  const setPreset = (days) => {
    const end = new Date()
    const start = days === null ? new Date(end.getFullYear(), 0, 1) : new Date(end)
    if (days !== null) start.setDate(start.getDate() - days)
    setFrom(iso(start))
    setTo(iso(end))
  }

  const s = data?.summary
  const chart = (data?.by_day || []).map((d) => ({
    day: new Date(d.day).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
    revenue: Number(d.revenue),
    orders: Number(d.orders),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Paid orders only. Refunded orders are excluded — refunded VAT isn&apos;t
            VAT you owe.
          </p>
        </div>
      </div>

      {/* Range */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input
              id="from"
              type="date"
              className="w-[150px]"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input
              id="to"
              type="date"
              className="w-[150px]"
              value={to}
              min={from}
              max={iso(today)}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => setPreset(p.days)}>
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t build the report</AlertTitle>
          <AlertDescription>{error?.message || "Run migration 017, then refresh."}</AlertDescription>
        </Alert>
      )}

      {isLoading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : s ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={TrendingUp}
              label="Revenue"
              value={formatNaira(s.revenue)}
              hint={`${s.orders} orders · avg ${formatNaira(s.avg_order_value)}`}
            />
            <Stat
              icon={Receipt}
              label="VAT collected"
              value={formatNaira(s.vat_total)}
              hint={`${formatNaira(s.vat_included)} in prices · ${formatNaira(s.vat_added)} added`}
            />
            <Stat
              icon={ShoppingBag}
              label="Goods"
              value={formatNaira(s.goods)}
              hint={`${formatNaira(s.discounts)} discounted · ${formatNaira(s.shipping)} shipping`}
            />
            <Stat icon={Package} label="Units sold" value={Number(s.units).toLocaleString()} />
          </div>

          {/* The VAT split is the part people get wrong, so spell it out rather
              than leaving a single number to be misread. */}
          <Alert>
            <Receipt className="size-4" />
            <AlertTitle>How VAT is counted</AlertTitle>
            <AlertDescription>
              Most products are priced <strong>VAT-inclusive</strong>, so their VAT sits
              inside the price rather than being added at checkout —{" "}
              {formatNaira(s.vat_included)} here. Only{" "}
              {formatNaira(s.vat_added)} was added on top. Both are money you collected;
              the total is <strong>{formatNaira(s.vat_total)}</strong>.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Revenue</CardTitle>
                  <CardDescription>Paid orders per day</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(`petdo-sales-${from}-to-${to}.csv`, data.by_day, [
                      { key: "day", label: "Date" },
                      { key: "revenue", label: "Revenue (NGN)" },
                      { key: "orders", label: "Orders" },
                    ])
                  }
                >
                  <Download className="size-3.5" />
                  CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ left: -12, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                    />
                    <Tooltip
                      formatter={(v, name) =>
                        name === "revenue" ? formatNaira(v) : v
                      }
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "0.8rem",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#rev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Top products</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      downloadCsv(`petdo-top-products-${from}-to-${to}.csv`, data.top_products, [
                        { key: "name", label: "Product" },
                        { key: "units", label: "Units" },
                        { key: "revenue", label: "Revenue (NGN)" },
                        { key: "orders", label: "Orders" },
                      ])
                    }
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {data.top_products.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No sales in this period.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_products.map((p) => (
                        <TableRow key={p.item_id}>
                          <TableCell className="max-w-[200px] truncate">
                            <Link
                              href={`/admin/products/${p.item_id}`}
                              className="hover:text-primary"
                            >
                              {p.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(p.units)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNaira(p.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Top categories</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      downloadCsv(`petdo-top-categories-${from}-to-${to}.csv`, data.top_categories, [
                        { key: "name", label: "Category" },
                        { key: "units", label: "Units" },
                        { key: "revenue", label: "Revenue (NGN)" },
                      ])
                    }
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {data.top_categories.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No sales in this period.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_categories.map((c) => (
                        <TableRow key={c.category_id || "none"}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(c.units)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNaira(c.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
