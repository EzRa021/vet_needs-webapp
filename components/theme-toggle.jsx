"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun, Monitor } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export default function ThemeToggle({ className }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // The server can't know the visitor's theme, so rendering the real icon
  // before mount would hydrate mismatched. Render a stable placeholder first.
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-11 w-11 rounded-full", className)}
        aria-label="Change theme"
        disabled
      >
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  const Icon = resolvedTheme === "dark" ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-11 w-11 rounded-full", className)}
          aria-label={`Change theme (currently ${theme})`}
        >
          <Icon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn("cursor-pointer", theme === opt.value && "text-primary")}
            >
              <opt.icon />
              {opt.label}
              {theme === opt.value && <span className="ml-auto text-xs">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
