"use client"

import { MessageCircle } from "lucide-react"

import { useStoreSettings } from "@/stores/shopStore"
import { useHydrated } from "@/hooks/use-hydrated"
import { realPhoneDigits } from "@/lib/delivery"

// Floating "chat on WhatsApp" button, bottom right of the storefront.
//
// The number is the shop's support phone (Admin → Settings). No number set →
// no button: a chat button that opens nobody is worse than none.
export default function WhatsappFab() {
  const { settings } = useStoreSettings()
  // Settings are shared with the header and can be cached before this
  // hydrates; the server never has them. Same first render as the server.
  const hydrated = useHydrated()
  const digits = realPhoneDigits(settings?.support_phone)
  if (!hydrated || !digits) return null

  const href = `https://wa.me/${digits}?text=${encodeURIComponent("Hi Jvigor, I have a question about")}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 print:hidden"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  )
}
