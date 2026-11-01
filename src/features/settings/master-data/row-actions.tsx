"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontalIcon, PencilIcon, PowerIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EntityFormDialog } from "./entity-form-dialog";
import { deleteMasterRecordAction, setMasterRecordActiveAction } from "./actions";
import { MASTER_ENTITIES, type DynamicOptions, type MasterEntityKey } from "./entities";

interface RowActionsProps {
  entityKey: MasterEntityKey;
  record: Record<string, unknown> & { id: string; name: string; is_active: boolean };
  canManage: boolean;
  canDelete: boolean;
  /** Render as full buttons (detail page) instead of a compact menu */
  expanded?: boolean;
  dynamicOptions?: DynamicOptions;
}

export function MasterRowActions({
  entityKey,
  record,
  canManage,
  canDelete,
  expanded,
  dynamicOptions,
}: RowActionsProps) {
  const entity = MASTER_ENTITIES[entityKey];
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!canManage) return null;

  async function toggleActive() {
    const result = await setMasterRecordActiveAction(entityKey, record.id, !record.is_active);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`${entity.singular} ${record.is_active ? "deactivated" : "activated"}`);
    router.refresh();
  }

  async function remove() {
    const result = await deleteMasterRecordAction(entityKey, record.id);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`${entity.singular} deleted`);
    router.push(entity.basePath);
    router.refresh();
  }

  const editProps = { entityKey, record, dynamicOptions, onSaved: () => router.refresh() } as const;
  const toggleProps = {
    title: record.is_active ? `Deactivate ${record.name}?` : `Activate ${record.name}?`,
    description: record.is_active
      ? "Inactive records are hidden from new transactions but kept for history."
      : "The record will be available for new transactions again.",
    confirmLabel: record.is_active ? "Deactivate" : "Activate",
    onConfirm: toggleActive,
    testId: "toggle-active-dialog",
  } as const;
  const deleteProps = {
    title: `Delete ${record.name}?`,
    description:
      "This permanently removes the record. It will be refused if any transaction references it — deactivate instead to keep history.",
    confirmLabel: "Delete",
    destructive: true,
    onConfirm: remove,
    testId: "delete-dialog",
  } as const;

  if (expanded) {
    return (
      <div className="flex flex-wrap gap-2">
        <EntityFormDialog
          {...editProps}
          trigger={
            <Button variant="outline" size="sm" data-testid="edit-button">
              <PencilIcon /> Edit
            </Button>
          }
        />
        <ConfirmDialog
          {...toggleProps}
          trigger={
            <Button variant="outline" size="sm" data-testid="toggle-active-button">
              <PowerIcon /> {record.is_active ? "Deactivate" : "Activate"}
            </Button>
          }
        />
        {canDelete ? (
          <ConfirmDialog
            {...deleteProps}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                data-testid="delete-button"
              >
                <Trash2Icon /> Delete
              </Button>
            }
          />
        ) : null}
      </div>
    );
  }

  // Compact menu: dialogs are rendered OUTSIDE the dropdown (nesting a Dialog inside a
  // DropdownMenu leaves pointer events locked after it closes).
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Row actions" data-testid="row-actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)} data-testid="row-edit">
            <PencilIcon /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setToggleOpen(true)} data-testid="row-toggle-active">
            <PowerIcon /> {record.is_active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                variant="destructive"
                data-testid="row-delete"
              >
                <Trash2Icon /> Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <EntityFormDialog {...editProps} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDialog {...toggleProps} open={toggleOpen} onOpenChange={setToggleOpen} />
      {canDelete ? (
        <ConfirmDialog {...deleteProps} open={deleteOpen} onOpenChange={setDeleteOpen} />
      ) : null}
    </>
  );
}
