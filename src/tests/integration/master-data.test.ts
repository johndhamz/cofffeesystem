import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  businessIdFor,
  createMasterFixtures,
  SEED,
  uniq,
  userClient,
  type Db,
} from "./helpers";

let owner: Db;
let viewer: Db;
let inventory: Db;
let other: Db;
let businessId: string;
let otherBusinessId: string;

beforeAll(async () => {
  [owner, viewer, inventory, other] = await Promise.all([
    userClient(SEED.owner),
    userClient(SEED.viewer),
    userClient(SEED.inventory),
    userClient(SEED.otherOwner),
  ]);
  businessId = await businessIdFor(owner);
  otherBusinessId = await businessIdFor(other, "other-roastery");
});

describe("master data CRUD", () => {
  it("owner can create, read, update and deactivate a supplier", async () => {
    const name = uniq("Benguet Coop");
    const { data: created, error } = await owner
      .from("suppliers")
      .insert({ business_id: businessId, name, email: "coop@example.com" })
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(created?.is_active).toBe(true);

    const { data: updated } = await owner
      .from("suppliers")
      .update({ contact_person: "Ana", is_active: false })
      .eq("id", created!.id)
      .select("*")
      .single();
    expect(updated?.contact_person).toBe("Ana");
    expect(updated?.is_active).toBe(false);
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(created!.updated_at).getTime(),
    );

    const { data: read } = await owner.from("suppliers").select("*").eq("id", created!.id).single();
    expect(read?.name).toBe(name);
  });

  it("writes an audit log entry recording who changed the record", async () => {
    const { data: created } = await owner
      .from("roasters")
      .insert({ business_id: businessId, name: uniq("Audit Roaster"), capacity_g: 1000 })
      .select("*")
      .single();
    await owner.from("roasters").update({ capacity_g: 1500 }).eq("id", created!.id);
    const { data: logs } = await owner
      .from("audit_logs")
      .select("action, actor_id, before_data, after_data")
      .eq("entity_type", "roasters")
      .eq("entity_id", created!.id)
      .order("created_at");
    expect(logs?.map((l) => l.action)).toEqual(["insert", "update"]);
    const { data: me } = await owner.auth.getUser();
    expect(logs?.[1].actor_id).toBe(me.user?.id);
    expect((logs?.[1].before_data as { capacity_g: number }).capacity_g).toBe(1000);
    expect((logs?.[1].after_data as { capacity_g: number }).capacity_g).toBe(1500);
  });
});

describe("duplicate detection", () => {
  it("rejects a supplier with the same name (case/space-insensitive)", async () => {
    const name = uniq("Dup Supplier");
    const first = await owner
      .from("suppliers")
      .insert({ business_id: businessId, name })
      .select("id")
      .single();
    expect(first.error).toBeNull();
    const second = await owner
      .from("suppliers")
      .insert({ business_id: businessId, name: `  ${name.toUpperCase()} ` });
    expect(second.error?.code).toBe("23505");
  });

  it("allows the same name in a different business", async () => {
    const name = uniq("Shared Name");
    expect(
      (await owner.from("green_coffees").insert({ business_id: businessId, name })).error,
    ).toBeNull();
    expect(
      (await other.from("green_coffees").insert({ business_id: otherBusinessId, name })).error,
    ).toBeNull();
  });
});

describe("numeric validation at the database", () => {
  it("rejects negative altitude and zero capacity", async () => {
    const alt = await owner
      .from("green_coffees")
      .insert({ business_id: businessId, name: uniq("Bad Alt"), altitude_masl: -1 });
    expect(alt.error?.code).toBe("23514");
    const cap = await owner
      .from("roasters")
      .insert({ business_id: businessId, name: uniq("Bad Cap"), capacity_g: 0 });
    expect(cap.error?.code).toBe("23514");
  });

  it("keeps unknown measurements null", async () => {
    const { data } = await owner
      .from("green_coffees")
      .insert({ business_id: businessId, name: uniq("No Alt") })
      .select("altitude_masl, processing_method")
      .single();
    expect(data?.altitude_masl).toBeNull();
    expect(data?.processing_method).toBeNull();
  });
});

describe("row level security", () => {
  it("viewer can read but not create suppliers", async () => {
    const { data, error } = await viewer.from("suppliers").select("id").limit(1);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    const insert = await viewer
      .from("suppliers")
      .insert({ business_id: businessId, name: uniq("Viewer Supplier") });
    expect(insert.error?.code).toBe("42501");
  });

  it("inventory staff can manage suppliers but not roasters or business settings", async () => {
    const ok = await inventory
      .from("suppliers")
      .insert({ business_id: businessId, name: uniq("Staff Supplier") });
    expect(ok.error).toBeNull();
    const roaster = await inventory
      .from("roasters")
      .insert({ business_id: businessId, name: uniq("Staff Roaster"), capacity_g: 500 });
    expect(roaster.error?.code).toBe("42501");
    const settings = await inventory
      .from("business_settings")
      .update({ currency: "PHP" })
      .eq("business_id", businessId)
      .select("id");
    expect(settings.data).toEqual([]); // RLS filters the row: zero rows updated
  });

  it("members of another business cannot see or modify Kape records", async () => {
    const { data } = await other.from("suppliers").select("id").eq("business_id", businessId);
    expect(data).toEqual([]);
    const { data: settings } = await other
      .from("business_settings")
      .select("id")
      .eq("business_id", businessId);
    expect(settings).toEqual([]);
    const insert = await other
      .from("suppliers")
      .insert({ business_id: businessId, name: uniq("Intruder") });
    expect(insert.error?.code).toBe("42501");
  });

  it("business_id cannot be moved to another business", async () => {
    const { data: created } = await owner
      .from("suppliers")
      .insert({ business_id: businessId, name: uniq("Movable") })
      .select("id")
      .single();
    const moved = await owner
      .from("suppliers")
      .update({ business_id: otherBusinessId })
      .eq("id", created!.id);
    expect(moved.error).not.toBeNull();
  });
});

