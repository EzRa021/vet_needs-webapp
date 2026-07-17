"use client"

import Link from "next/link"
import {
  Banknote,
  ShoppingBag,
  Clock,
  Package,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  TriangleAlert,
  Receipt,
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

function StatCard({ title, value, icon: Icon, delta, hint }) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="px-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            {title}
          </CardDescription>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-4">
        <span className="font-display text-2xl font-bold tabular-nums leading-none">
          {value}
        </span>
        {delta !== undefined ? <DeltaBadge value={delta} /> : (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useAdminStats()

  if (isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Couldn&apos;t load dashboard</AlertTitle>
        <AlertDescription>
          Refresh the page. If this persists, check that migration 003 has been run.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Store performance over the last 30 days
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="size-1.5 rounded-full bg-success" />
          Live
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              title="Revenue"
              value={formatNaira(data.revenue30d)}
              icon={Banknote}
              delta={data.deltas.revenue}
            />
            <StatCard
              title="Orders"
              value={data.orders30d}
              icon={ShoppingBag}
              delta={data.deltas.orders}
            />
            <StatCard
              title="Avg order value"
              value={formatNaira(data.avgOrderValue)}
              icon={Receipt}
              hint="Revenue ÷ orders"
            />
            <StatCard
              title="Awaiting payment"
              value={data.pendingOrders}
              icon={Clock}
              hint="Unpaid checkout sessions"
            />
          </>
        )}
      </div>

      {/* Trend + low stock */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">Revenue trend</CardTitle>
                <CardDescription>Daily paid revenue, last 30 days</CardDescription>
              </div>
              {!isLoading && (
                <span className="font-display text-lg font-bold tabular-nums">
                  {formatNaira(data.revenue30d)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : data.series.every((d) => d.revenue === 0) ? (
              <Empty className="h-[220px]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <TrendingUp />
                  </EmptyMedia>
                  <EmptyTitle>No revenue yet</EmptyTitle>
                  <EmptyDescription>
                    The trend appears once your first order is paid.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <AreaChart data={data.series} margin={{ left: 4, right: 4, top: 4 }}>
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
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
                    tickFormatter={(v) =>
                      v >= 1000 ? `₦${Math.round(v / 1000)}k` : `₦${v}`
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
                        formatter={(value) => [formatNaira(value), " Revenue"]}
                      />
                    }
                  />
                  <Area
                    dataKey="revenue"
                    type="monotone"
                    fill="url(#fillRevenue)"
                    stroke="var(--color-revenue)"
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
              {!isLoading && data.lowStock.length > 0 && (
                <Badge variant="destructive" className="tabular-nums">
                  {data.lowStock.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data.lowStock.length === 0 ? (
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
              <div className="flex flex-col">
                {data.lowStock.map((i, idx) => (
                  <div key={i.id}>
                    {idx > 0 && <Separator />}
                    <div className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate text-sm">{i.name}</span>
                      <Badge
                        variant={Number(i.stock) === 0 ? "destructive" : "secondary"}
                        className="shrink-0 tabular-nums"
                      >
                        {Number(i.stock)}
                        {i.unit_type === "kg" ? " kg" : ""}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/orders">
                  View all orders
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium tabular-nums hover:text-primary hover:underline"
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
