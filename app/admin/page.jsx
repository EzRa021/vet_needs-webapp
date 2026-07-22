"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Banknote,
  ShoppingBag,
  Clock,
  Package,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  TriangleAlert,
  Receipt,
  RefreshCw,
  Plus,
  Boxes,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAdminStats } from "@/stores/adminStore"
import { useUser } from "@/stores/authStore"
import { formatNaira } from "@/lib/pricing"
import { cn } from "@/lib/utils"

const STATUS_VARIANT = {
  pending: "secondary",
  paid: "default",
  processing: "default",
  shipped: "default",
  delivered: "default",
  canceled: "destructive",
  refunded: "outline",
}

const chartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--primary))" },
  orders: { label: "Orders", color: "hsl(var(--primary))" },
}

function timeAgo(ts) {
  if (!ts) return null
  const secs = Math.round((Date.now() - ts) / 1000)
  if (secs < 60) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// Direction is conveyed by icon + text, never colour alone (WCAG color-not-only).
function DeltaBadge({ value }) {
  if (value === null || value === undefined) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" />
        No prior data
      </span>
    )
  }
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-semibold tabular-nums",
        up ? "text-success" : "text-destructive"
      )}
    >
      <Icon className="size-3.5" />
      {up ? "+" : ""}
      {value}%
      <span className="font-normal text-muted-foreground">vs prev 30d</span>
    </span>
  )
}

