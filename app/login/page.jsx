"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Loader2, PawPrint, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import AuthShell from "@/components/auth-shell"
import { useToast } from "@/hooks/use-toast"
import { useLogin, loginWithGoogle, loginWithFacebook } from "@/stores/authStore"
import { friendlyAuthError } from "@/lib/auth-errors"

function LoginPageContent() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [formError, setFormError] = useState(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const login = useLogin()

  // Where to go after login (e.g. /login?redirect=/checkout)
  const redirectTo = searchParams.get('redirect') || '/'

  const handleLogin = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!email || !password) {
      setFormError({
        title: "Missing details",
        description: "Please enter both your email and your password.",
      })
      return
    }

    try {
      // Trim the email — a stray space (common on mobile autocomplete) would
      // otherwise fail as "Incorrect email or password". Never trim passwords.
      await login.mutateAsync({ email: email.trim().toLowerCase(), password })

      toast({
        title: "Welcome back! 👋",
        description: "You have successfully logged in.",
      })

      router.push(redirectTo)
    } catch (error) {
      setFormError(friendlyAuthError(error))
    }
  }

  const handleGoogleLogin = async () => {
    setFormError(null)
    try {
      await loginWithGoogle()
      // OAuth will redirect automatically
    } catch (error) {
      setFormError(friendlyAuthError(error))
    }
  }

  const handleFacebookLogin = async () => {
    setFormError(null)
    try {
      await loginWithFacebook()
      // OAuth will redirect automatically
    } catch (error) {
      setFormError(friendlyAuthError(error))
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue shopping"
      footer={
        <>
          Don't have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <div className="space-y-4">
          {formError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{formError.title}</AlertTitle>
              <AlertDescription>{formError.description}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={login.isPending}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={login.isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={login.isPending}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember" 
                checked={rememberMe}
                onCheckedChange={setRememberMe}
                disabled={login.isPending}
              />
              <Label htmlFor="remember" className="text-sm font-normal">
                Remember me
              </Label>
            </div>
            <Button 
              className="w-full" 
              size="lg"
              type="submit"
              disabled={login.isPending}
            >
              {login.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="relative mt-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Button 
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={login.isPending}
              type="button"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Button>
            <Button 
              variant="outline"
              onClick={handleFacebookLogin}
              disabled={login.isPending}
              type="button"
            >
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
              Facebook
            </Button>
          </div>
      </div>
    </AuthShell>
  )
}

// useSearchParams requires a Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container max-w-md px-4 py-12" />}>
      <LoginPageContent />
    </Suspense>
  )
}
