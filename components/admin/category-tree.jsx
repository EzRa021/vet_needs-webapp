"use client"

import { useState } from "react"
import {
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  EyeOff,
  FolderTree,
  Folder,
  ArrowUp,
  ArrowDown,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

function TreeNode({ node, depth, siblings, index, onAddChild, onEdit, onDelete, onMove }) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = node.children?.length > 0
  const isDepartment = depth === 0

  // Reordering is arrows, not drag-and-drop. A tree with collapsible nodes and
  // nesting needs drop-zones for "before/after/inside", which is a real library
  // and a real chunk of a11y work — and it's the one interaction that's hostile
  // on a phone. Arrows are unglamorous, keyboard-native, and work today.
  const canUp = index > 0
  const canDown = index < siblings.length - 1

  return (
    <div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "group flex items-center gap-2 rounded-lg border border-transparent py-2 pr-2 transition-colors hover:border-border hover:bg-accent/50",
            !node.is_active && "opacity-60"
          )}
          style={{ paddingLeft: `${depth * 20 + 4}px` }}
        >
          {/* Expander */}
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6 shrink-0">
                <ChevronRight
                  className={cn("transition-transform", open && "rotate-90")}
                />
                <span className="sr-only">Toggle {node.name}</span>
              </Button>
            </CollapsibleTrigger>
          ) : (
            <span className="size-6 shrink-0" />
          )}

          {/* Icon */}
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              isDepartment ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {isDepartment ? (
              <FolderTree className="size-4" />
            ) : (
              <Folder className="size-4" />
            )}
          </span>

          {/* Name + meta */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className={cn("truncate", isDepartment ? "font-semibold" : "font-medium")}>
              {node.name}
            </span>
            {isDepartment && (
              <Badge variant="outline" className="shrink-0">Department</Badge>
            )}
            {!node.is_active && (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <EyeOff className="size-3" />
                Hidden
              </Badge>
            )}
            {node.productCount > 0 && (
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {node.productCount}
              </Badge>
            )}
            <code className="hidden truncate text-xs text-muted-foreground lg:inline">
              /{node.path}
            </code>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <div className="flex">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!canUp}
                onClick={() => onMove(node, siblings, index, -1)}
                aria-label={`Move ${node.name} up`}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!canDown}
                onClick={() => onMove(node, siblings, index, 1)}
                aria-label={`Move ${node.name} down`}
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddChild(node)}
            >
              <Plus data-icon="inline-start" />
              Add
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal />
                  <span className="sr-only">Actions for {node.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => onEdit(node)}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAddChild(node)}>
                    <Plus />
                    Add sub-category
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(node)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {hasChildren && (
          <CollapsibleContent>
            {node.children.map((child, i) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                siblings={node.children}
                index={i}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  )
}

export default function CategoryTree({ tree, onAddChild, onEdit, onDelete, onMove }) {
  return (
    <div className="flex flex-col">
      {tree.map((node, i) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          // Reordering only makes sense among SIBLINGS — moving a node past its
          // parent isn't a reorder, it's a re-parent, which the edit page does.
          siblings={tree}
          index={i}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </div>
  )
}
