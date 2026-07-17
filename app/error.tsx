"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"

// Catches render/data errors in any storefront route. It renders inside the
// root layout, so the header and footer stay put and the shopper is never
// dumped onto an unbranded page.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Next only sends a digest to the client in production; the real stack is
    // server-side. Logging here is what makes it visible in the browser during
    // development, and gives support something to match against.
    console.error("Storefront error:", error)
  }, [error])

  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" />
      </div>

      <h1 className="mb-3 font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mb-8 text-muted-foreground">
        This page failed to load. It is not something you did — trying again
        usually works. If it keeps happening, get in touch and we will look into it.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>
          <RotateCw />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to homepage</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/contact">Contact support</Link>
        </Button>
      </div>

      {error.digest && (
        <p className="mt-8 text-xs text-muted-foreground">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  )
}
