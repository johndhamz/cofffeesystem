"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, PackagePlusIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  cancelPurchaseOrderAction,
  confirmPurchaseOrderAction,
  deleteDraftPurchaseOrderAction,
} from "../actions";
import type { PurchaseOrderStatus } from "@/types";

interface Props {
  id: string;
  status: PurchaseOrderStatus;
  canManage: boolean;
  canPost: boolean;
  hasItems: boolean;
}

export function PurchaseOrderActions({ id, status, canManage, canPost, hasItems }: Props) {
  const router = useRouter();

  async function run(
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success: string,
  ) {
    const result = await action();
    if (!result.ok) {
      toast.error(result.error?.message ?? "Action failed");
      return;
    }
    toast.success(success);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="po-actions">
      {canPost && (status === "confirmed" || status === "partially_received") ? (
        <Button asChild data-testid="receive-button">
          <Link href={`/purchases/${id}/receive`}>
            <PackagePlusIcon /> Receive goods
          </Link>
        </Button>
      ) : null}
      {canManage && status === "draft" ? (
        <>
          <ConfirmDialog
            title="Confirm this purchase order?"
            description="Items and prices are locked after confirmation. Stock is only added when goods are received."
            confirmLabel="Confirm order"
            onConfirm={() => run(() => confirmPurchaseOrderAction(id), "Purchase order confirmed")}
            testId="confirm-po-dialog"
            trigger={
              <Button disabled={!hasItems} data-testid="confirm-po-button">
                <CheckIcon /> Confirm
              </Button>
            }
          />
          <Button asChild variant="outline" data-testid="edit-po-button">
            <Link href={`/purchases/${id}/edit`}>
              <PencilIcon /> Edit
            </Link>
          </Button>
          <ConfirmDialog
            title="Delete this draft?"
            description="The draft purchase order will be permanently removed."
            confirmLabel="Delete"
            destructive
            onConfirm={async () => {
              const result = await deleteDraftPurchaseOrderAction(id);
              if (!result.ok) {
                toast.error(result.error.message);
                return;
              }
              toast.success("Draft deleted");
              router.push("/purchases");
              router.refresh();
            }}
            testId="delete-po-dialog"
            trigger={
              <Button variant="outline" className="text-destructive" data-testid="delete-po-button">
                <Trash2Icon /> Delete
              </Button>
            }
          />
        </>
      ) : null}
      {canManage && (status === "draft" || status === "confirmed") ? (
        <ConfirmDialog
          title="Cancel this purchase order?"
          description="Cancelled orders cannot be received. This cannot be undone."
          confirmLabel="Cancel order"
          destructive
          onConfirm={() => run(() => cancelPurchaseOrderAction(id), "Purchase order cancelled")}
          testId="cancel-po-dialog"
          trigger={
            <Button variant="outline" data-testid="cancel-po-button">
              <XIcon /> Cancel order
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
