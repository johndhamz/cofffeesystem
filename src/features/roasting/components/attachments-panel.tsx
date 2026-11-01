"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileIcon, ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteRoastAttachmentAction, uploadRoastAttachmentAction } from "../actions";
import type { Tables } from "@/types";

type Attachment = Tables<"roast_attachments"> & { url: string | null };

export function AttachmentsPanel({
  batchId,
  attachments,
  canEdit,
}: {
  batchId: string;
  attachments: Attachment[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) return toast.error("Choose a file first");
    setUploading(true);
    const r = await uploadRoastAttachmentAction(batchId, fd);
    setUploading(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success("Attachment uploaded");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
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
        <form
          onSubmit={onSubmit}
          className="flex flex-wrap items-center gap-2"
          data-testid="attachment-form"
        >
          <Input
            ref={inputRef}
            type="file"
            name="file"
            accept=".alog,.csv,.png,.jpg,.jpeg,.webp,image/*,text/csv"
            className="max-w-xs"
            data-testid="attachment-input"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={uploading}
            data-testid="attachment-upload"
          >
            {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Upload
          </Button>
        </form>
      ) : null}
    </div>
  );
}