describe("cross-business references", () => {
  it("rejects a default roaster that belongs to another business", async () => {
    const { data: foreignRoaster } = await other
      .from("roasters")
      .select("id")
      .eq("business_id", otherBusinessId)
      .limit(1)
      .single();
    const result = await owner
      .from("business_settings")
      .update({ default_roaster_id: foreignRoaster!.id })
      .eq("business_id", businessId);
    expect(result.error?.code).toBe("23503");
  });

  it("accepts the business's own roaster as default and records who changed it", async () => {
    const { data: own } = await owner
      .from("roasters")
      .select("id")
      .eq("business_id", businessId)
      .eq("name", "Yoshan DY-2kg")
      .single();
    const { data, error } = await owner
      .from("business_settings")
      .update({ default_roaster_id: own!.id })
      .eq("business_id", businessId)
      .select("default_roaster_id, updated_by")
      .single();
    expect(error).toBeNull();
    expect(data?.default_roaster_id).toBe(own!.id);
    const { data: me } = await owner.auth.getUser();
    expect(data?.updated_by).toBe(me.user?.id);
  });
});

describe("inactive and referenced records", () => {
  it("default roaster Yoshan DY-2kg exists with 2000 g capacity and PHP/Manila settings", async () => {
    const { data: roaster } = await owner
      .from("roasters")
      .select("capacity_g")
      .eq("business_id", businessId)
      .eq("name", "Yoshan DY-2kg")
      .single();
    expect(roaster?.capacity_g).toBe(2000);
    const { data: settings } = await owner
      .from("business_settings")
      .select("currency, timezone, default_roaster_id, default_location_id")
      .eq("business_id", businessId)
      .single();
    expect(settings).toMatchObject({ currency: "PHP", timezone: "Asia/Manila" });
    expect(settings?.default_roaster_id).not.toBeNull();
    expect(settings?.default_location_id).not.toBeNull();
  });

  it("inactive suppliers cannot be used on new purchase orders", async () => {
    const { supplier, coffee } = await createMasterFixtures(owner, businessId);
    await owner.from("suppliers").update({ is_active: false }).eq("id", supplier.id);
    const { error } = await owner.rpc("create_purchase_order", {
      p_business_id: businessId,
      p_supplier_id: supplier.id,
      p_ordered_at: "2026-10-31",
      p_notes: null as unknown as string,
      p_additional_costs: 0,
      p_items: [{ green_coffee_id: coffee.id, ordered_quantity_g: 1000, unit_cost: "400" }],
      p_idempotency_key: uniq("po"),
    });
    expect(error?.message).toMatch(/supplier is not active/);
  });

  it("master records referenced by transactions cannot be hard-deleted (history preserved)", async () => {
    const { supplier, coffee } = await createMasterFixtures(owner, businessId);
    const { data: poId } = await owner.rpc("create_purchase_order", {
      p_business_id: businessId,
      p_supplier_id: supplier.id,
      p_ordered_at: "2026-10-31",
      p_notes: null as unknown as string,
      p_additional_costs: 0,
      p_items: [{ green_coffee_id: coffee.id, ordered_quantity_g: 1000, unit_cost: "400" }],
      p_idempotency_key: uniq("po"),
    });
    expect(poId).toBeTruthy();
    const del = await owner.from("suppliers").delete().eq("id", supplier.id);
    expect(del.error?.code).toBe("23503");
    const delCoffee = await owner.from("green_coffees").delete().eq("id", coffee.id);
    expect(delCoffee.error?.code).toBe("23503");
    // Deactivation is the supported path.
    const deactivate = await owner
      .from("suppliers")
      .update({ is_active: false })
      .eq("id", supplier.id)
      .select("is_active")
      .single();
    expect(deactivate.data?.is_active).toBe(false);
  });

  it("service role provisioning creates a business with defaults", async () => {
    const admin = adminClient();
    const email = `${uniq("prov").replace(/\s/g, "-").toLowerCase()}@coffee.test`;
    const { data: user, error } = await admin.auth.admin.createUser({
      email,
      password: "ProvPass123!",
      email_confirm: true,
    });
    expect(error).toBeNull();
    const { data: newBusinessId, error: bErr } = await admin.rpc("create_business_with_owner", {
      p_name: uniq("Provisioned"),
      p_owner_user_id: user.user!.id,
    });
    expect(bErr).toBeNull();
    const { data: roasters } = await admin
      .from("roasters")
      .select("name, capacity_g")
      .eq("business_id", newBusinessId!);
    expect(roasters).toEqual([{ name: "Yoshan DY-2kg", capacity_g: 2000 }]);
    const { data: member } = await admin
      .from("business_members")
      .select("role")
      .eq("business_id", newBusinessId!)
      .eq("user_id", user.user!.id)
      .single();
    expect(member?.role).toBe("owner");
    // authenticated users cannot call the provisioning function
    const { error: fErr } = await owner.rpc("create_business_with_owner", {
      p_name: "Hack",
      p_owner_user_id: user.user!.id,
    });
    expect(fErr).not.toBeNull();
  });
});
