"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { useSaveAddress } from "@/stores/addressStore"

const empty = {
  label: "",
  first_name: "",
  last_name: "",
  phone: "",
  address: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "NG",
  is_default: false,
}

// Matches the required fields /api/checkout/create-order validates, minus
// email (account-level) and zip (rarely used in Nigeria).
const REQUIRED = ["first_name", "last_name", "phone", "address", "city", "state"]

export default function AddressForm({ existing, onDone, onCancel }) {
  const { toast } = useToast()
  const save = useSaveAddress()
  const [values, setValues] = useState({ ...empty, ...(existing || {}) })

  const set = (field, value) => setValues((v) => ({ ...v, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()

    const missing = REQUIRED.filter((f) => !String(values[f] || "").trim())
    if (missing.length) {
      toast({
        title: "Missing information",
        description: "Please fill in every required field.",
        variant: "destructive",
      })
      return
    }

    save.mutate(
      {
        id: existing?.id,
        label: values.label?.trim() || null,
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        address2: values.address2?.trim() || null,
        city: values.city.trim(),
        state: values.state,
        zip: values.zip?.trim() || null,
        country: values.country || "NG",
        is_default: !!values.is_default,
      },
      {
        onSuccess: () => {
          toast({ title: existing ? "Address updated" : "Address saved" })
          onDone?.()
        },
        onError: () =>
          toast({ title: "Couldn't save the address", variant: "destructive" }),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label">Label (optional)</Label>
        <Input
          id="label"
          value={values.label || ""}
          placeholder="Home, Shop, Farm…"
          maxLength={40}
          onChange={(e) => set("label", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name *</Label>
          <Input
            id="first_name"
            value={values.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last name *</Label>
          <Input
            id="last_name"
            value={values.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone *</Label>
        <Input
          id="phone"
          type="tel"
          value={values.phone}
          placeholder="080..."
          onChange={(e) => set("phone", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Street address *</Label>
        <Input
          id="address"
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address2">Apartment, landmark (optional)</Label>
        <Input
          id="address2"
          value={values.address2 || ""}
          onChange={(e) => set("address2", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={values.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State *</Label>
          <Select value={values.state} onValueChange={(v) => set("state", v)}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {NIGERIAN_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">Postal code</Label>
          <Input
            id="zip"
            value={values.zip || ""}
            onChange={(e) => set("zip", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_default"
          checked={!!values.is_default}
          // A customer's only address is their default automatically (008), so
          // unticking it there would be a lie — the DB would set it back.
          disabled={!!existing?.is_default}
          onCheckedChange={(checked) => set("is_default", !!checked)}
        />
        <Label htmlFor="is_default" className="text-sm font-normal">
          {existing?.is_default
            ? "This is your default delivery address"
            : "Use as my default delivery address"}
        </Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving..." : existing ? "Save changes" : "Add address"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={save.isPending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
