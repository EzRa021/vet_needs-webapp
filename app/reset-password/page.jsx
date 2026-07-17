"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthShell from "@/components/auth-shell"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

// User lands here from the password-recovery email link
// (see useForgotPassword in stores/authStore.js).
export default function ResetPasswordPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters.",
        variant: "destructive",
      })
      return
    }
    if (password !== confirm) {
      toast({
        title: "Passwords don't match",
        description: "Please retype the same password in both fields.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast({
        title: "Password updated",
        description: "You can now log in with your new password.",
      })
      router.push("/login")
    } catch (error) {
      toast({
        title: "Could not reset password",
        description:
          error.message ||
          "The reset link may have expired. Request a new one from the login page.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password for your account"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Update password"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Link expired?{" "}
              <Link href="/forgot-password" className="text-primary underline">
                Request a new one
              </Link>
            </p>
          </form>
    </AuthShell>
  )
}
