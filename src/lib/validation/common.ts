import { z } from "zod";

/** Trim strings and turn empty strings into undefined (optional fields stay optional). */
export const optionalTrimmed = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v),
    z.string().max(max).optional(),
  );

export const requiredName = (max = 120) =>
  z.string().trim().min(1, "Name is required").max(max, `Must be at most ${max} characters`);

/** Optional numeric input from a form ("" → undefined). */
export const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (typeof v === "string") return Number(v.replace(/,/g, ""));
    return v;
  }, schema.optional());

export const requiredNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (typeof v === "string") return Number(v.replace(/,/g, ""));
    return v;
  }, schema);

export const uuidSchema = z.uuid({ message: "Invalid id" });

/** Accepts "" (from a <select> placeholder) or a UUID; outputs undefined or the UUID. */
export const optionalUuid = z
  .union([z.literal(""), uuidSchema])
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const booleanFromForm = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "on" || v === "1") return true;
  if (v === "false" || v === "off" || v === "0" || v === "" || v === undefined || v === null)
    return false;
  return v;
}, z.boolean());

/** Money as a decimal string with up to 2 places, >= 0. */
export const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,11}(\.\d{1,2})?$/, "Enter an amount with up to 2 decimal places");

export const optionalMoneyString = z.preprocess(
  (v) =>
    v === "" || v === null || v === undefined ? "0" : typeof v === "number" ? v.toFixed(2) : v,
  moneyString,
);

/** Date as YYYY-MM-DD. */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Invalid date");

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  sort: z.string().max(60).optional(),
  dir: z.enum(["asc", "desc"]).default("asc"),
  status: z.enum(["all", "active", "inactive"]).default("active"),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export function parseListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ListQuery {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  const result = listQuerySchema.safeParse(flat);
  return result.success ? result.data : listQuerySchema.parse({});
}

/**
 * Makes a user search term safe for PostgREST `ilike` filters inside `.or()` expressions:
 * reserved syntax characters are dropped and LIKE wildcards are escaped.
 */
export function escapeLike(value: string): string {
  return value
    .replace(/[,()"'\\]/g, " ")
    .replace(/[%_]/g, (m) => `\\${m}`)
    .trim();
}
