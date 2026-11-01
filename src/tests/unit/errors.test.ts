import { describe, expect, it } from "vitest";
import { AppError, Errors, fromDatabaseError, fail, ok } from "@/lib/errors";

describe("standardized errors", () => {
  it("maps codes to HTTP statuses", () => {
    expect(Errors.validation("x").status).toBe(400);
    expect(Errors.unauthenticated().status).toBe(401);
    expect(Errors.forbidden().status).toBe(403);
    expect(Errors.notFound().status).toBe(404);
    expect(Errors.conflict("x").status).toBe(409);
    expect(Errors.insufficientStock().status).toBe(409);
  });

  it("maps Postgres unique violations to CONFLICT with a friendly message", () => {
    const err = fromDatabaseError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "suppliers_business_name_key"',
    });
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toMatch(/name already exists/);
  });

  it("maps prefixed function errors", () => {
    expect(
      fromDatabaseError({
        code: "P0001",
        message: "INSUFFICIENT_STOCK: on hand 0",
        hint: "insufficient_stock",
      }).code,
    ).toBe("INSUFFICIENT_STOCK");
    expect(
      fromDatabaseError({ code: "42501", message: "FORBIDDEN: missing permission x" }).code,
    ).toBe("FORBIDDEN");
    expect(
      fromDatabaseError({ code: "55000", message: "INVALID_STATE: receipt is posted" }).message,
    ).toBe("receipt is posted");
    expect(fromDatabaseError({ code: "22023", message: "VALIDATION: bad" }).code).toBe(
      "VALIDATION_ERROR",
    );
    expect(fromDatabaseError({ code: "P0002", message: "NOT_FOUND: purchase order" }).code).toBe(
      "NOT_FOUND",
    );
  });

  it("serializes action results", () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
    const result = fail(new AppError("FORBIDDEN", "no"));
    expect(result).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "no", fieldErrors: undefined },
    });
    expect(fail(new Error("boom"))).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "boom" },
    });
  });
});
