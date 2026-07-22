import Image from "next/image"

import { cn } from "@/lib/utils"

// The VetNeeds mark, in one place so the header, footer, auth screens and admin
// sidebar can't drift apart.
//
// public/logo.png is a full-bleed square — opaque, with its own dark green
// field right out to the corners — so it replaces the tinted tile these marks
// used to draw around a lucide icon rather than sitting inside it. Nesting it
// in the old bg-primary tile would stack green on green.
//
// alt is empty by default because every current usage sits inside a link that
// is already labelled ("VetNeeds home") and next to the VetNeeds wordmark;
// giving the image its own text would make a screen reader say the brand three
// times. Pass an alt explicitly where the logo stands alone.
export default function BrandLogo({
  size = 44,
  className,
  alt = "",
  priority = false,
}) {
  return (
    <Image
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      // Fixed intrinsic size, so next/image emits a 2x srcset and the mark
      // stays crisp on a retina screen without shipping the full 694px source.
      className={cn("shrink-0 rounded-2xl object-cover", className)}
    />
  )
}
