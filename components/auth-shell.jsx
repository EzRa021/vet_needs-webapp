"use client"

import Link from "next/link"
import { Wheat, ShieldCheck, Truck, Leaf } from "lucide-react"

import BrandImage from "@/components/brand-image"

// Split-screen auth layout: brand panel (desktop) + form column.
// Used by login, register, forgot-password and reset-password.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-[calc(100vh-5rem)] lg:grid-cols-2">
      {/* Brand panel — hidden on mobile */}
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <BrandImage
          src="/images/trust-vet-with-dog.jpg"
          alt="Caring for healthy animals"
          fill
          className="object-cover opacity-25"
          sizes="50vw"
          placeholderLabel=""
          icon={Leaf}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 to-primary/70" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
              <Wheat className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold">PetDo</span>
          </Link>

          <div className="space-y-6">
            <h2 className="font-display text-3xl font-bold leading-tight">
              Quality feed &amp; pet care, delivered across Nigeria.
            </h2>
            <ul className="space-y-3 text-primary-foreground/90">
              <li className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                Secure Paystack checkout
              </li>
              <li className="flex items-center gap-3">
                <Truck className="h-5 w-5 shrink-0" />
                Fast nationwide delivery
              </li>
              <li className="flex items-center gap-3">
                <Leaf className="h-5 w-5 shrink-0" />
                Farm-fresh, vet-approved products
              </li>
            </ul>
          </div>

          <p className="text-sm text-primary-foreground/70">
            Trusted by farmers &amp; pet owners nationwide.
          </p>
        </div>
      </div>

      {/* Form column */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          {/* Mobile brand mark */}
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wheat className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold">PetDo</span>
          </Link>

          <div className="mb-6 text-center lg:text-left">
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
          </div>

          {children}

          {footer && (
            <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
          )}
        </div>
      </div>
    </div>
  )
}
