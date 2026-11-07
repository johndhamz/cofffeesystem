"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/paths";

/**
 * One-click attach: the button opens the file picker and the upload starts as soon as a file is
 * chosen (no second "submit" step). The input itself is visually hidden but remains in the DOM so
 * tests can set files on it.
 */
export function FileUploadButton({
  accept,
  label,
  busyLabel = "Uploading…",
  inputTestId,
  buttonTestId,
  maxBytes = MAX_UPLOAD_BYTES,
  onFile,
  size = "sm",
  variant = "outline",
}: {
  accept: string;
  label: string;
  busyLabel?: string;
  inputTestId: string;
  buttonTestId?: string;
  maxBytes?: number;
  /** Resolves with null on success or a user-facing error message. */
  onFile: (file: File) => Promise<string | null>;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxBytes) {
      toast.error(`${file.name} is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      e.target.value = "";
      return;
    }
    setBusy(true);
    const message = await onFile(file);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (message) toast.error(message);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={inputTestId}
        onChange={onChange}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={busy}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
        data-testid={buttonTestId}
      >
        {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
        {busy ? busyLabel : label}
      </Button>
    </>
  );
}
