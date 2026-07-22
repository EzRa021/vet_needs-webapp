"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, TriangleAlert, Ticket, Shuffle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSaveCoupon, useAdminTaxonomy } from "@/stores/adminStore"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { describeCoupon, calcDiscount } from "@/lib/coupons"
import { formatNaira } from "@/lib/pricing"

const EMPTY = {
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  min_order_amount: 0,
  max_discount_amount: "",
  max_uses: "",
  max_uses_per_user: 1,
  starts_at: "",
  expires_at: "",
  is_active: true,
  first_order_only: false,
  applies_to_category_ids: [],
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time
const toLocalInput = (iso) => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const randomCode = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // no look-alikes (0/O, 1/I/L)
  let out = ""
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

// Flatten the tree for the scope picker. Departments and their children are all
// valid scopes — validate_coupon() expands whatever's picked to its descendants.
function flattenTree(nodes, out = [], depth = 0) {
  for (const n of nodes || []) {
    out.push({ id: n.id, name: n.name, depth })
    if (n.children?.length) flattenTree(n.children, out, depth + 1)
  }
  return out
}

export default function CouponForm({ coupon }) {
  const router = useRouter()
  const { toast } = useToast()
  const save = useSaveCoupon()
  const { data: tree } = useAdminTaxonomy()
  const categoryOptions = flattenTree(tree)
  const isEdit = Boolean(coupon?.id)

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!coupon) return
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, coupon[k] ?? EMPTY[k]])),
      description: coupon.description || "",
      max_discount_amount: coupon.max_discount_amount ?? "",
      max_uses: coupon.max_uses ?? "",
      starts_at: toLocalInput(coupon.starts_at),
      expires_at: toLocalInput(coupon.expires_at),
      applies_to_category_ids: coupon.applies_to_category_ids || [],
      first_order_only: coupon.first_order_only ?? false,
    })
  }, [coupon])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isPercent = form.discount_type === "percent"

  // Live preview against a sample basket so the operator sees the real effect
  const SAMPLE = 20000
  const previewDiscount = calcDiscount(
    {
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      min_order_amount: Number(form.min_order_amount) || 0,
      max_discount_amount: form.max_discount_amount === "" ? null : Number(form.max_discount_amount),
    },
    SAMPLE
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.code.trim()) return setError("Give the coupon a code.")
    if (!(Number(form.discount_value) > 0)) return setError("The discount must be greater than zero.")
    if (isPercent && Number(form.discount_value) > 100) {
      return setError("A percentage discount can't be more than 100%.")
    }
    if (form.starts_at && form.expires_at && new Date(form.expires_at) <= new Date(form.starts_at)) {
      return setError("The end date must be after the start date.")
    }

    try {
      const saved = await save.mutateAsync({
        id: coupon?.id,
        ...form,
        code: form.code.trim().toUpperCase(),
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      })
      toast({
        title: isEdit ? "Coupon updated" : "Coupon created",
        description: `“${form.code.trim().toUpperCase()}” has been saved.`,
      })
      router.push(`/admin/coupons/${coupon?.id || saved.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  const cancelHref = isEdit ? `/admin/coupons/${coupon.id}` : "/admin/coupons"
  const actions = (
    <>
      <Button type="button" variant="outline" asChild>
        <Link href={cancelHref}>Cancel</Link>
      </Button>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending && <Spinner data-icon="inline-start" />}
        {isEdit ? "Save changes" : "Create coupon"}
      </Button>
    </>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href={isEdit ? `/admin/coupons/${coupon.id}` : "/admin/coupons"}>
              <ArrowLeft data-icon="inline-start" />
              {isEdit ? "Back to coupon" : "Back to coupons"}
            </Link>
          </Button>
          <h1 className="font-display text-xl font-bold">
            {isEdit ? `Edit ${coupon.code}` : "New coupon"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Discount codes customers enter at checkout.
          </p>
        </div>
        {/* Desktop only; the mobile copy sits at the end of the form. */}
        <div className="hidden items-center gap-2 md:flex">{actions}</div>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The code</CardTitle>
              <CardDescription>What the customer types at checkout.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={error && !form.code.trim() ? true : undefined}>
                  <FieldLabel htmlFor="c-code">Code</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="c-code"
                      value={form.code}
                      onChange={(e) => set("code")(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                      placeholder="HARVEST10"
                      className="font-mono uppercase tracking-wider"
                      aria-invalid={error && !form.code.trim() ? true : undefined}
                    />
                    <Button type="button" variant="outline" onClick={() => set("code")(randomCode())}>
                      <Shuffle data-icon="inline-start" />
                      Generate
                    </Button>
                  </div>
                  <FieldDescription>
                    Not case-sensitive for customers — always stored uppercase.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="c-desc">Internal description</FieldLabel>
                  <Textarea
                    id="c-desc"
                    rows={2}
                    value={form.description}
                    onChange={setInput("description")}
                    placeholder="e.g. Harvest season promo for poultry farmers"
                  />
                  <FieldDescription>For your team — never shown to customers.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discount</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <ToggleGroup
                    type="single"
                    value={form.discount_type}
                    onValueChange={(v) => v && set("discount_type")(v)}
                    variant="outline"
                    className="justify-start"
                  >
                    <ToggleGroupItem value="percent">Percentage</ToggleGroupItem>
                    <ToggleGroupItem value="fixed">Fixed amount</ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="c-value">
                      {isPercent ? "Percentage off" : "Amount off (₦)"}
                    </FieldLabel>
                    <Input
                      id="c-value"
                      type="number"
                      step={isPercent ? "1" : "0.01"}
                      min="0"
                      max={isPercent ? "100" : undefined}
                      value={form.discount_value}
                      onChange={setInput("discount_value")}
                    />
                  </Field>

                  {isPercent && (
                    <Field>
                      <FieldLabel htmlFor="c-cap">Maximum discount (₦)</FieldLabel>
                      <Input
                        id="c-cap"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.max_discount_amount}
                        onChange={setInput("max_discount_amount")}
                        placeholder="No cap"
                      />
                      <FieldDescription>
                        Protects margin on large orders.
                      </FieldDescription>
                    </Field>
                  )}
                </div>

                <Field>
                  <FieldLabel htmlFor="c-min">Minimum order (₦)</FieldLabel>
                  <Input
                    id="c-min"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.min_order_amount}
                    onChange={setInput("min_order_amount")}
                  />
                  <FieldDescription>Leave 0 for no minimum.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where it applies</CardTitle>
              <CardDescription>
                Nothing ticked = the whole order. Ticking a department includes
                everything inside it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Categories</FieldLabel>
                  <div className="flex flex-wrap gap-1.5 rounded-lg border p-3">
                    {categoryOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No categories yet.</p>
                    ) : (
                      categoryOptions.map((c) => {
                        const on = form.applies_to_category_ids.includes(c.id)
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                applies_to_category_ids: on
                                  ? f.applies_to_category_ids.filter((x) => x !== c.id)
                                  : [...f.applies_to_category_ids, c.id],
                              }))
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs transition-colors",
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "hover:border-primary/40"
                            )}
                          >
                            {c.depth > 0 && "· "}
                            {c.name}
                          </button>
                        )
                      })
                    )}
                  </div>
                  <FieldDescription>
                    {form.applies_to_category_ids.length === 0
                      ? "Applies to everything in the cart."
                      : `The discount is calculated on the eligible items only — the rest of the order is charged in full.`}
                  </FieldDescription>
                </Field>

                <Field orientation="horizontal">
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="c-first">New customers only</FieldLabel>
                    <FieldDescription>
                      Only usable by someone with no completed orders. Requires an
                      account — guests can&apos;t use it, because there&apos;s no
                      history to check.
                    </FieldDescription>
                  </div>
                  <Switch
                    id="c-first"
                    checked={form.first_order_only}
                    onCheckedChange={set("first_order_only")}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limits &amp; schedule</CardTitle>
              <CardDescription>Leave blank for unlimited / no end date.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="c-max">Total uses</FieldLabel>
                    <Input
                      id="c-max"
                      type="number"
                      min="1"
                      value={form.max_uses}
                      onChange={setInput("max_uses")}
                      placeholder="Unlimited"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="c-peruser">Uses per customer</FieldLabel>
                    <Input
                      id="c-peruser"
                      type="number"
                      min="1"
                      value={form.max_uses_per_user}
                      onChange={setInput("max_uses_per_user")}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="c-start">Starts</FieldLabel>
                    <Input
                      id="c-start"
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={setInput("starts_at")}
                    />
                    <FieldDescription>Blank = starts now.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="c-end">Expires</FieldLabel>
                    <Input
                      id="c-end"
                      type="datetime-local"
                      value={form.expires_at}
                      onChange={setInput("expires_at")}
                    />
                    <FieldDescription>Blank = never expires.</FieldDescription>
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>How this coupon behaves.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-earth/50 bg-earth/5 px-3 py-4">
                <span className="font-mono text-lg font-bold tracking-widest">
                  {form.code || "YOURCODE"}
                </span>
              </div>
              <p className="text-sm">
                {describeCoupon({
                  discount_type: form.discount_type,
                  discount_value: Number(form.discount_value) || 0,
                  min_order_amount: Number(form.min_order_amount) || 0,
                  max_discount_amount:
                    form.max_discount_amount === "" ? null : Number(form.max_discount_amount),
                })}
              </p>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  On a {formatNaira(SAMPLE)} order:
                </p>
                {previewDiscount > 0 ? (
                  <p className="mt-1 font-semibold tabular-nums text-success">
                    −{formatNaira(previewDiscount)} off
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    No discount (below the {formatNaira(form.min_order_amount)} minimum)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Field orientation="horizontal">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="c-active">Active</FieldLabel>
                  <FieldDescription>Turn off to disable immediately.</FieldDescription>
                </div>
                <Switch id="c-active" checked={form.is_active} onCheckedChange={set("is_active")} />
              </Field>
            </CardContent>
          </Card>

          <Alert>
            <Ticket />
            <AlertDescription>
              A use is only counted when an order is <strong>paid</strong> — abandoned
              carts never burn a redemption.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Mobile action bar — see product-form: actions belong at the end of the
          form on a phone, not above the first field. */}
      <div className="grid grid-cols-2 gap-2 [&>*]:w-full md:hidden">
        {actions}
      </div>
    </form>
  )
}