// Every KPI links to the screen where you'd act on it — a number you can't
// follow is a dead end. The whole card is the hit area, not just the label.
function StatCard({ title, value, icon: Icon, delta, hint, href }) {
  return (
    <Card className="group relative gap-0 py-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-within:border-primary/40">
      <CardHeader className="px-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            <Link
              href={href}
              className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {title}
            </Link>
          </CardDescription>
          <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-4">
        {/* Currency at 2 KPIs per row on a 375px screen needs the smaller step
            or "₦11,500.00" overflows its card. */}
        <span className="font-display text-xl font-bold leading-none tabular-nums sm:text-2xl">
          {value}
        </span>
        {delta !== undefined ? (
          <DeltaBadge value={delta} />
        ) : (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}
      </CardContent>
    </Card>
  )
}

// The one section that answers "what do I need to do right now?". It only
// renders when something actually needs doing, so a healthy store gets a
// clean dashboard instead of a row of reassuring zeroes.
function AttentionItem({ icon: Icon, count, label, detail, href, tone }) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
          : "border-border bg-card hover:bg-muted/60"
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold tabular-nums">
          {count} {label}
        </span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminStats()
  const { data: user } = useUser()
  const [metric, setMetric] = useState("revenue")

  // Rendered only after mount: a timestamp and a time-of-day greeting differ
  // between server and client and would trip hydration.
  const [mounted, setMounted] = useState(false)
  const [, setTick] = useState(0)
  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Couldn&apos;t load dashboard</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>
            Refresh the page. If this persists, check that migration 003 has been
            run.
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw data-icon="inline-start" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const firstName = user?.user_metadata?.first_name
  const hour = mounted ? new Date().getHours() : null
  const greeting =
    hour === null
      ? "Dashboard"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening"

  const pending = data?.pendingOrders ?? 0
  const lowStockCount = data?.lowStock?.length ?? 0
  const outOfStock =
    data?.lowStock?.filter((i) => Number(i.stock) === 0).length ?? 0
  const showAttention = !isLoading && (pending > 0 || lowStockCount > 0)

  const seriesEmpty =
    !isLoading && data.series.every((d) => Number(d[metric]) === 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Page header — orientation on the left, the two things you'd actually
          click on the right. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s how your store performed over the last 30 days.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Replaces a decorative "Live" pill with real freshness info. */}
          <span
            className="hidden text-xs text-muted-foreground sm:inline"
            aria-live="polite"
          >
            {isFetching
              ? "Refreshing…"
              : mounted && dataUpdatedAt
                ? `Updated ${timeAgo(dataUpdatedAt)}`
                : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              data-icon="inline-start"
              className={cn(isFetching && "animate-spin")}
            />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/products/new">
              <Plus data-icon="inline-start" />
              New product
            </Link>
          </Button>
        </div>
      </div>

      {/* Needs attention — only when there is something to act on */}
      {showAttention && (
        <section aria-labelledby="needs-attention">
          <h2
            id="needs-attention"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Needs attention
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {pending > 0 && (
              <AttentionItem
                icon={Clock}
                count={pending}
                label={pending === 1 ? "order awaiting payment" : "orders awaiting payment"}
                detail="Unpaid checkout sessions — review or cancel"
                href="/admin/orders"
                tone="default"
              />
            )}
            {lowStockCount > 0 && (
              <AttentionItem
                icon={Package}
                count={lowStockCount}
                label={lowStockCount === 1 ? "product low on stock" : "products low on stock"}
                detail={
                  outOfStock > 0
                    ? `${outOfStock} already out of stock — restock now`
                    : "At or below the restock threshold"
                }
                href="/admin/inventory"
                tone={outOfStock > 0 ? "danger" : "default"}
              />
            )}
          </div>
        </section>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              title="Revenue"
              value={formatNaira(data.revenue30d)}
              icon={Banknote}
              delta={data.deltas.revenue}
              href="/admin/reports"
            />
            <StatCard
              title="Orders"
              value={data.orders30d}
              icon={ShoppingBag}
              delta={data.deltas.orders}
              href="/admin/orders"
            />
            <StatCard
              title="Avg order value"
              value={formatNaira(data.avgOrderValue)}
              icon={Receipt}
              hint="Revenue ÷ orders"
              href="/admin/reports"
            />
            <StatCard
              title="Active products"
              value={data.activeProducts}
              icon={Boxes}
              hint="Published and buyable"
              href="/admin/products"
            />
          </>
        )}
      </div>

      {/* Trend + low stock */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* min-w-0: a grid item defaults to min-width:auto, and recharts'
            ResponsiveContainer reports the width it last measured rather than
            shrinking — between them the chart card grew past a 375px viewport
            and pushed the whole page sideways. */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="text-base">
                  {metric === "revenue" ? "Revenue trend" : "Order volume"}
                </CardTitle>
                <CardDescription>
                  {metric === "revenue"
                    ? "Daily paid revenue, last 30 days"
                    : "Paid orders per day, last 30 days"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {!isLoading && (
                  <span className="font-display text-lg font-bold tabular-nums">
                    {metric === "revenue"
                      ? formatNaira(data.revenue30d)
                      : data.orders30d}
                  </span>
                )}
                {/* The orders series already ships in the payload — showing it
                    costs nothing and answers "was that spike one big order?" */}
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={metric}
                  onValueChange={(v) => v && setMetric(v)}
                  aria-label="Chart metric"
                >
                  <ToggleGroupItem value="revenue" aria-label="Show revenue">
                    Revenue
                  </ToggleGroupItem>
                  <ToggleGroupItem value="orders" aria-label="Show orders">
                    Orders
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : seriesEmpty ? (
              <Empty className="h-[220px]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <TrendingUp />
                  </EmptyMedia>
                  <EmptyTitle>
                    No {metric === "revenue" ? "revenue" : "orders"} yet
                  </EmptyTitle>
                  <EmptyDescription>
                    The trend appears once your first order is paid.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <AreaChart data={data.series} margin={{ left: 4, right: 4, top: 4 }}>
                  <defs>
                    <linearGradient id="fillMetric" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={28}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-NG", { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    allowDecimals={false}
                    tickFormatter={(v) =>
                      metric === "orders"
                        ? v
                        : v >= 1000
                          ? `₦${Math.round(v / 1000)}k`
                          : `₦${v}`
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) =>
                          new Date(v).toLocaleDateString("en-NG", {
                            weekday: "short",
                            day: "numeric",
                            month: "long",
                          })
                        }
                        formatter={(value) =>
                          metric === "revenue"
                            ? [formatNaira(value), " Revenue"]
                            : [value, " Orders"]
                        }
                      />
                    }
                  />
                  <Area
                    dataKey={metric}
                    type="monotone"
                    fill="url(#fillMetric)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">Low stock</CardTitle>
                <CardDescription>At or below threshold</CardDescription>
              </div>
              {!isLoading && lowStockCount > 0 && (
                <Badge variant="destructive" className="tabular-nums">
                  {lowStockCount}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : lowStockCount === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Package />
                  </EmptyMedia>
                  <EmptyTitle>Stock is healthy</EmptyTitle>
                  <EmptyDescription>Nothing needs restocking.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <div className="flex flex-col">
                  {data.lowStock.map((i, idx) => (
                    <div key={i.id}>
                      {idx > 0 && <Separator />}
                      <div className="flex items-center justify-between gap-3 py-2">
                        <span className="truncate text-sm" title={i.name}>
                          {i.name}
                        </span>
                        <Badge
                          variant={Number(i.stock) === 0 ? "destructive" : "secondary"}
                          className="shrink-0 tabular-nums"
                        >
                          {Number(i.stock) === 0
                            ? "Out of stock"
                            : `${Number(i.stock)}${i.unit_type === "kg" ? " kg" : " left"}`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/admin/inventory">
                    Manage inventory
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Recent orders</CardTitle>
              <CardDescription>Latest activity in your store</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/orders">
                View all orders
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : data.recentOrders.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingBag />
                </EmptyMedia>
                <EmptyTitle>No orders yet</EmptyTitle>
                <EmptyDescription>
                  Orders appear here as customers check out.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentOrders.map((o) => (
                  <TableRow key={o.id} className="group">
                    <TableCell>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="rounded-sm font-medium tabular-nums outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        #{o.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[o.status] || "secondary"}
                        className="capitalize"
                      >
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatNaira(o.total_amount)}
                    </TableCell>
                    <TableCell>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
