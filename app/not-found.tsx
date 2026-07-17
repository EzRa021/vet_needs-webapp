import Link from "next/link"
import { Search, Home, PawPrint } from "lucide-react"

import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Page not found",
}

// Served for unmatched routes and for any notFound() call — e.g. a product id
// that no longer exists. Keep the exits shopping-shaped: a dead link should
// hand the visitor back to the catalogue, not to a dead end.
export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <PawPrint className="size-8" />
      </div>

      <p className="eyebrow mb-2">Error 404</p>
      <h1 className="mb-3 font-display text-3xl font-bold">
        We couldn&apos;t find that page
      </h1>
      <p className="mb-8 text-muted-foreground">
        The link may be out of date, or the product may no longer be stocked.
        Everything we sell is still a click away.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/shop">
            <Search />
            Browse the shop
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <Home />
            Go to homepage
          </Link>
        </Button>
      </div>
    </div>
  )
}
