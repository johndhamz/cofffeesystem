"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  createProduct,
  saveVariant,
  setVariantActive,
  updateProduct,
} from "@/server/services/products.service";

function revalidate(id?: string) {
  revalidatePath("/products");
  if (id) revalidatePath(`/products/${id}`);
  revalidatePath("/packaging/new");
}

export async function createProductAction(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const row = await createProduct(input);
    revalidate(row.id);
    return ok({ id: row.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateProductAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await updateProduct(id, input);
    revalidate(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function saveVariantAction(
  productId: string,
  variantId: string | null,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await saveVariant(productId, variantId, input);
    revalidate(productId);
    return ok({ id: id! });
  } catch (error) {
    return fail(error);
  }
}

export async function setVariantActiveAction(
  productId: string,
  variantId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await setVariantActive(variantId, isActive);
    revalidate(productId);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
