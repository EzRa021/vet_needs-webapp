"use client"

import { usePathname } from "next/navigation"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldAlert } from "lucide-react"
import AdminSidebar from "@/components/admin/admin-sidebar"
import { findNavTitle, findNavTrail } from "@/components/admin/admin-nav"
import { useIsStaff } from "@/stores/adminStore"

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const { isStaff, isLoading } = useIsStaff()
  const title = findNavTitle(pathname)
  const trail = findNavTrail(pathname)

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Middleware already redirects non-staff; this is the in-app backstop.
  if (!isStaff) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert />
          <AlertTitle>Admin access required</AlertTitle>
          <AlertDescription>
            Your account doesn&apos;t have permission to view this area. Ask an
            administrator to grant you staff access.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
              </BreadcrumbItem>

              {trail.length > 0 ? (
                trail.map((crumb, i) => (
                  <span key={crumb.title} className="contents">
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      {crumb.href && i < trail.length - 1 ? (
                        <BreadcrumbLink href={crumb.href}>{crumb.title}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))
              ) : title !== "Dashboard" ? (
                <>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        {/* Dashboard density (8/10): tighter rhythm than the storefront */}
        <div className="flex flex-1 flex-col gap-4 bg-muted/30 p-4 md:p-5">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
