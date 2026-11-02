"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  commitSalesImport,
  previewSalesImport,
  type ImportPreview,
  type ImportResult,
} from "@/server/services/sales-import.service";

export async function previewSalesImportAction(
  formData: FormData,
): Promise<ActionResult<ImportPreview>> {
  try {
    const location = formData.get("location_id");
    const preview = await previewSalesImport(
      formData.get("file") as File,
      typeof location === "string" && location ? location : null,
    );
    return ok(preview);
  } catch (error) {
    return fail(error);
  }
}

export async function commitSalesImportAction(
  payload: unknown,
): Promise<ActionResult<ImportResult>> {
  try {
    const result = await commitSalesImport(payload);
    for (const p of [
      "/sales",
      "/sales/history",
      "/customers",
      "/inventory/finished",
      "/dashboard",
      "/reports",
    ])
      revalidatePath(p);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
