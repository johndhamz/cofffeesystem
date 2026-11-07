/** Helpers for object paths in Supabase Storage. Objects live under <business_id>/<document_id>/<file>. */

/** File name with only safe characters, capped at 100 chars (what Storage keys and signed URLs tolerate). */
export function safeFileName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return safe.length > 0 ? safe : "file";
}

/** Builds the object path the browser uploads to. Storage RLS checks the first folder against the caller's business. */
export function objectPath(
  businessId: string,
  documentId: string,
  fileName: string,
  now = Date.now(),
) {
  return `${businessId}/${documentId}/${now}-${safeFileName(fileName)}`;
}

/** True when `path` is a single object directly inside <businessId>/<documentId>/ (no traversal, no nesting). */
export function isObjectWithin(path: string, businessId: string, documentId: string): boolean {
  const prefix = `${businessId}/${documentId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return rest.length > 0 && rest.length <= 120 && !rest.includes("/") && !rest.includes("..");
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
