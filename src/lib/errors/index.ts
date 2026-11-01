/**
 * Standardized application errors. Services throw these; actions/route handlers serialize them.
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "INSUFFICIENT_STOCK"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
  INSUFFICIENT_STOCK: 409,
  INTERNAL_ERROR: 500,
};

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;
  readonly cause?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { fieldErrors?: FieldErrors; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fieldErrors = options.fieldErrors;
    this.cause = options.cause;
  }

  toJSON(): SerializedError {
    return { code: this.code, message: this.message, fieldErrors: this.fieldErrors };
  }
}

export interface SerializedError {
  code: AppErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

export const Errors = {
  validation: (message: string, fieldErrors?: FieldErrors) =>
    new AppError("VALIDATION_ERROR", message, { fieldErrors }),
  unauthenticated: (message = "You must be signed in") => new AppError("UNAUTHENTICATED", message),
  forbidden: (message = "You do not have permission to do this") =>
    new AppError("FORBIDDEN", message),
  notFound: (entity = "Record") => new AppError("NOT_FOUND", `${entity} not found`),
  conflict: (message: string, fieldErrors?: FieldErrors) =>
    new AppError("CONFLICT", message, { fieldErrors }),
  invalidState: (message: string) => new AppError("INVALID_STATE", message),
  insufficientStock: (message = "Insufficient stock") =>
    new AppError("INSUFFICIENT_STOCK", message),
  internal: (message = "Something went wrong", cause?: unknown) =>
    new AppError("INTERNAL_ERROR", message, { cause }),
};

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Map a Supabase/PostgREST/Postgres error to an AppError.
 * Database functions raise messages prefixed with a token (VALIDATION:, FORBIDDEN:, ...)
 * which we map here so the UI gets a consistent shape.
 */
export function fromDatabaseError(
  error: PostgrestLikeError | null | undefined,
  fallback = "Database error",
): AppError {
  if (!error) return Errors.internal(fallback);
  const message = error.message ?? fallback;

  if (error.code === "23505") {
    return Errors.conflict(friendlyUniqueMessage(message, error.details));
  }
  if (error.code === "23503") {
    return Errors.validation(
      message.includes("VALIDATION:")
        ? stripPrefix(message)
        : "This record references or is referenced by other records.",
    );
  }
  if (
    error.code === "23514" ||
    error.code === "22023" ||
    error.code === "22P02" ||
    error.code === "22003"
  ) {
    return Errors.validation(stripPrefix(message));
  }
  if (error.code === "42501" || message.startsWith("FORBIDDEN")) {
    return Errors.forbidden(stripPrefix(message));
  }
  if (error.code === "P0002" || message.startsWith("NOT_FOUND")) {
    return Errors.notFound(stripPrefix(message) || "Record");
  }
  if (error.hint === "insufficient_stock" || message.startsWith("INSUFFICIENT_STOCK")) {
    return Errors.insufficientStock(stripPrefix(message));
  }
  if (
    error.code === "55000" ||
    message.startsWith("INVALID_STATE") ||
    message.startsWith("OVER_RECEIPT")
  ) {
    return Errors.invalidState(stripPrefix(message));
  }
  if (error.code === "PGRST116") {
    return Errors.notFound();
  }
  return Errors.internal(fallback, error);
}

function stripPrefix(message: string): string {
  return message.replace(
    /^(VALIDATION|FORBIDDEN|NOT_FOUND|INVALID_STATE|INSUFFICIENT_STOCK|OVER_RECEIPT):\s*/,
    "",
  );
}

function friendlyUniqueMessage(message: string, details?: string | null): string {
  const text = `${message} ${details ?? ""}`;
  if (/name/i.test(text)) return "A record with this name already exists.";
  if (/lot_code|lots_code/i.test(text)) return "A lot with this code already exists.";
  if (/email/i.test(text)) return "A record with this email already exists.";
  return "A duplicate record already exists.";
}

export function toSerializedError(error: unknown): SerializedError {
  if (error instanceof AppError) return error.toJSON();
  if (error instanceof Error) return { code: "INTERNAL_ERROR", message: error.message };
  return { code: "INTERNAL_ERROR", message: "Unknown error" };
}

/** Discriminated result used by server actions so the client never receives thrown errors. */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: SerializedError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: unknown): ActionResult<T> {
  return { ok: false, error: toSerializedError(error) };
}
