"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLinkIcon } from "lucide-react";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { uploadToBucket } from "@/lib/storage/client-upload";
import { RECEIPT_BUCKET } from "@/lib/storage/buckets";
import { objectPath } from "@/lib/storage/paths";
import { attachReceiptAction } from "../actions";

/**
 * Receipt card body. Choosing a file uploads it immediately (browser -> Storage under RLS), then a
 * server action points the expense at the new object and the page refreshes.
 */
export function ReceiptPanel({
  expenseId,
  businessId,
  receiptUrl,
  canManage,
}: {
  expenseId: string;
  businessId: string;
  receiptUrl: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  return (
    <div className="space-y-3" data-testid="receipt-panel">
      {receiptUrl ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm underline"
          data-testid="receipt-link"
        >
          Open attached receipt <ExternalLinkIcon className="size-3.5" />
        </a>
      ) : (
        <p className="text-muted-foreground text-sm">No receipt attached.</p>
      )}
      {canManage ? (
        <div className="space-y-1">
          <FileUploadButton
            accept="image/png,image/jpeg,image/webp,application/pdf"
            label={receiptUrl ? "Replace receipt" : "Attach receipt"}
            inputTestId="receipt-input"
            buttonTestId="receipt-upload"
            onFile={async (file) => {
              const path = objectPath(businessId, expenseId, file.name);
              const up = await uploadToBucket(RECEIPT_BUCKET, path, file);
              if (!up.ok) return up.message;
              const r = await attachReceiptAction(expenseId, path);
              if (!r.ok) return r.error.message;
              toast.success("Receipt attached");
              router.refresh();
              return null;
            }}
          />
          <p className="text-muted-foreground text-xs">
            Photo or PDF, up to 10 MB. Uploads as soon as you pick a file.
          </p>
        </div>
      ) : null}
    </div>
  );
}
