"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MailCheck, ExternalLink, RefreshCw } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { getWebmail } from "@/lib/email-provider"
import { createClient } from "@/lib/supabase/client"
import { siteUrlTo } from '@/lib/site-url'

// Shown after signup: the account exists but can't be used until the emailed
// link is clicked. Deliberately has no close-to-dismiss escape into the app.
export default function VerifyEmailDialog({ open, email, onOpenChange }) {
  const router = useRouter()
  const { toast } = useToast()
  const [resending, setResending] = useState(false)
  const webmail = getWebmail(email)

  const handleResend = async () => {
    setResending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: siteUrlTo('/auth/callback') },
      })
      if (error) throw error
      toast({
        title: "Confirmation email sent",
        description: `We sent another link to ${email}.`,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-7" />
          </div>
          <DialogTitle className="text-center">Confirm your email</DialogTitle>
          <DialogDescription className="text-center">
            Your account is created, but you need to confirm it before you can
            sign in. We sent a link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
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
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Can&apos;t find it? Check your spam folder — the link expires after 24 hours.
        </p>

        <DialogFooter>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              onOpenChange(false)
              router.push("/login")
            }}
          >
            I&apos;ve confirmed — go to sign in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
