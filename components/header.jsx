"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ShoppingCart,
  User,
  Menu,
  LogOut,
  Package,
  ChevronDown,
  Wheat,
  Truck,
  Bird,
  Dog,
  Cat,
  Fish,
  Heart,
  LayoutDashboard,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import ThemeToggle from "@/components/theme-toggle"
import SearchAutocomplete from "@/components/search-autocomplete"
import { useUser, useLogout } from "@/stores/authStore"
import { useCartStore } from "@/stores/cartStore"
import { useWishlistIds } from "@/stores/wishlistStore"
import { useTaxonomy } from "@/stores/shopStore"
import { useIsStaff } from "@/stores/adminStore"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
]

// Departments get an icon by slug where we have a sensible one; anything the
// shop adds later still renders, just with the default mark.
const DEPARTMENT_ICONS = {
  pet: Dog,
  pets: Dog,
  feed: Wheat,
  feeds: Wheat,
  poultry: Bird,
  fish: Fish,
  cat: Cat,
  cats: Cat,
  dog: Dog,
  dogs: Dog,
}

const iconFor = (slug) => DEPARTMENT_ICONS[slug] || Wheat

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: user } = useUser()
  const logout = useLogout()
  const { data: taxonomy } = useTaxonomy()
  const { isStaff } = useIsStaff()

  // Departments are simply the roots of the category tree.
  const departments = taxonomy || []

  const cartCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  )

  // Shares the ['wishlist','ids'] query with every heart on the page, so the
  // badge updates optimistically the moment one is clicked.
  const { ids: wishlistIds } = useWishlistIds()
  const wishlistCount = wishlistIds.size

  const handleLogout = async () => {
    try {
      await logout.mutateAsync()
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const getUserInitials = () => {
    if (user?.user_metadata?.first_name && user?.user_metadata?.last_name) {
      return `${user.user_metadata.first_name[0]}${user.user_metadata.last_name[0]}`.toUpperCase()
    }
    if (user?.email) return user.email[0].toUpperCase()
    return "U"
  }

  return (
    <>
      {/* Announcement strip — feed-sack stencil label, scrolls away */}
      <div className="bg-primary text-primary-foreground">
        <div className="container flex h-9 items-center justify-center gap-2 px-4 text-center text-xs font-semibold uppercase tracking-[0.15em] md:justify-between md:px-6">
          <span className="hidden items-center gap-2 md:flex">
            <Truck className="h-3.5 w-3.5" />
            Free delivery over ₦50,000
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-earth" />
            Quality feed &amp; pet care, delivered across Nigeria
          </span>
          <Link href="/shop?search=feed" className="hidden underline-offset-4 hover:underline md:inline">
            Shop poultry feed →
          </Link>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 md:px-6">
          {/* Main row */}
          <div className="flex h-20 items-center justify-between gap-4">
            {/* Logo — grain/wheat mark */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="VetNeeds home">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm ring-2 ring-earth/40">
                <Wheat className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display text-xl font-extrabold tracking-tight">VetNeeds</span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Feed &amp; Pet Care
                </span>
              </div>
            </Link>

            {/* Search — desktop */}
            <SearchAutocomplete
              className="hidden flex-1 md:block md:max-w-xl"
              inputClassName="border-border/70 bg-secondary/60 focus:bg-background"
            />

            {/* Right icons */}
            <div className="flex items-center gap-1.5">
              <ThemeToggle className="hidden sm:inline-flex" />
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full">
                      <Avatar className="h-9 w-9">
                        {/* Only render an image when there actually is one — a
                            placeholder src loads fine and would paint a blank
                            grey disc over the initials, which only show when
                            the image fails. */}
                        {user.user_metadata?.avatar_url ? (
                          <AvatarImage src={user.user_metadata.avatar_url} alt="" />
                        ) : null}
                        <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold">
                          {user.user_metadata?.first_name
                            ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`
                            : "My Account"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isStaff && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="cursor-pointer font-medium text-primary">
                            <LayoutDashboard className="mr-2 h-4 w-4" /> Admin dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/account/orders" className="cursor-pointer">
                        <Package className="mr-2 h-4 w-4" /> My Orders
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/account/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" /> Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      disabled={logout.isPending}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {logout.isPending ? "Logging out..." : "Log out"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="sm" asChild className="h-11 rounded-full">
                  <Link href="/login" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign In</span>
                  </Link>
                </Button>
              )}

              {/* Signed-out visitors have no wishlist to link to, so the icon
                  would only lead to a login redirect. */}
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="group relative hidden h-11 w-11 shrink-0 rounded-full sm:inline-flex"
                  asChild
                >
                  <Link
                    href="/account/wishlist"
                    aria-label={`Wishlist, ${wishlistCount} ${wishlistCount === 1 ? "item" : "items"}`}
                  >
                    <Heart className="h-5 w-5 transition-transform group-hover:scale-110" />
                    {wishlistCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground shadow">
                        {wishlistCount > 99 ? "99+" : wishlistCount}
                      </span>
                    )}
                  </Link>
                </Button>
              )}

              <Button variant="ghost" size="icon" className="group relative h-11 w-11 shrink-0 rounded-full" asChild>
                <Link href="/cart" aria-label={`Cart, ${cartCount} items`}>
                  <ShoppingCart className="h-5 w-5 transition-transform group-hover:scale-110" />
                  {cartCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-earth px-1 text-[11px] font-bold text-earth-foreground shadow">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </Link>
              </Button>

              {/* Mobile menu */}
              {/* Controlled so picking a search suggestion can close the drawer
                  — otherwise it stays open over the page you just navigated to. */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                {/* overflow-y-auto: the sheet primitive is `fixed h-full` with
                    no overflow rule, so a long department list was clipped at
                    the viewport edge with no way to reach it. overscroll-contain
                    stops the scroll chaining to the page underneath. */}
                <SheetContent
                  side="left"
                  className="flex w-80 max-w-[85vw] flex-col overflow-y-auto overscroll-contain"
                >
                  <div className="mt-8 flex flex-col gap-6 pb-8">
                    {/* No Search button here — the drawer is narrow, and picking
                        a suggestion is the point on mobile. onNavigate closes
                        the drawer, which a plain router.push wouldn't. */}
                    <SearchAutocomplete
                      placeholder="Search products…"
                      showButton={false}
                      inputClassName="h-11 bg-secondary/60"
                      onNavigate={() => setMobileOpen(false)}
                    />

                    {/* Departments */}
                    {departments.length > 0 && (
                      <div>
                        <p className="eyebrow mb-3">Shop by department</p>
                        <div className="grid grid-cols-2 gap-2">
                          {departments.map((dept) => {
                            const Icon = iconFor(dept.slug)
                            return (
                              <Link
                                key={dept.id}
                                href={`/shop/category/${dept.id}`}
                                className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
                              >
                                <Icon className="h-4 w-4 text-primary" />
                                {dept.name}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <nav className="flex flex-col gap-1 border-t pt-4">
                      {NAV_LINKS.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
                        >
                          {link.label}
                        </Link>
                      ))}
                      {isStaff && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Admin dashboard
                        </Link>
                      )}
                    </nav>

                    {departments.some((d) => d.children?.length > 0) && (
                      <div className="flex flex-col gap-4 border-t pt-4">
                        {departments
                          .filter((d) => d.children?.length > 0)
                          .map((dept) => (
                            <div key={dept.id}>
                              <p className="eyebrow mb-2">{dept.name}</p>
                              <div className="flex flex-col gap-1 pl-1">
                                {dept.children.map((cat) => (
                                  <Link
                                    key={cat.id}
                                    href={`/shop/category/${cat.id}`}
                                    className="py-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                                  >
                                    {cat.name}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* The header's toggle is hidden below sm, so on phones the
                        drawer is the only way to reach it. */}
                    <div className="flex items-center justify-between border-t pt-4">
                      <span className="text-sm font-medium">Theme</span>
                      <ThemeToggle />
                    </div>

                    {user && (
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 border-t pt-4 text-sm text-destructive"
                      >
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Shelf nav — desktop */}
          <nav className="hidden h-12 items-center gap-1 border-t border-border/60 lg:flex">
            {NAV_LINKS.slice(0, 2).map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary hover:text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}

            {/* Mega-menu: departments as columns, their categories beneath */}
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-secondary hover:text-primary">
                Categories
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-auto min-w-[520px] p-4">
                {departments.length === 0 ? (
                  <DropdownMenuItem disabled>No categories available</DropdownMenuItem>
                ) : (
                  <div className="grid grid-cols-2 gap-6">
                    {departments.map((dept) => {
                      const Icon = iconFor(dept.slug)
                      return (
                        <div key={dept.id} className="flex flex-col gap-2">
                          <Link
                            href={`/shop/category/${dept.id}`}
                            className="flex items-center gap-2 border-b pb-2 text-sm font-bold hover:text-primary"
                          >
                            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            {dept.name}
                          </Link>
                          {dept.children?.length > 0 ? (
                            <ul className="flex flex-col">
                              {dept.children.map((cat) => (
                                <li key={cat.id}>
                                  <Link
                                    href={`/shop/category/${cat.id}`}
                                    className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                                  >
                                    {cat.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="px-2 text-xs text-muted-foreground">
                              Nothing in here yet
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {NAV_LINKS.slice(2).map((link) => {
              const active = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary hover:text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}

            {/* Department quick-links — driven by the category tree, so a new
                department added in the admin appears here automatically. */}
            <div className="ml-auto flex items-center gap-1">
              {departments.map((dept) => {
                const Icon = iconFor(dept.slug)
                const active = pathname === `/shop/category/${dept.id}`
                return (
                  <Link
                    key={dept.id}
                    href={`/shop/category/${dept.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {dept.name}
                  </Link>
                )
              })}
            </div>
          </nav>
        </div>
      </header>
    </>
  )
}
