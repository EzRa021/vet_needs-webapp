"use client"

import ProductCard from "@/components/product-card"
import { cn } from "@/lib/utils"

// Short lists side by side near the bottom of the home page — a last look
// before the footer. A list needs at least two products to be worth a column,
// and the section needs at least two columns to be worth showing.
/** @param {{ lists?: { title: string, items?: any[] }[], className?: string }} props */
export default function ProductLists({ lists = [], className = "" }) {
  const shown = (lists || []).filter((l) => l.items?.length >= 2)
  if (shown.length < 2) return null

  return (
    <div className={cn("grid gap-8 md:grid-cols-2 lg:grid-cols-3", className)}>
      {shown.map((list) => (
        <section key={list.title} aria-label={list.title} className="flex flex-col gap-3">
          <h2 className="border-b pb-2.5 font-display text-lg font-bold">{list.title}</h2>
          <ul className="flex flex-col gap-3">
            {list.items.slice(0, 3).map((item) => (
              <li key={item.id}>
                <ProductCard item={item} layout="row" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
