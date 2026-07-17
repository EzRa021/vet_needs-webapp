"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthShell from "@/components/auth-shell"
import { useToast } from "@/hooks/use-toast"
import { useForgotPassword } from "@/stores/authStore"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [emailSent, setEmailSent] = useState(false)

  const { toast } = useToast()
  const forgotPassword = useForgotPassword()

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!email) {
      toast({
        title: "Enter your email",
        description: "Please enter the email address for your account.",
        variant: "destructive",
      })
      return
    }

    try {
      await forgotPassword.mutateAsync({ email })
      setEmailSent(true)
      toast({
        title: "Email sent!",
        description: "Check your inbox for a password reset link.",
      })
    } catch (error) {
      toast({
        title: "Couldn't send email",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
      })
    }
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle={
        emailSent
          ? "We've emailed you reset instructions"
          : "Enter your email and we'll send a reset link"
      }
      footer={
        <>
          Remember your password?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to login
          </Link>
        </>
      }
    >
      {!emailSent ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={forgotPassword.isPending}
            />
          </div>
          <Button className="w-full" size="lg" type="submit" disabled={forgotPassword.isPending}>
            {forgotPassword.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center rounded-2xl border border-success/30 bg-success/10 p-6 text-center">
            <MailCheck className="mb-2 h-10 w-10 text-success" />
            <p className="text-sm text-muted-foreground">
              Check your inbox and click the link to reset your password. If you
              don't see it, check your spam folder.
            </p>
          </div>
          <Button className="w-full" size="lg" variant="outline" onClick={() => setEmailSent(false)}>
            Send another email
          </Button>
        </div>
      )}
    </AuthShell>
  )
}
