import type { z } from "zod";
import { Errors, type FieldErrors } from "@/lib/errors";

/** Server-side validation. Throws AppError(VALIDATION_ERROR) with per-field messages. */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  throw Errors.validation("Please correct the highlighted fields.", fieldErrors);
}

/** Convert a FormData into a plain object (first value wins, except keys ending in [] which become arrays). */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      const existing = out[k];
      if (Array.isArray(existing)) existing.push(value);
      else out[k] = [value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

export * from "./common";
