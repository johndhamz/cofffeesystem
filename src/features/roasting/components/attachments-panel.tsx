"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileIcon, ImageIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { uploadToBucket } from "@/lib/storage/client-upload";
import { ROAST_ATTACHMENT_BUCKET } from "@/lib/storage/buckets";
import { objectPath } from "@/lib/storage/paths";
import { attachRoastFileAction, deleteRoastAttachmentAction } from "../actions";
import type { Tables } from "@/types";

type Attachment = Tables<"roast_attachments"> & { url: string | null };

export function AttachmentsPanel({
  batchId,
  businessId,
  attachments,
  canEdit,
}: {
  batchId: string;
  businessId: string;
  attachments: Attachment[];
  canEdit: boolean;
}) {
  const router = useRouter();

  /** Browser -> Storage upload under RLS, then the server records the row. Returns an error message or null. */
  async function onFile(file: File) {
    const path = objectPath(businessId, batchId, file.name);
    const up = await uploadToBucket(ROAST_ATTACHMENT_BUCKET, path, file);
    if (!up.ok) return up.message;
    const r = await attachRoastFileAction(batchId, {
      path,
      fileName: file.name,
      sizeBytes: file.size,
    });
    if (!r.ok) return r.error.message;
    toast.success("Attachment uploaded");
    router.refresh();
    return null;
  }

  return (
    <div className="space-y-3" data-testid="attachments-panel">
      {attachments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No attachments. Upload Artisan logs (.alog / .csv) or screenshots. CSV parsing comes in a
          later phase.
        </p>
      ) : (
        <ul className="divide-y text-sm">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 py-1.5"
              data-testid="attachment-row"
            >
              <a
                href={a.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:underline"
              >
                {a.file_type === "image" ? (
                  <ImageIcon className="size-4" />
                ) : (
                  <FileIcon className="size-4" />
                )}
                {a.file_name}
                <span className="text-muted-foreground text-xs">
                  {a.file_type.replace("_", " ")}
                  {a.size_bytes ? ` · ${Math.round(a.size_bytes / 1024)} KB` : ""}
                </span>
              </a>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete attachment"
                  onClick={async () => {
                    const r = await deleteRoastAttachmentAction(batchId, a.id);
                    if (!r.ok) return toast.error(r.error.message);
                    router.refresh();
                  }}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="attachment-form">
          <FileUploadButton
            accept=".alog,.csv,.png,.jpg,.jpeg,.webp,image/*,text/csv"
            label="Upload attachment"
            inputTestId="attachment-input"
            buttonTestId="attachment-upload"
            onFile={onFile}
          />
          <span className="text-muted-foreground text-xs">
            Artisan logs, CSV or images up to 10 MB. Uploads as soon as you pick a file.
          </span>
        </div>
      ) : null}
    </div>
  );
}
