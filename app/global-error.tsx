"use client"

import { useEffect } from "react"
import "./globals.css"

// Last line of defence: catches errors thrown by the root layout itself, which
// app/error.tsx cannot — that one renders *inside* the layout. Next replaces
// the whole document here, so this file must ship its own <html>/<body>.
//
// Deliberately dependency-free: if the layout blew up, Providers never mounted,
// so there is no theme, no query client and no toaster. Anything imported from
// components/ could be the very thing that just crashed. Plain markup and
// inline styles always render.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Root layout error:", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          textAlign: "center",
          background: "#FAFBF8",
          color: "#1E293B",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.75rem", fontWeight: 800 }}>
            PetDo is temporarily unavailable
          </h1>
          <p style={{ margin: "0 0 1.5rem", color: "#64748B", lineHeight: 1.6 }}>
            Something went wrong while loading the site. Please try again in a
            moment.
          </p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: 0,
              borderRadius: "0.75rem",
              padding: "0.75rem 1.5rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#fff",
              background: "#1F6B45",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#64748B" }}>
              Reference: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
