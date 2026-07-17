import Link from "next/link"
import { XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Shown when the OAuth / email-link code exchange fails (see app/auth/callback).
export default function AuthCodeErrorPage() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <XCircle className="h-14 w-14 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Sign-in link problem</h1>
          <p className="text-muted-foreground">
            The sign-in link is invalid or has expired. Please try logging in
            again — or request a new password-reset email if that's how you got
            here.
          </p>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/login">Back to Login</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/forgot-password">Reset Password</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
