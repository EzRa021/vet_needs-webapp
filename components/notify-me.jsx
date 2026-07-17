"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { BellRing, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/stores/authStore"

// Back-in-stock capture (022).
//
// Only email is offered, because only email can send. The column behind this is
// channel-agnostic and a WhatsApp option drops in the day a sender exists — but
// offering "WhatsApp me" now would be a promise nothing keeps, which is the
// exact failure this codebase keeps turning up.
export default function NotifyMe({ item }) {
  const { toast } = useToast()
  const { data: user } = useUser()
  const [email, setEmail] = useState("")
  const [done, setDone] = useState(false)

  const request = useMutation({
    mutationFn: async (address) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("request_stock_notification", {
        p_item_id: item.id,
        p_email: address,
        p_phone: null,
        p_notify_by: "email",
      })
      if (error) throw error
      const result = Array.isArray(data) ? data[0] : data
      if (!result?.ok) throw new Error(result?.reason || "Couldn't add you to the list.")
      return result
    },
  })

  const submit = (e) => {
    e.preventDefault()
    const address = (email || user?.email || "").trim()
    if (!address) return

    request.mutate(address, {
      onSuccess: () => setDone(true),
      onError: (err) =>
        toast({
          title: "Couldn't add you to the list",
          description: err.message,
          variant: "destructive",
        }),
    })
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
        <Check className="mt-0.5 size-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium">We&apos;ll email you</p>
          <p className="text-sm text-muted-foreground">
            As soon as {item.name} is back. One message about this product — you
            haven&apos;t subscribed to anything.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Tell me when it&apos;s back</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you once, the moment it&apos;s in stock. We can&apos;t
            hold stock, so it&apos;s first come first served.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Label htmlFor="notify-email" className="sr-only">
          Email address
        </Label>
        <Input
          id="notify-email"
          type="email"
          required
          // Signed in? Their address is already known — prefilled, still editable
          // in case they want it somewhere else.
          value={email || user?.email || ""}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1"
        />
        <Button type="submit" disabled={request.isPending}>
          {request.isPending && <Spinner data-icon="inline-start" />}
          Notify me
        </Button>
      </div>
    </form>
  )
}
