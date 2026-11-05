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
