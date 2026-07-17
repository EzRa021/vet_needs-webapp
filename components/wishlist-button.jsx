"use client"

import { usePathname, useRouter } from "next/navigation"
import { Heart } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useUser } from "@/stores/authStore"
import { useWishlistIds, useToggleWishlist } from "@/stores/wishlistStore"

// The save-for-later heart. Shared by ProductCard and the product page so the
// saved state can't disagree between them.
export default function WishlistButton({
  itemId,
  itemName,
  className,
  showLabel = false,
  // Card overlays hide the heart until hover to keep the grid calm. A SAVED
  // heart must stay visible regardless, or the customer can't tell what they
  // already saved while scrolling — and it would vanish the moment they
  // clicked it.
  revealOnHover = false,
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const { data: user } = useUser()
  const { ids } = useWishlistIds()
  const toggle = useToggleWishlist()

  const saved = ids.has(itemId)

  const handleClick = (e) => {
    // The card wraps this button in a <Link> to the product, so a bare click
    // would navigate away instead of saving.
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      // The wishlist is per-account, so there is nowhere to put this yet. Send
      // them to sign in and back to the page they were on.
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      toast({
        title: "Sign in to save items",
        description: "Your wishlist is saved to your account.",
      })
      return
    }

    toggle.mutate(
      { itemId, saved },
      {
        onSuccess: (result) => {
          toast({
            title: result.saved ? "Saved to wishlist" : "Removed from wishlist",
            description: itemName,
          })
        },
        onError: () => {
          toast({
            title: "Couldn't update your wishlist",
            description: "Please try again.",
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${itemName} from wishlist` : `Save ${itemName} to wishlist`}
      className={cn(
        "flex items-center justify-center gap-2 transition-all duration-200",
        saved ? "text-primary" : "text-muted-foreground hover:text-primary",
        revealOnHover &&
          !saved &&
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        className
      )}
    >
      <Heart className={cn("h-4 w-4 transition-transform", saved && "fill-current scale-110")} />
      {showLabel && (
        <span className="text-sm font-medium">{saved ? "Saved" : "Save for later"}</span>
      )}
    </button>
  )
}
