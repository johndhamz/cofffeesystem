"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BanIcon, CheckCircle2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import {
  completePackagingSessionAction,
  deleteDraftPackagingSessionAction,
  voidPackagingSessionAction,
} from "../actions";
import type { Enums } from "@/types";

interface Props {
  id: string;
  status: Enums<"packaging_session_status">;
  canManage: boolean;
}

export function PackagingSessionActions({ id, status, canManage }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [voidKey] = useState(() => crypto.randomUUID());
  if (!canManage) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="session-actions">
      {status === "draft" ? (
        <>
          <ConfirmDialog
            title="Complete this packaging session?"
            description="Roasted coffee and materials are consumed and finished-goods lots are created in one transaction. This cannot be edited afterwards."
            confirmLabel="Complete session"
            testId="complete-dialog"
            onConfirm={async () => {
              const r = await completePackagingSessionAction(id);
              if (!r.ok) {
                toast.error(r.error.message);
                throw new Error(r.error.message);
              }
              toast.success("Packaging completed — finished goods created");
              router.refresh();
            }}
            trigger={
              <Button data-testid="complete-button">
                <CheckCircle2Icon /> Complete
              </Button>
            }
          />
          <Button asChild variant="outline" data-testid="edit-link">
            <Link href={`/packaging/${id}/edit`}>
              <PencilIcon /> Edit
            </Link>
          </Button>
          <ConfirmDialog
            title="Delete this draft?"
            confirmLabel="Delete"
            destructive
            testId="delete-dialog"
            onConfirm={async () => {
              const r = await deleteDraftPackagingSessionAction(id);
              if (!r.ok) {
                toast.error(r.error.message);
                return;
              }
              router.push("/packaging");
              router.refresh();
            }}
            trigger={
              <Button variant="outline" className="text-destructive" data-testid="delete-button">
                <Trash2Icon /> Delete
              </Button>
            }
          />
        </>
      ) : null}
      {status !== "voided" ? (
        <ConfirmDialog
          title={status === "completed" ? "Void and reverse this session?" : "Void this draft?"}
          description={
            <span className="block space-y-3">
              <span className="block">
                {status === "completed"
                  ? "Finished goods are removed and roasted coffee and materials restored with their original cost. Only possible while every finished lot is still fully on hand."
                  : "The draft will be closed."}
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
          confirmLabel="Void session"
          destructive
          testId="void-dialog"
          onConfirm={async () => {
            const r = await voidPackagingSessionAction(id, { reason }, voidKey);
            if (!r.ok) {
              toast.error(r.error.message);
              throw new Error(r.error.message);
            }
            toast.success("Session voided");
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
