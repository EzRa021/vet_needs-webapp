"use client"

import { useState } from "react"
import { MapPin, Plus, Pencil, Trash2, Check, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import AddressForm from "@/components/address-form"
import {
  useAddresses,
  useDeleteAddress,
  useSetDefaultAddress,
} from "@/stores/addressStore"

function AddressCard({ address, onEdit }) {
  const { toast } = useToast()
  const remove = useDeleteAddress()
  const setDefault = useSetDefaultAddress()

  return (
    <Card className={address.is_default ? "border-primary/40" : undefined}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">
                {address.label || `${address.first_name} ${address.last_name}`}
              </h3>
              {address.is_default && (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Check className="size-3" />
                  Default
                </Badge>
              )}
            </div>
            {address.label && (
              <p className="text-sm text-muted-foreground">
                {address.first_name} {address.last_name}
              </p>
            )}
          </div>
        </div>

        <address className="space-y-0.5 text-sm not-italic text-muted-foreground">
          <p>{address.address}</p>
          {address.address2 && <p>{address.address2}</p>}
          <p>
            {address.city}, {address.state}
            {address.zip ? ` ${address.zip}` : ""}
          </p>
          <p>{address.phone}</p>
        </address>

        <div className="flex flex-wrap gap-1 pt-1">
          {!address.is_default && (
            <Button
              variant="ghost"
              size="sm"
              disabled={setDefault.isPending}
              onClick={() =>
                setDefault.mutate(address.id, {
                  onSuccess: () => toast({ title: "Default address updated" }),
                  onError: () =>
                    toast({ title: "Couldn't set the default", variant: "destructive" }),
                })
              }
            >
              Set as default
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this address?</AlertDialogTitle>
                <AlertDialogDescription>
                  Orders you&apos;ve already placed keep the address they were
                  delivered to — this only removes it from your address book.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    remove.mutate(address.id, {
                      onSuccess: () => toast({ title: "Address deleted" }),
                      onError: () =>
                        toast({ title: "Couldn't delete the address", variant: "destructive" }),
                    })
                  }
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AddressesPage() {
  const { data: addresses, isLoading, isError } = useAddresses()
  const [editing, setEditing] = useState(null) // address object, or 'new'

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-52 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-lg">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not load your addresses</AlertTitle>
        <AlertDescription>Please refresh the page or try again in a moment.</AlertDescription>
      </Alert>
    )
  }

  const list = addresses || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {list.length === 0
            ? "Save an address to check out faster next time."
            : `${list.length} saved ${list.length === 1 ? "address" : "addresses"}`}
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Add address
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-20 text-center">
          <MapPin className="mx-auto mb-4 size-12 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">No saved addresses</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Add one and it will be selected automatically at checkout, so you
            won&apos;t have to type it out again.
          </p>
          <Button className="mt-6" onClick={() => setEditing("new")}>
            Add your first address
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => setEditing(address)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "Add an address" : "Edit address"}
            </DialogTitle>
            <DialogDescription>
              Used for delivery. We&apos;ll email you at your account address.
            </DialogDescription>
          </DialogHeader>
          {/* Remount per target so the form's initial state is never stale. */}
          {editing && (
            <AddressForm
              key={editing === "new" ? "new" : editing.id}
              existing={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
