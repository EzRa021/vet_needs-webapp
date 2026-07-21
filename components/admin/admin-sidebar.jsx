"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Wheat, LogOut, Store, ChevronUp, Sun, Moon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ADMIN_NAV, canSee } from "@/components/admin/admin-nav"
import { useProfile, useUnreadMessageCount } from "@/stores/adminStore"
import { useLogout } from "@/stores/authStore"

const THEME_LABEL = { light: "Light", dark: "Dark", system: "System" }
const THEME_CYCLE = ["light", "dark", "system"]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { data: profile } = useProfile()
  const logout = useLogout()
  const role = profile?.role
  const { data: unreadMessages = 0 } = useUnreadMessageCount()

  // The sidebar is collapsible to icons, so a dropdown is awkward here —
  // clicking cycles light → dark → system instead.
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const cycleTheme = () =>
    setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length])

  const initials =
    profile?.full_name?.trim()?.split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase() ||
    profile?.email?.[0]?.toUpperCase() ||
    "A"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Wheat />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-display font-bold">VetNeeds</span>
                  <span className="text-xs text-muted-foreground">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {ADMIN_NAV.map((group) => {
          const visible = group.items.filter((item) => canSee(item, role))
          if (visible.length === 0) return null
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild={item.ready}
                          isActive={active}
                          tooltip={item.title}
                          aria-disabled={!item.ready}
                          className={!item.ready ? "cursor-not-allowed opacity-50" : undefined}
                        >
                          {item.ready ? (
                            <Link href={item.href}>
                              <item.icon />
                              <span>{item.title}</span>
                            </Link>
                          ) : (
                            <div>
                              <item.icon />
                              <span>{item.title}</span>
                            </div>
                          )}
                        </SidebarMenuButton>
                        {!item.ready && <SidebarMenuBadge>Soon</SidebarMenuBadge>}
                        {/* Unread messages. Only rendered when there are any —
                            a permanent "0" trains people to ignore the spot. */}
                        {item.badge === "messages" && unreadMessages > 0 && (
                          <SidebarMenuBadge className="bg-primary text-primary-foreground">
                            {unreadMessages > 99 ? "99+" : unreadMessages}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={cycleTheme} tooltip="Change theme">
              {mounted && resolvedTheme === "dark" ? <Moon /> : <Sun />}
              <span>{mounted ? THEME_LABEL[theme] || "Theme" : "Theme"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View storefront">
              <Link href="/">
                <Store />
                <span>View store</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                    <span className="truncate font-medium">
                      {profile?.full_name || "Account"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {profile?.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <Badge variant="secondary" className="capitalize">{role || "—"}</Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account/orders">My orders</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout.mutate()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
