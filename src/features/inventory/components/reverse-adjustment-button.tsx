"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { reverseInventoryAdjustmentAction } from "../actions";

export function ReverseAdjustmentButton({ adjustmentId }: { adjustmentId: string }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <ConfirmDialog
      title="Reverse this adjustment?"
      description="A new adjustment with opposite quantities will be posted. The original stays in history."
      confirmLabel="Reverse"
      onConfirm={async () => {
        const result = await reverseInventoryAdjustmentAction(adjustmentId, idempotencyKey);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("Reversal posted");
        router.push(`/inventory/adjustments/${result.data.id}`);
        router.refresh();
      }}
      testId="reverse-dialog"
      trigger={
        <Button variant="outline" data-testid="reverse-button">
          <Undo2Icon /> Reverse
        </Button>
      }
    />
  );
}
