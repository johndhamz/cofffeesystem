import { describe, expect, it } from "vitest";

describe("duration entry in minutes", () => {
  it("parses minutes, mm:ss and m/s notation into whole seconds", async () => {
    const { parseMinutesToSeconds, secondsToMinutesText } =
      await import("@/lib/roasting/calculations");
    expect(parseMinutesToSeconds("10")).toBe(600);
    expect(parseMinutesToSeconds("10.5")).toBe(630);
    expect(parseMinutesToSeconds("10:30")).toBe(630);
    expect(parseMinutesToSeconds(" 8:05 ")).toBe(485);
    expect(parseMinutesToSeconds("10m 30s")).toBe(630);
    expect(parseMinutesToSeconds("45s")).toBe(45);
    expect(parseMinutesToSeconds(12)).toBe(720);
    expect(parseMinutesToSeconds("")).toBeNull();
    expect(parseMinutesToSeconds("10:75")).toBeNull();
    expect(parseMinutesToSeconds("abc")).toBeNull();
    expect(secondsToMinutesText(630)).toBe("10:30");
    expect(secondsToMinutesText(null)).toBe("");
  });

  it("the completion schema stores seconds and still rejects first crack after drop", async () => {
    const { roastCompletionSchema } = await import("@/features/roasting/schemas");
    const ok = roastCompletionSchema.safeParse({
      roasted_weight_g: 1260,
      total_duration_seconds: "10:30",
      first_crack_seconds: "8",
    });
    expect(ok.success).toBe(true);
    if (ok.success)
      expect(ok.data).toMatchObject({ total_duration_seconds: 630, first_crack_seconds: 480 });
    const bad = roastCompletionSchema.safeParse({
      roasted_weight_g: 1260,
      total_duration_seconds: "8",
      first_crack_seconds: "10:30",
    });
    expect(bad.success).toBe(false);
    const nonsense = roastCompletionSchema.safeParse({
      roasted_weight_g: 1260,
      total_duration_seconds: "ten",
    });
    expect(nonsense.success).toBe(false);
    if (!nonsense.success) expect(nonsense.error.issues[0]?.message).toMatch(/minutes/i);
  });
});

describe("LPG cost estimate from duration", () => {
  it("uses hours x kg/h at the fixed profile x price per kg, rounded to centavos", async () => {
    const { estimateLpgCost } = await import("@/lib/roasting/calculations");
    // 10 min at 0.2 kg/h = 0.0333 kg; x PHP 127/kg = PHP 4.2333 -> 4.23
    const e = estimateLpgCost({ durationSeconds: 600, kgPerHour: 0.2, pricePerKg: 127 });
    expect(e?.kg).toBeCloseTo(0.0333, 4);
    expect(e?.centavos).toBe(423);
    expect(e?.amount).toBe("4.23");
    // 9:30 (the standard profile) -> 0.0317 kg -> PHP 4.02
    expect(estimateLpgCost({ durationSeconds: 570, kgPerHour: 0.2, pricePerKg: 127 })?.amount).toBe(
      "4.02",
    );
  });

  it("returns null when disabled or when the duration is missing", async () => {
    const { estimateLpgCost } = await import("@/lib/roasting/calculations");
    expect(estimateLpgCost({ durationSeconds: 600, kgPerHour: 0, pricePerKg: 127 })).toBeNull();
    expect(estimateLpgCost({ durationSeconds: 600, kgPerHour: 0.2, pricePerKg: 0 })).toBeNull();
    expect(estimateLpgCost({ durationSeconds: null, kgPerHour: 0.2, pricePerKg: 127 })).toBeNull();
    expect(estimateLpgCost({ durationSeconds: 0, kgPerHour: 0.2, pricePerKg: 127 })).toBeNull();
    expect(estimateLpgCost({ durationSeconds: NaN, kgPerHour: 0.2, pricePerKg: 127 })).toBeNull();
  });

  it("settings schema accepts decimal text and rejects negatives or too many decimals", async () => {
    const { businessSettingsSchema } = await import("@/features/settings/schemas");
    const base = {
      business_name: "Alamat",
      currency: "PHP",
      timezone: "Asia/Manila",
      inventory_weight_unit: "g",
      costing_method: "lot_actual",
      default_roaster_id: "",
      default_location_id: "",
      require_mfa: false,
    };
    const ok = businessSettingsSchema.parse({
      ...base,
      lpg_price_per_kg: "127.50",
      lpg_kg_per_hour: "0.2",
      lpg_profile_avg_kpa: 1.9,
    });
    expect(ok.lpg_price_per_kg).toBe(127.5);
    expect(ok.lpg_kg_per_hour).toBe(0.2);
    expect(ok.lpg_profile_avg_kpa).toBe(1.9);
    expect(businessSettingsSchema.safeParse({ ...ok, lpg_kg_per_hour: "-1" }).success).toBe(false);
    expect(businessSettingsSchema.safeParse({ ...ok, lpg_price_per_kg: "1.234" }).success).toBe(
      false,
    );
  });
});
