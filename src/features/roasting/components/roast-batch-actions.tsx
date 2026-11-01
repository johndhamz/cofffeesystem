"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BanIcon, CheckCircle2Icon, PencilIcon, PlayIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import {
  deleteDraftRoastBatchAction,
  startRoastBatchAction,
  voidRoastBatchAction,
} from "../actions";
import type { Enums } from "@/types";

interface Props {
  id: string;
  status: Enums<"roast_batch_status">;
  canManage: boolean;
  hasInputs: boolean;
}

export function RoastBatchActions({ id, status, canManage, hasInputs }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [voidKey] = useState(() => crypto.randomUUID());
  if (!canManage) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="roast-actions">
      {status === "draft" ? (
        <ConfirmDialog
          title="Start this roast?"
          description="Marks the batch as in progress so measurements can be recorded. Stock is not changed until completion."
          confirmLabel="Start roast"
          testId="start-dialog"
          onConfirm={async () => {
            const r = await startRoastBatchAction(id);
            if (!r.ok) {
              toast.error(r.error.message);
              return;
            }
            toast.success("Roast started");
            router.refresh();
          }}
          trigger={
            <Button disabled={!hasInputs} data-testid="start-button">
              <PlayIcon /> Start roast
            </Button>
          }
        />
      ) : null}
      {status === "draft" || status === "in_progress" ? (
        <>
          <Button
            asChild
            variant={status === "in_progress" ? "default" : "outline"}
            data-testid="complete-link"
          >
            <Link href={`/roasting/${id}/complete`}>
              <CheckCircle2Icon /> Complete roast
            </Link>
          </Button>
          <Button asChild variant="outline" data-testid="edit-link">
            <Link href={`/roasting/${id}/edit`}>
              <PencilIcon /> Edit
            </Link>
          </Button>
        </>
      ) : null}
      {status === "draft" ? (
        <ConfirmDialog
          title="Delete this draft?"
          description="The draft batch will be removed permanently."
          confirmLabel="Delete"
          destructive
          testId="delete-dialog"
          onConfirm={async () => {
            const r = await deleteDraftRoastBatchAction(id);
            if (!r.ok) {
              toast.error(r.error.message);
              return;
            }
            toast.success("Draft deleted");
            router.push("/roasting");
            router.refresh();
          }}
          trigger={
            <Button variant="outline" className="text-destructive" data-testid="delete-button">
              <Trash2Icon /> Delete
            </Button>
          }
        />
      ) : null}
      {status !== "voided" ? (
        <ConfirmDialog
          title={status === "completed" ? "Void and reverse this roast?" : "Void this roast?"}
          description={
            <span className="block space-y-3">
              <span className="block">
                {status === "completed"
                  ? "Roasted stock from this batch will be removed and the green coffee restored with its original cost. Only possible while none of the roasted coffee has been used."
                  : "The batch will be closed without affecting stock."}
              </span>
              <FormField name="void_reason" label="Reason" required>
                <Textarea
                  id="void_reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  data-testid="void-reason"
                />
              </FormField>
            </span>
          }
          confirmLabel="Void roast"
          destructive
          testId="void-dialog"
          onConfirm={async () => {
            const r = await voidRoastBatchAction(id, { reason }, voidKey);
            if (!r.ok) {
              toast.error(r.error.message);
              throw new Error(r.error.message);
            }
            toast.success("Roast voided");
            router.refresh();
          }}
          trigger={
            <Button variant="outline" data-testid="void-button">
              <BanIcon /> Void
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
