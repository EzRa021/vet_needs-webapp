"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Without this, a dashboard error would fall through to app/error.tsx, which
// offers staff "Browse the shop" — the wrong exit from an admin screen. This
// keeps them inside the dashboard shell and says more, since the audience is
// staff who can act on it.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="inline-flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-7" />
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold">This screen failed to load</h1>
            <p className="mt-2 text-muted-foreground">
              Nothing was saved or changed. Retry the screen — if it keeps failing,
              the message below will point at the cause.
            </p>
          </div>

          {/* Staff-only surface, so showing the message is useful rather than a
              leak — customers never reach this file. */}
          <pre className="max-h-32 w-full overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message || "Unknown error"}
            {error.digest ? `\n\nReference: ${error.digest}` : ""}
          </pre>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={reset}>
              <RotateCw />
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
