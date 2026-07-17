"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MailWarning, ExternalLink, RefreshCw, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { useUser, useLogout } from "@/stores/authStore"
import { getWebmail } from "@/lib/email-provider"
import { createClient } from "@/lib/supabase/client"
import AccountNav from "@/components/account-nav"

// Gate for every /account page: signed in AND email confirmed.
// An unconfirmed account must not reach its profile or order history.
export default function AccountLayout({ children }) {
  const router = useRouter()
  const { toast } = useToast()
  const { data: user, isLoading } = useUser()
  const logout = useLogout()
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) router.push("/login?redirect=/account/orders")
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const confirmed = Boolean(user.email_confirmed_at || user.confirmed_at)

  if (!confirmed) {
    const webmail = getWebmail(user.email)

    const handleResend = async () => {
      setResending(true)
      try {
        const supabase = createClient()
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: user.email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        toast({
          title: "Confirmation email sent",
          description: `We sent another link to ${user.email}.`,
        })
      } catch (err) {
        toast({
          title: "Couldn't resend just yet",
          description: err.message?.includes("rate")
            ? "Please wait a minute before requesting another email."
            : err.message,
          variant: "destructive",
        })
      } finally {
        setResending(false)
      }
    }

    return (
      <div className="container flex min-h-[60vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-earth/15 text-earth">
              <MailWarning className="size-7" />
            </div>
            <CardTitle>Confirm your email to continue</CardTitle>
            <CardDescription>
              Your account isn&apos;t active yet. Click the link we sent to{" "}
              <span className="font-medium text-foreground">{user.email}</span> to
              unlock your profile and orders.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {webmail && (
              <Button asChild size="lg">
                <a href={webmail.url} target="_blank" rel="noopener noreferrer">
                  Open {webmail.name}
                  <ExternalLink data-icon="inline-end" />
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={handleResend} disabled={resending}>
              {resending ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
              Resend the email
            </Button>
            <Button
              variant="ghost"
              onClick={() => logout.mutate()}
              className="text-muted-foreground"
            >
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
            <p className="pt-2 text-center text-xs text-muted-foreground">
              Already confirmed? Sign out and back in to refresh your session.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container px-4 py-8 md:px-6 md:py-10">
      <header className="mb-1">
        <h1 className="font-display text-2xl font-bold">My account</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </header>
      <AccountNav />
      <div className="pt-6">{children}</div>
    </div>
  )
}
