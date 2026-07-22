"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { Eye, EyeOff, MailCheck, ShieldCheck, User, KeyRound, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/stores/authStore"
import { useProfile } from "@/stores/adminStore"
import { createClient } from "@/lib/supabase/client"
import { friendlyAuthError } from "@/lib/auth-errors"
import { roleMeta } from "@/lib/roles"
import { siteUrlTo } from '@/lib/site-url'

export default function ProfilePage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: user } = useUser()
  const { data: profile, isLoading } = useProfile()

  // ---- Personal details ----
  const [details, setDetails] = useState({ full_name: "", phone: "" })
  const [savingDetails, setSavingDetails] = useState(false)

  useEffect(() => {
    if (profile) {
      setDetails({ full_name: profile.full_name || "", phone: profile.phone || "" })
    }
  }, [profile])

  const detailsDirty =
    profile &&
    (details.full_name !== (profile.full_name || "") ||
      details.phone !== (profile.phone || ""))

  const saveDetails = async (e) => {
    e.preventDefault()
    if (!details.full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" })
      return
    }
    setSavingDetails(true)
    try {
      const supabase = createClient()
      // RLS "users update own profile" restricts this to the caller's row.
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: details.full_name.trim(),
          phone: details.phone.trim() || null,
        })
        .eq("id", user.id)
      if (error) throw error

      qc.invalidateQueries({ queryKey: ["profile"] })
      toast({ title: "Profile updated" })
    } catch (err) {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" })
    } finally {
      setSavingDetails(false)
    }
  }

  // ---- Password ----
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" })
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState(null)

  const changePassword = async (e) => {
    e.preventDefault()
    setPwError(null)

    if (pw.next.length < 8) {
      return setPwError("The new password must be at least 8 characters.")
    }
    if (pw.next !== pw.confirm) {
      return setPwError("The new passwords don't match.")
    }

    setSavingPw(true)
    try {
      const supabase = createClient()

      // Verify the current password first — updateUser alone would let anyone
      // at an unlocked screen take over the account.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pw.current,
      })
      if (reauthError) {
        setPwError("Your current password is incorrect.")
        return
      }

      const { error } = await supabase.auth.updateUser({ password: pw.next })
      if (error) throw error

      setPw({ current: "", next: "", confirm: "" })
      toast({ title: "Password changed", description: "Use the new password next time you sign in." })
    } catch (err) {
      setPwError(friendlyAuthError(err).description)
    } finally {
      setSavingPw(false)
    }
  }

  // ---- Email ----
  const [newEmail, setNewEmail] = useState("")
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailNotice, setEmailNotice] = useState(null)

  const changeEmail = async (e) => {
    e.preventDefault()
    setEmailNotice(null)
    const email = newEmail.trim().toLowerCase()
    if (!email || email === user.email) {
      return setEmailNotice({ tone: "error", text: "Enter a different email address." })
    }

    setSavingEmail(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: siteUrlTo('/auth/callback') }
      )
      if (error) throw error

      setNewEmail("")
      setEmailNotice({
        tone: "ok",
        text: `Confirmation sent to ${email}. The change takes effect once you click the link.`,
      })
    } catch (err) {
      setEmailNotice({ tone: "error", text: friendlyAuthError(err).description })
    } finally {
      setSavingEmail(false)
    }
  }

  const role = roleMeta(profile?.role)

  // The heading, container and nav live in app/account/layout.jsx.
  return (
    <div className="max-w-3xl">
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Personal details */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="size-4 text-primary" />
                    Personal details
                  </CardTitle>
                  <CardDescription>Used on your orders and deliveries.</CardDescription>
                </div>
                <Badge variant={role.variant} className="capitalize">{role.label}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveDetails}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="full_name">Full name</FieldLabel>
                    <Input
                      id="full_name"
                      value={details.full_name}
                      onChange={(e) => setDetails((d) => ({ ...d, full_name: e.target.value }))}
                      autoComplete="name"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input
                      id="phone"
                      type="tel"
                      value={details.phone}
                      onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
                      placeholder="+234 800 000 0000"
                      autoComplete="tel"
                    />
                    <FieldDescription>For delivery updates.</FieldDescription>
                  </Field>
                  <Button type="submit" className="w-fit" disabled={!detailsDirty || savingDetails}>
                    {savingDetails && <Spinner data-icon="inline-start" />}
                    Save details
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          {/* Email */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4 text-primary" />
                Email
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <MailCheck className="size-3.5 text-success" />
                {user?.email} — confirmed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={changeEmail}>
                <FieldGroup>
                  {emailNotice && (
                    <Alert variant={emailNotice.tone === "error" ? "destructive" : "default"}>
                      <AlertDescription>{emailNotice.text}</AlertDescription>
                    </Alert>
                  )}
                  <Field>
                    <FieldLabel htmlFor="new_email">New email address</FieldLabel>
                    <Input
                      id="new_email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                    />
                    <FieldDescription>
                      We&apos;ll send a confirmation link — the change only happens after you click it.
                    </FieldDescription>
                  </Field>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-fit"
                    disabled={!newEmail.trim() || savingEmail}
                  >
                    {savingEmail && <Spinner data-icon="inline-start" />}
                    Change email
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          {/* Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-4 text-primary" />
                Password
              </CardTitle>
              <CardDescription>
                Choose a strong password you don&apos;t use anywhere else.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={changePassword}>
                <FieldGroup>
                  {pwError && (
                    <Alert variant="destructive">
                      <AlertDescription>{pwError}</AlertDescription>
                    </Alert>
                  )}
                  <Field data-invalid={pwError ? true : undefined}>
                    <FieldLabel htmlFor="pw_current">Current password</FieldLabel>
                    <Input
                      id="pw_current"
                      type="password"
                      value={pw.current}
                      onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                      autoComplete="current-password"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="pw_next">New password</FieldLabel>
                      <div className="relative">
                        <Input
                          id="pw_next"
                          type={showPw ? "text" : "password"}
                          value={pw.next}
                          onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                          autoComplete="new-password"
                          minLength={8}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPw((s) => !s)}
                        >
                          {showPw ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                          <span className="sr-only">{showPw ? "Hide" : "Show"} password</span>
                        </Button>
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="pw_confirm">Confirm new password</FieldLabel>
                      <Input
                        id="pw_confirm"
                        type={showPw ? "text" : "password"}
                        value={pw.confirm}
                        onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                        autoComplete="new-password"
                        minLength={8}
                      />
                    </Field>
                  </div>
                  <Button
                    type="submit"
                    className="w-fit"
                    disabled={!pw.current || !pw.next || !pw.confirm || savingPw}
                  >
                    {savingPw ? <Spinner data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
                    Change password
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
