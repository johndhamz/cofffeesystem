"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { updateBusinessSettings } from "@/server/services/settings.service";

export async function updateBusinessSettingsAction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await updateBusinessSettings(input);
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
