"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Uploads straight from the browser to Supabase Storage with the user's own session (anon key +
 * cookies), so Storage RLS, the bucket's MIME allow-list and its size limit all apply. Bypassing the
 * server keeps large photos clear of the 1 MB server-action body limit and Vercel's 4.5 MB request cap.
 */
export async function uploadToBucket(
  bucket: string,
  path: string,
  file: File,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const db = createSupabaseBrowserClient();
    const { error } = await db.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) return { ok: false, message: friendlyStorageError(error.message) };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Upload failed" };
  }
}

function friendlyStorageError(message: string): string {
  if (/mime type/i.test(message)) return `Upload failed: ${message}. Use a PNG, JPEG, WebP or PDF.`;
  if (/exceeded the maximum allowed size/i.test(message))
    return "Upload failed: the file is larger than the 10 MB limit.";
  if (/row-level security/i.test(message))
    return "Upload failed: you do not have permission to attach files here.";
  return `Upload failed: ${message}`;
}
