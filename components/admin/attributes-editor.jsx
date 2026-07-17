"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Keys already in use across the catalogue. Offered as suggestions because a
// facet only appears when 2+ products share a key AND a value — so "bag_size"
// and "bagsize" are two dead facets instead of one useful one. The whole
// feature quietly depends on staff spelling things the same way twice.
const COMMON_KEYS = [
  "bag_size",
  "life_stage",
  "animal",
  "flavour",
  "material",
  "size",
  "type",
  "stage",
  "volume",
]

const toKey = (s) =>
  s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "").slice(0, 40)

export function AttributesEditor({ value, onChange }) {
  const rows = Object.entries(value || {})
  const [key, setKey] = useState("")
  const [val, setVal] = useState("")

  const add = () => {
    const k = toKey(key)
    const v = val.trim()
    if (!k || !v) return
    onChange({ ...(value || {}), [k]: v })
    setKey("")
    setVal("")
  }

  const remove = (k) => {
    const next = { ...(value || {}) }
    delete next[k]
    onChange(next)
  }

  const unused = COMMON_KEYS.filter((k) => !(k in (value || {})))

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="space-y-1.5 rounded-lg border p-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span className="w-32 shrink-0 truncate font-mono text-xs text-muted-foreground">
                {k}
              </span>
              <Input
                value={v}
                className="h-8"
                onChange={(e) => onChange({ ...(value || {}), [k]: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(k)}
                aria-label={`Remove ${k}`}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={key}
          placeholder="bag_size"
          className="h-9 w-36 font-mono text-xs"
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <Input
          value={val}
          placeholder="25kg"
          className="h-9 flex-1"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <Button type="button" variant="outline" size="icon" className="size-9" onClick={add}>
          <Plus className="size-4" />
        </Button>
      </div>

      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">Common:</span>
          {unused.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKey(k)}
              className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TagsInput({ value, onChange }) {
  const tags = value || []
  const [draft, setDraft] = useState("")

  const add = (raw) => {
    // Comma-separated paste is the natural way people type these.
    const next = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    if (next.length === 0) return
    onChange([...new Set([...tags, ...next])].slice(0, 30))
    setDraft("")
  }

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 pr-1">
              {t}
              <button
                type="button"
                onClick={() => onChange(tags.filter((x) => x !== t))}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`Remove ${t}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={draft}
        placeholder="feed, layer, poultry — comma or Enter"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            add(draft)
          }
          // Backspace on an empty box removes the last tag — standard, and the
          // only way to fix a typo without reaching for the mouse.
          if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={() => draft && add(draft)}
      />
    </div>
  )
}
