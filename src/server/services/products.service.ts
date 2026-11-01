import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { validate } from "@/lib/validation";
import { Errors } from "@/lib/errors";
import { fromCentavos, toCentavos } from "@/lib/money";
import type { ListQuery } from "@/lib/validation/common";
import { productsRepository } from "@/server/repositories/products.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { productSchema, variantSchema } from "@/features/products/schemas";

export async function listProducts(query: ListQuery) {
  const ctx = await requirePermission("products.read");
  const db = await createSupabaseServerClient();
  return productsRepository(db).list(ctx.business.businessId, query);
}

export async function getProduct(id: string) {
  const ctx = await requirePermission("products.read");
  const db = await createSupabaseServerClient();
  const [product, materials] = await Promise.all([
    productsRepository(db).get(ctx.business.businessId, id),
    masterDataRepository(db, "packaging_materials").listActive(ctx.business.businessId),
  ]);
  if (!product) throw Errors.notFound("Product");
  return {
    product,
    materials: materials.map((m) => ({ id: m.id, name: m.name, base_unit: m.base_unit })),
  };
}

export async function createProduct(input: unknown) {
  const ctx = await requirePermission("products.manage");
  const values = validate(productSchema, input);
  const db = await createSupabaseServerClient();
  const repo = productsRepository(db);
  if (await repo.findByName(ctx.business.businessId, values.name)) {
    throw Errors.conflict(`Product "${values.name}" already exists.`, {
      name: ["A product with this name already exists"],
    });
  }
  return repo.create({
    business_id: ctx.business.businessId,
    name: values.name,
    description: values.description ?? null,
    category: values.category ?? null,
    is_active: values.is_active,
  });
}

export async function updateProduct(id: string, input: unknown) {
  const ctx = await requirePermission("products.manage");
  const values = validate(productSchema, input);
  const db = await createSupabaseServerClient();
  const repo = productsRepository(db);
  if (await repo.findByName(ctx.business.businessId, values.name, id)) {
    throw Errors.conflict(`Product "${values.name}" already exists.`, {
      name: ["A product with this name already exists"],
    });
  }
  return repo.update(ctx.business.businessId, id, {
    name: values.name,
    description: values.description ?? null,
    category: values.category ?? null,
    is_active: values.is_active,
  });
}

export async function saveVariant(productId: string, variantId: string | null, input: unknown) {
  const ctx = await requirePermission("products.manage");
  const values = validate(variantSchema, input);
  const db = await createSupabaseServerClient();
  const repo = productsRepository(db);
  const product = await repo.get(ctx.business.businessId, productId);
  if (!product) throw Errors.notFound("Product");
  if (await repo.findVariantBySku(ctx.business.businessId, values.sku, variantId ?? undefined)) {
    throw Errors.conflict(`SKU "${values.sku}" is already used.`, {
      sku: ["This SKU is already used by another variant"],
    });
  }
  return repo.upsertVariant(
    ctx.business.businessId,
    productId,
    variantId,
    {
      sku: values.sku,
      name: values.name,
      net_weight_g: values.net_weight_g,
      packaging_type: values.packaging_type,
      selling_price: fromCentavos(toCentavos(values.selling_price)),
      wholesale_price: values.wholesale_price
        ? fromCentavos(toCentavos(values.wholesale_price))
        : null,
      is_active: values.is_active,
    },
    values.materials,
  );
}

export async function setVariantActive(id: string, isActive: boolean) {
  const ctx = await requirePermission("products.manage");
  const db = await createSupabaseServerClient();
  await productsRepository(db).setVariantActive(ctx.business.businessId, id, isActive);
}

export async function listActiveVariants() {
  const ctx = await requirePermission("products.read");
  const db = await createSupabaseServerClient();
  return productsRepository(db).activeVariants(ctx.business.businessId);
}
