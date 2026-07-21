"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Eye, EyeOff, Trash2, BadgeCheck, Star, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { StarRating } from "@/components/star-rating"
import BrandImage from "@/components/brand-image"
import {
  useAdminReviews,
  useModerateReview,
  useDeleteAdminReview,
} from "@/stores/adminStore"

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

function ReviewRow({ review }) {
  const { toast } = useToast()
  const moderate = useModerateReview()
  const remove = useDeleteAdminReview()

  const hide = () =>
    moderate.mutate(
      { id: review.id, is_approved: !review.is_approved },
      {
        onSuccess: () =>
          toast({
            title: review.is_approved ? "Review hidden" : "Review restored",
            description: review.is_approved
              ? "It no longer appears on the storefront or counts toward the rating."
              : "It's live on the storefront again.",
          }),
        onError: () =>
          toast({ title: "Couldn't update the review", variant: "destructive" }),
      }
    )

  return (
    <Card className={review.is_approved ? undefined : "border-dashed bg-muted/30"}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
        {/* Product */}
        <Link
          href={`/product/${review.item_id}`}
          target="_blank"
          className="group flex shrink-0 items-center gap-3 sm:w-56"
        >
          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
            <BrandImage
              src={review.item?.image_url}
              alt={review.item?.name || "Product"}
              fill
              sizes="48px"
              className="object-cover"
              placeholderLabel={review.item?.name}
            />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium group-hover:text-primary">
              {review.item?.name || "Deleted product"}
            </p>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              View <ExternalLink className="size-3" />
            </span>
          </div>
        </Link>

        {/* Review */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StarRating value={review.rating} size="sm" />
            {review.title && <span className="font-medium">{review.title}</span>}
            {review.is_verified_purchase && (
              <Badge variant="secondary" className="gap-1 font-normal">
                <BadgeCheck className="size-3.5 text-success" />
                Verified
              </Badge>
            )}
            {!review.is_approved && (
              <Badge variant="outline" className="font-normal">Hidden</Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {review.author_name || "VetNeeds customer"} · {formatDate(review.created_at)}
          </p>

          {review.comment && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {review.comment}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-1 sm:flex-col">
          <Button
            variant="outline"
            size="sm"
            onClick={hide}
            disabled={moderate.isPending}
            className="flex-1 sm:flex-none"
          >
            {review.is_approved ? (
              <>
                <EyeOff className="size-3.5" />
                Hide
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                Restore
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-destructive hover:text-destructive sm:flex-none"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this review permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can&apos;t be undone. If you only want it off the storefront,
                  use <strong>Hide</strong> instead — hiding is reversible and already
                  removes it from the product&apos;s rating.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    remove.mutate(review.id, {
                      onSuccess: () => toast({ title: "Review deleted" }),
                      onError: () =>
                        toast({ title: "Couldn't delete the review", variant: "destructive" }),
                    })
                  }
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminReviewsPage() {
  const [searchInput, setSearchInput] = useState("")
  const [filters, setFilters] = useState({ status: "all", rating: "all", search: "", page: 1 })

  const { data, isLoading } = useAdminReviews(filters)
  const reviews = data?.data || []
  const pagination = data?.pagination || { total: 0, page: 1, pages: 0 }

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Hide reviews that break the rules. Hidden reviews stay in the database and
          stop counting toward the product&apos;s rating — the customer still sees
          their own.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            update({ search: searchInput })
          }}
          className="flex max-w-sm flex-1 gap-2"
        >
          <Input
            type="search"
            placeholder="Search text or author..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" variant="outline" aria-label="Search">
            <Search className="size-4" />
          </Button>
        </form>

        <Select value={filters.status} onValueChange={(status) => update({ status })}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="approved">Live</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(filters.rating)} onValueChange={(rating) => update({ rating })}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} star{n === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Star className="mx-auto mb-4 size-10 text-muted-foreground/40" />
          <h2 className="font-semibold">No reviews found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filters.search || filters.status !== "all" || filters.rating !== "all"
              ? "Try clearing the filters."
              : "Customer reviews will appear here as they come in."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{pagination.total}</span>{" "}
            {pagination.total === 1 ? "review" : "reviews"}
          </p>
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </div>

          {pagination.pages > 1 && (
            <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                disabled={pagination.page === pagination.pages}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
