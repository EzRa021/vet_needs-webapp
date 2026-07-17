"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  TriangleAlert,
  Mail,
  Phone,
  ShoppingBag,
  Banknote,
  Receipt,
  MailWarning,
  MailCheck,
  ShieldAlert,
  Clock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAdminCustomer, useUpdateCustomerRole } from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"
import { statusMeta } from "@/lib/order-status"
import { ROLE_META, ROLE_HELP, roleMeta, initialsFor } from "@/lib/roles"

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="px-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            {label}
          </CardDescription>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5 px-4">
        <span className="font-display text-xl font-bold tabular-nums leading-none">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const { data: customer, isLoading, isError, error } = useAdminCustomer(id)
  const updateRole = useUpdateCustomerRole()
  const [pendingRole, setPendingRole] = useState(null)

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !customer) {
    const forbidden = String(error?.message || "").includes("Forbidden")
    return (
      <Alert variant="destructive" className="max-w-lg">
        <TriangleAlert />
        <AlertTitle>{forbidden ? "Admin access required" : "Customer not found"}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          {forbidden ? "Only administrators can view customer records." : "This account may have been deleted."}
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/customers">Back to customers</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const meta = roleMeta(customer.role)
  const name = customer.full_name || "Unnamed"
  const initials = initialsFor(customer.full_name, customer.email)

  const confirmRoleChange = async () => {
    if (!pendingRole) return
    try {
      await updateRole.mutateAsync({ id: customer.id, role: pendingRole })
      toast({
        title: "Role updated",
        description: `${name} is now ${ROLE_META[pendingRole].label.toLowerCase()}.`,
      })
    } catch (err) {
      toast({ title: "Couldn't change role", description: err.message, variant: "destructive" })
    } finally {
      setPendingRole(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
          <Link href="/admin/customers">
            <ArrowLeft data-icon="inline-start" />
            Back to customers
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar className="size-11">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold">{name}</h1>
              <Badge variant={meta.variant}>{meta.label}</Badge>
              {customer.isSelf && <Badge variant="outline">You</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Joined{" "}
              {new Date(customer.created_at).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {customer.emailConfirmed === false && (
        <Alert>
          <MailWarning />
          <AlertTitle>Email not confirmed</AlertTitle>
          <AlertDescription>
            This account can&apos;t sign in until the confirmation link is clicked.
            They can request a new one from the sign-in page.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Banknote}
          label="Lifetime spend"
          value={formatNaira(customer.stats.lifetimeSpend)}
          sub="Paid orders only"
        />
        <Stat
          icon={ShoppingBag}
          label="Orders"
          value={customer.stats.orderCount}
          sub={`${customer.stats.paidCount} paid`}
        />
        <Stat
          icon={Receipt}
          label="Avg order"
          value={formatNaira(customer.stats.avgOrderValue)}
          sub="Across paid orders"
        />
        <Stat
          icon={Clock}
          label="Last seen"
          value={
            customer.lastSignIn
              ? new Date(customer.lastSignIn).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                })
              : "—"
          }
          sub={customer.lastSignIn ? "Last sign-in" : "Never signed in"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Orders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Order history</CardTitle>
            <CardDescription>Most recent first (up to 50).</CardDescription>
          </CardHeader>
          <CardContent className={customer.orders.length ? "p-0" : undefined}>
            {customer.orders.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingBag />
                  </EmptyMedia>
                  <EmptyTitle>No orders yet</EmptyTitle>
                  <EmptyDescription>
                    This customer hasn&apos;t placed an order.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.orders.map((o) => {
                      const s = statusMeta(o.status)
                      return (
                        <TableRow key={o.id}>
                          <TableCell>
                            <Link
                              href={`/admin/orders/${o.id}`}
                              className="font-medium tabular-nums hover:text-primary hover:underline"
                            >
                              #{o.id.slice(0, 8).toUpperCase()}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.variant}>{s.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNaira(o.total_amount)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2">
                {customer.emailConfirmed ? (
                  <MailCheck className="size-4 shrink-0 text-success" />
                ) : (
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{customer.email || "No email on file"}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span>{customer.phone || "No phone on file"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Access</CardTitle>
              <CardDescription>What this account can do.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="role">Role</FieldLabel>
                <Select
                  value={customer.role}
                  onValueChange={(v) => v !== customer.role && setPendingRole(v)}
                  disabled={customer.isSelf}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(ROLE_META).map(([value, m]) => (
                        <SelectItem key={value} value={value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{ROLE_HELP[customer.role]}</FieldDescription>
              </Field>

              {customer.isSelf && (
                <Alert className="mt-3">
                  <ShieldAlert />
                  <AlertDescription>
                    You can&apos;t change your own role — ask another admin, so you&apos;re
                    never locked out by accident.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={Boolean(pendingRole)} onOpenChange={(o) => !o && setPendingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make {name} {pendingRole && ROLE_META[pendingRole].label.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole && ROLE_HELP[pendingRole]}
              {pendingRole === "admin" &&
                " This gives full access to customer data, roles and settings."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={updateRole.isPending}>
              {updateRole.isPending && <Spinner data-icon="inline-start" />}
              Change role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
