"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { MailX, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"
import { LEGAL } from "@/lib/legal"

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [done, setDone] = useState(false)
  const [working, setWorking] = useState(false)

  // NOT automatic on load. Mail clients and link-scanners follow URLs in
  // emails, and an auto-unsubscribe would drop people who never clicked. One
  // deliberate button press is the difference between a working unsubscribe and
  // a silent list-shredder.
  const confirm = async () => {
    setWorking(true)
    try {
      const supabase = createClient()
      // Errors are swallowed on purpose: the function is deliberately silent
      // about whether the token matched (it must not confirm who's on the
      // list), so there's nothing truthful to report except "you're off".
      await supabase.rpc("unsubscribe", { p_token: token })
    } finally {
      setWorking(false)
      setDone(true)
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <MailX className="mx-auto size-10 text-muted-foreground/50" />
          <h1 className="font-display text-xl font-bold">This link is incomplete</h1>
          <p className="text-sm text-muted-foreground">
            Unsubscribe links come from our emails and include a private code. Use the
            link at the bottom of any newsletter, or email{" "}
            <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary hover:underline">
              {LEGAL.supportEmail}
            </a>{" "}
            and we&apos;ll take you off.
          </p>
          <Button variant="outline" asChild>
            <Link href="/">Back to the shop</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <h1 className="font-display text-xl font-bold">You&apos;re unsubscribed</h1>
          <p className="text-sm text-muted-foreground">
            You won&apos;t get any more marketing emails from us. Order confirmations
            and delivery updates still come through — those aren&apos;t marketing, and
            you&apos;d want them.
          </p>
          <Button asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-4 p-8 text-center">
        <MailX className="mx-auto size-10 text-muted-foreground/50" />
        <h1 className="font-display text-xl font-bold">Unsubscribe from emails?</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ll stop getting deals and pet care tips. You can resubscribe any
          time from the footer.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={confirm} disabled={working}>
            {working && <Spinner data-icon="inline-start" />}
            Yes, unsubscribe
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Keep me subscribed</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function UnsubscribePage() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Suspense fallback={<Spinner />}>
        <UnsubscribeContent />
      </Suspense>
    </div>
  )
}
