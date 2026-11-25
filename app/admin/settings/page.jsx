"use client"

import { useEffect, useState } from "react"
import { TriangleAlert, ShieldCheck, Save, Info, MailCheck, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  useAdminSettings,
  useOrderAlertStatus,
  useSaveSettings,
  useSendTestOrderAlert,
} from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"

// settings.value is jsonb, so a string arrives quoted-decoded already.
const raw = (v) => (v === null || v === undefined ? "" : String(v))

// Settings that may not have a row yet (added after the seed). The form still
// edits them; the first save creates the row.
const EXTRA_KEYS = ["order_alert_email"]

const list = (emails) => (emails?.length ? emails.join(", ") : "")

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const { data: settings, isLoading, isError, error } = useAdminSettings()
  const save = useSaveSettings()
  const alertStatus = useOrderAlertStatus()
  const testAlert = useSendTestOrderAlert()

  const [form, setForm] = useState({})
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    if (!settings) return
    const next = {}
    for (const s of settings) next[s.key] = raw(s.value)
    setForm(next)
  }, [settings])

  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const byKey = Object.fromEntries((settings || []).map((s) => [s.key, s]))
  const keys = [...new Set([...(settings || []).map((s) => s.key), ...EXTRA_KEYS])]
  const dirty = settings && keys.some((k) => raw(byKey[k]?.value) !== (form[k] ?? ""))
  const alertDirty = raw(byKey.order_alert_email?.value) !== (form.order_alert_email ?? "")
  const alertInfo = alertStatus.data

  const sendTest = async () => {
    try {
      const { sent, failed } = await testAlert.mutateAsync()
      toast({
        title: `Test email sent to ${list(sent)}`,
        description: failed.length
          ? `Couldn't reach ${list(failed.map((f) => f.to))}.`
          : "Check the inbox (and spam, the first time). It can take a minute to arrive.",
      })
    } catch (err) {
      toast({ title: "Test email didn't send", description: err.message, variant: "destructive" })
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setFormError(null)

    // Percent, matching items.vat_rate (7.5). It used to be validated as a
    // decimal (0–1) while every product stored a percent — two units for one
    // concept, in a field nothing read. See 017.
    const vat = Number(form.vat_rate)
    if (form.vat_rate !== "" && (!Number.isFinite(vat) || vat < 0 || vat > 100)) {
      setFormError("VAT rate is a percentage — enter 7.5 for 7.5%.")
      return
    }

    try {
      await save.mutateAsync(form)
      toast({ title: "Settings saved" })
    } catch (err) {
      setFormError(err.message)
    }
  }

  const forbidden = String(error?.message || "").includes("Forbidden")

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <TriangleAlert />
        <AlertTitle>{forbidden ? "Admin access required" : "Couldn't load settings"}</AlertTitle>
        <AlertDescription>
          {forbidden
            ? "Only administrators can change store settings."
            : "Refresh the page, or check migration 003."}
        </AlertDescription>
      </Alert>
    )
  }

  const actions = (
    <Button type="submit" disabled={!dirty || save.isPending}>
      {save.isPending && <Spinner data-icon="inline-start" />}
      <Save data-icon="inline-start" />
      Save changes
    </Button>
  )

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Store-wide configuration</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Admin only
          </Badge>
          {/* Desktop only; mobile copy is at the end of the form. */}
          <div className="hidden md:block">{actions}</div>
        </div>
      </div>

      {formError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Store</CardTitle>
              <CardDescription>Identity and contact details.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="store_name">Store name</FieldLabel>
                  <Input
                    id="store_name"
                    value={form.store_name ?? ""}
                    onChange={setInput("store_name")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="support_email">Support email</FieldLabel>
                  <Input
                    id="support_email"
                    type="email"
                    value={form.support_email ?? ""}
                    onChange={setInput("support_email")}
                  />
                  <FieldDescription>Shown in the footer and contact page.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="support_phone">Support phone</FieldLabel>
                  <Input
                    id="support_phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="0803 123 4567"
                    value={form.support_phone ?? ""}
                    onChange={setInput("support_phone")}
                  />
                  <FieldDescription>
                    Shown large in the shop&apos;s footer, and used for the green WhatsApp chat
                    button on every page, so use a number that&apos;s on WhatsApp. Leave it empty
                    to hide both.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="currency">Currency</FieldLabel>
                  <Input id="currency" value={form.currency ?? ""} readOnly disabled />
                  <FieldDescription>
                    Fixed to NGN — Paystack charges in Naira, and changing this would
                    misprice every product.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checkout</CardTitle>
              <CardDescription>Shipping and tax defaults.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="shipping_flat_fee">Flat shipping fee (₦)</FieldLabel>
                  <Input
                    id="shipping_flat_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.shipping_flat_fee ?? ""}
                    onChange={setInput("shipping_flat_fee")}
                  />
                  <FieldDescription>
                    Charged on every order. Currently{" "}
                    {formatNaira(Number(form.shipping_flat_fee) || 0)}.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="free_shipping_threshold">Free shipping over (₦)</FieldLabel>
                  <Input
                    id="free_shipping_threshold"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.free_shipping_threshold ?? ""}
                    onChange={setInput("free_shipping_threshold")}
                    placeholder="Disabled"
                  />
                  <FieldDescription>Leave blank to always charge shipping.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="vat_rate">Default VAT rate (%)</FieldLabel>
                  <Input
                    id="vat_rate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.vat_rate ?? ""}
                    onChange={setInput("vat_rate")}
                  />
                  <FieldDescription>
                    Enter 7.5 for 7.5%. Each product carries its own VAT setting —
                    this is the value new products start with.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MailCheck className="size-4 text-primary" aria-hidden="true" />
                Notifications
              </CardTitle>
              <CardDescription>Who gets an email when a customer places an order.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {alertInfo && !alertInfo.emailConfigured && (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertTitle>Email isn&apos;t set up on the server yet</AlertTitle>
                  <AlertDescription>
                    No order emails can go out until a sender is added to your hosting environment
                    and the site is redeployed: ZEPTOMAIL_TOKEN and EMAIL_FROM for Zoho ZeptoMail, or
                    GMAIL_USER and GMAIL_APP_PASSWORD (a Google app password).
                  </AlertDescription>
                </Alert>
              )}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="order_alert_email">Order alert email</FieldLabel>
                  <Input
                    id="order_alert_email"
                    // Text, not type="email" multiple: browsers strip the spaces
                    // after commas while you type. The server validates each address.
                    type="text"
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                    value={form.order_alert_email ?? ""}
                    onChange={setInput("order_alert_email")}
                    placeholder="owner@gmail.com, manager@gmail.com"
                    className="max-w-xl"
                  />
                  <FieldDescription>
                    Every new order is emailed here, with the customer&apos;s phone, address and items.
                    Separate up to 5 addresses with commas.{" "}
                    {alertStatus.isLoading
                      ? null
                      : alertInfo?.source === "settings"
                        ? `Alerts currently go to ${list(alertInfo.recipients)}.`
                        : alertInfo?.fallback?.length
                          ? `Left blank, alerts go to ${list(alertInfo.fallback)}.`
                          : "Left blank, nobody gets order emails."}
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={sendTest}
                  disabled={
                    testAlert.isPending || alertDirty || !alertInfo?.emailConfigured || !alertInfo?.recipients?.length
                  }
                >
                  {testAlert.isPending ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                  Send test email
                </Button>
                <span className="text-sm text-muted-foreground">
                  {alertDirty
                    ? "Save changes first, then send a test."
                    : "Sends a sample order to the address above."}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Want a phone notification? Use the Gmail address signed in on your phone. If it&apos;s the
                same account the shop sends from, the Gmail app may not notify you about mail from itself.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Alert>
        <Info />
        <AlertTitle>Where these are used</AlertTitle>
        <AlertDescription>
          The shipping fee and free-shipping threshold are applied at checkout —
          the server recalculates every order from these values, so changes take
          effect on the next order. The VAT rate here is only the default for new
          products; each product carries its own VAT setting.
        </AlertDescription>
      </Alert>

      {/* Mobile: the only action, at the end of the settings list. */}
      <div className="[&>*]:w-full md:hidden">{actions}</div>
    </form>
  )
}
