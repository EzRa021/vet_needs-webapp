import { Card, CardContent } from "@/components/ui/card"
import { formatNaira } from "@/lib/pricing"

// Compact ₦ for labels where the full figure is shown nearby: ₦1.2m, ₦456k.
const short = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `₦${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}m`
  if (Math.abs(v) >= 1e3) return `₦${Math.round(v / 1e3)}k`
  return formatNaira(v)
}

// What the shelf is worth: one figure (cost), and one bar splitting the
// sale value (without VAT) into what it cost and what it would earn.
export default function Valuation({ totals }) {
  const cost = Number(totals.cost_value) || 0
  const margin = Number(totals.potential_margin) || 0
  const saleValue = cost + Math.max(margin, 0)
  const costShare = saleValue > 0 ? (cost / saleValue) * 100 : 100
  const marginPercent = saleValue > 0 ? (margin / saleValue) * 100 : 0

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Stock value at cost</p>
            <p className="font-display text-3xl font-bold tabular-nums">{formatNaira(cost)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Sells for, with VAT</p>
            <p className="font-display text-lg font-semibold tabular-nums">{formatNaira(totals.retail_value)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div aria-hidden="true" className="flex h-3 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${costShare}%` }} />
            <div className="h-full flex-1 bg-success/60" />
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
              Cost <span className="font-semibold tabular-nums">{short(cost)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-success/60" aria-hidden="true" />
              Margin if it all sells{" "}
              <span className="font-semibold tabular-nums">
                {short(margin)} ({marginPercent.toFixed(0)}%)
              </span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Margin is worked out without VAT, over products with a cost price.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
