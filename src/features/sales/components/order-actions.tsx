"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BanIcon,
  CheckIcon,
  PencilIcon,
  PrinterIcon,
  TruckIcon,
  Undo2Icon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import {
  cancelSalesOrderAction,
  confirmSalesOrderAction,
  deleteDraftSalesOrderAction,
} from "../actions";
import { PaymentDialog } from "./payment-dialog";

interface Props {
  id: string;
  status: string;
  canManage: boolean;
  outstanding: number;
  hasItems: boolean;
}

export function OrderActions({ id, status, canManage, outstanding, hasItems }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const printButton = (
    <Button asChild variant="outline" data-testid="print-link">
      <Link href={`/sales/${id}/print`} target="_blank">
        <PrinterIcon /> Print
      </Link>
    </Button>
  );
  if (!canManage) return <div className="flex gap-2">{printButton}</div>;
  const open = ["confirmed", "reserved", "partially_fulfilled"].includes(status);
  const canPay = !["draft", "cancelled"].includes(status) && outstanding > 0;
  return (
    <div className="flex flex-wrap gap-2" data-testid="order-actions">
      {status === "draft" ? (
        <>
          <ConfirmDialog
            title="Confirm and reserve stock?"
            description="Finished-goods lots are reserved for this order (oldest first). Stock is deducted only when you fulfil."
            confirmLabel="Confirm order"
            testId="confirm-order-dialog"
            onConfirm={async () => {
              const r = await confirmSalesOrderAction(id);
              if (!r.ok) {
                toast.error(r.error.message);
                throw new Error(r.error.message);
              }
              toast.success("Order confirmed and stock reserved");
              router.refresh();
            }}
            trigger={
              <Button disabled={!hasItems} data-testid="confirm-order-button">
                <CheckIcon /> Confirm &amp; reserve
              </Button>
            }
          />
          <Button asChild variant="outline" data-testid="edit-order-link">
            <Link href={`/sales/${id}/edit`}>
              <PencilIcon /> Edit
            </Link>
          </Button>
          <ConfirmDialog
            title="Delete this draft?"
            confirmLabel="Delete"
            destructive
            testId="delete-order-dialog"
            onConfirm={async () => {
              const r = await deleteDraftSalesOrderAction(id);
              if (!r.ok) {
                toast.error(r.error.message);
                return;
              }
              router.push("/sales");
              router.refresh();
            }}
            trigger={
              <Button
                variant="outline"
                className="text-destructive"
                data-testid="delete-order-button"
              >
                <Trash2Icon /> Delete
              </Button>
            }
          />
        </>
      ) : null}
      {open ? (
        <Button asChild data-testid="fulfill-link">
          <Link href={`/sales/${id}/fulfill`}>
            <TruckIcon /> Fulfil
          </Link>
        </Button>
      ) : null}
      {canPay ? <PaymentDialog orderId={id} outstanding={outstanding} /> : null}
      {["partially_fulfilled", "fulfilled", "completed", "returned"].includes(status) ? (
        <Button asChild variant="outline" data-testid="return-link">
          <Link href={`/sales/${id}/return`}>
            <Undo2Icon /> Return
          </Link>
        </Button>
      ) : null}
      {["draft", "confirmed", "reserved"].includes(status) ? (
        <ConfirmDialog
          title="Cancel this order?"
          confirmLabel="Cancel order"
          destructive
          testId="cancel-order-dialog"
          description={
            <span className="block space-y-3">
              <span className="block">
                Reservations are released. Payments must be refunded first.
              </span>
              <FormField name="cancel_reason" label="Reason" required>
                <Textarea
                  id="cancel_reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  data-testid="cancel-reason"
                />
              </FormField>
            </span>
          }
          onConfirm={async () => {
            const r = await cancelSalesOrderAction(id, { reason });
            if (!r.ok) {
              toast.error(r.error.message);
              throw new Error(r.error.message);
            }
            toast.success("Order cancelled");
            router.refresh();
          }}
          trigger={
            <Button variant="outline" data-testid="cancel-order-button">
              <BanIcon /> Cancel
            </Button>
          }
        />
      ) : null}
      {printButton}
    </div>
  );
}
