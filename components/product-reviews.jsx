"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BadgeCheck, MessageSquare, Pencil, Trash2, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { StarRating, StarRatingInput } from "@/components/star-rating"
import { useUser } from "@/stores/authStore"
import {
  useItemReviews,
  useMyReview,
  useSaveReview,
  useDeleteReview,
  ratingSummary,
} from "@/stores/reviewStore"

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

function Histogram({ summary }) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => (
        <div key={star} className="flex items-center gap-2 text-sm">
          <span className="w-3 tabular-nums text-muted-foreground">{star}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-earth transition-all"
              style={{ width: `${summary.percent[star]}%` }}
            />
          </div>
          <span className="w-8 text-right tabular-nums text-muted-foreground">
            {summary.counts[star]}
          </span>
        </div>
      ))}
    </div>
  )
}

function ReviewForm({ itemId, existing, onDone }) {
  const { toast } = useToast()
  const save = useSaveReview(itemId)
  const [rating, setRating] = useState(existing?.rating || 0)
  const [title, setTitle] = useState(existing?.title || "")
  const [comment, setComment] = useState(existing?.comment || "")

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!rating) {
      toast({
        title: "Pick a rating",
        description: "Choose between 1 and 5 stars.",
        variant: "destructive",
      })
      return
    }

    save.mutate(
      { id: existing?.id, rating, title, comment },
      {
        onSuccess: () => {
          toast({
            title: existing ? "Review updated" : "Thanks for your review!",
            description: "It's now live on this product.",
          })
          onDone?.()
        },
        onError: (err) => {
          toast({
            title: "Couldn't save your review",
            // 23505 = the unique (item_id, user_id) index. Shouldn't happen —
            // the UI switches to edit mode — but say something true if it does.
            description:
              err?.code === "23505"
                ? "You've already reviewed this product."
                : "Please try again.",
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="space-y-2">
        <Label>Your rating</Label>
        <StarRatingInput value={rating} onChange={setRating} disabled={save.isPending} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input
          id="review-title"
          value={title}
          maxLength={120}
          placeholder="Sum it up in a few words"
          onChange={(e) => setTitle(e.target.value)}
          disabled={save.isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-comment">Your review (optional)</Label>
        <Textarea
          id="review-comment"
          value={comment}
          maxLength={2000}
          placeholder="How did it work out for your animals?"
          className="min-h-[110px]"
          onChange={(e) => setComment(e.target.value)}
          disabled={save.isPending}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving..." : existing ? "Update review" : "Post review"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={save.isPending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

function ReviewCard({ review, isMine, itemId, onEdit }) {
  const { toast } = useToast()
  const remove = useDeleteReview(itemId)

  return (
    <article className="space-y-2 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <StarRating value={review.rating} size="sm" />
        {review.title && <h4 className="font-semibold">{review.title}</h4>}
        {review.is_verified_purchase && (
          <Badge variant="secondary" className="gap-1 font-normal">
            <BadgeCheck className="size-3.5 text-success" />
            Verified purchase
          </Badge>
        )}
        {/* Only ever visible to the author — RLS hides unapproved reviews from
            everyone else, so this can't leak a moderation decision. */}
        {isMine && !review.is_approved && (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Hidden by staff
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {review.author_name || "VetNeeds customer"}
        </span>
        {isMine && " (you)"} · {formatDate(review.created_at)}
      </p>

      {review.comment && (
        <p className="whitespace-pre-line text-sm leading-relaxed">{review.comment}</p>
      )}

      {isMine && (
        <div className="flex gap-1 pt-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your review?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can&apos;t be undone. The product&apos;s rating will be
                  recalculated without it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    remove.mutate(review.id, {
                      onSuccess: () => toast({ title: "Review deleted" }),
                      onError: () =>
                        toast({
                          title: "Couldn't delete your review",
                          variant: "destructive",
                        }),
                    })
                  }
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </article>
  )
}

export default function ProductReviews({ itemId, itemName }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: user } = useUser()
  const { data: reviews, isLoading, isError } = useItemReviews(itemId)
  const myReview = useMyReview(itemId)
  const [editing, setEditing] = useState(false)

  if (isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-24 w-full" />
      </section>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Couldn&apos;t load reviews</AlertTitle>
        <AlertDescription>Please refresh the page to try again.</AlertDescription>
      </Alert>
    )
  }

  const summary = ratingSummary(reviews)
  // RLS returns the author their own unapproved review; nobody else sees it.
  // While editing, the review is already in the form above — listing it again
  // below would show the same review twice.
  const visible = (reviews || []).filter(
    (r) => (r.is_approved || r.id === myReview?.id) && !(editing && r.id === myReview?.id)
  )

  return (
    <section id="reviews" className="scroll-mt-24">
      <h2 className="mb-6 font-display text-2xl font-bold">
        Reviews {summary.total > 0 && <span className="text-muted-foreground">({summary.total})</span>}
      </h2>

      {summary.total > 0 && (
        <div className="mb-8 grid gap-6 rounded-2xl border bg-card p-5 sm:grid-cols-[auto_1fr] sm:gap-10">
          <div className="text-center">
            <p className="font-display text-4xl font-bold tabular-nums">
              {summary.average.toFixed(1)}
            </p>
            <StarRating value={summary.average} className="mt-1 justify-center" />
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.total} {summary.total === 1 ? "review" : "reviews"}
            </p>
          </div>
          <Histogram summary={summary} />
        </div>
      )}

      {/* Write / edit */}
      {!user ? (
        <div className="mb-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed p-6 text-center">
          <MessageSquare className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Sign in to review {itemName}.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push(`/login?redirect=${encodeURIComponent(pathname)}`)}
          >
            Sign in
          </Button>
        </div>
      ) : editing || !myReview ? (
        <div className="mb-8">
          <ReviewForm
            itemId={itemId}
            existing={editing ? myReview : null}
            onDone={editing ? () => setEditing(false) : undefined}
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No reviews yet — be the first to review {itemName}.
        </p>
      ) : (
        <div className="divide-y">
          {visible.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              itemId={itemId}
              isMine={review.user_id === user?.id}
              onEdit={() => setEditing(true)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
