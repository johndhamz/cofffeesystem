import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { validate } from "@/lib/validation";
import { Errors } from "@/lib/errors";
import { settingsRepository } from "@/server/repositories/settings.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { businessSettingsSchema } from "@/features/settings/schemas";

export async function getBusinessSettings() {
  const ctx = await requirePermission("business.settings.read");
  const db = await createSupabaseServerClient();
  const repo = settingsRepository(db);
  const [settings, roasters, locations] = await Promise.all([
    repo.getByBusiness(ctx.business.businessId),
    masterDataRepository(db, "roasters").listActive(ctx.business.businessId),
    masterDataRepository(db, "inventory_locations").listActive(ctx.business.businessId),
  ]);
  return { settings, roasters, locations, business: ctx.business };
}

export async function updateBusinessSettings(input: unknown) {
  const ctx = await requirePermission("business.settings.update");
  const values = validate(businessSettingsSchema, input);
  const db = await createSupabaseServerClient();
  const repo = settingsRepository(db);

  // Cross-business references are also blocked by composite FKs; we validate early for a clear message.
  if (values.default_roaster_id) {
    const roaster = await masterDataRepository(db, "roasters").getById(
      ctx.business.businessId,
      values.default_roaster_id,
    );
    if (!roaster || !roaster.is_active) {
      throw Errors.validation("Select an active roaster.", {
        default_roaster_id: ["Select an active roaster"],
      });
    }
  }
  if (values.default_location_id) {
    const location = await masterDataRepository(db, "inventory_locations").getById(
      ctx.business.businessId,
      values.default_location_id,
    );
    if (!location || !location.is_active) {
      throw Errors.validation("Select an active location.", {
        default_location_id: ["Select an active location"],
      });
    }
  }

  if (values.business_name && values.business_name !== ctx.business.businessName) {
    await repo.updateBusinessName(ctx.business.businessId, values.business_name);
  }

  return repo.update(ctx.business.businessId, {
    currency: values.currency,
    timezone: values.timezone,
    inventory_weight_unit: values.inventory_weight_unit,
    costing_method: values.costing_method,
    default_roaster_id: values.default_roaster_id ?? null,
    default_location_id: values.default_location_id ?? null,
  });
}

export async function listBusinessMembers() {
  const ctx = await requirePermission("members.read");
  const db = await createSupabaseServerClient();
  return settingsRepository(db).listMembers(ctx.business.businessId);
}

export async function listRecentAuditLogs(limit = 50) {
  const ctx = await requirePermission("audit.read");
  const db = await createSupabaseServerClient();
  return settingsRepository(db).recentAuditLogs(ctx.business.businessId, limit);
}
