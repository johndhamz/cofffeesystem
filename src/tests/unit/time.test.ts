import { describe, expect, it } from "vitest";
import {
  formatManilaDate,
  formatManilaDateTime,
  startOfManilaDay,
  timezoneOffsetMinutes,
  toManilaDateString,
} from "@/lib/units/time";

describe("Philippine timezone helpers", () => {
  it("reports Manila as UTC+8 with no DST", () => {
    expect(timezoneOffsetMinutes(new Date("2026-01-15T00:00:00Z"))).toBe(480);
    expect(timezoneOffsetMinutes(new Date("2026-07-15T00:00:00Z"))).toBe(480);
  });

  it("converts an instant to the Manila calendar date", () => {
    // 23:30 UTC on Oct 31 is already Nov 1 in Manila
    expect(toManilaDateString("2026-10-31T23:30:00Z")).toBe("2026-11-01");
    expect(toManilaDateString("2026-10-31T15:59:59Z")).toBe("2026-10-31");
  });

  it("formats dates for display", () => {
    expect(formatManilaDate("2026-10-31")).toMatch(/31 Oct 2026/);
    expect(formatManilaDate(null)).toBe("—");
    expect(formatManilaDateTime("2026-10-31T06:05:00Z")).toMatch(/31 Oct 2026/);
    expect(formatManilaDateTime("2026-10-31T06:05:00Z")).toMatch(/2:05/);
  });

  it("computes the UTC instant for the start of a Manila day", () => {
    expect(startOfManilaDay("2026-10-31").toISOString()).toBe("2026-10-30T16:00:00.000Z");
  });

  it("rejects invalid dates", () => {
    expect(() => toManilaDateString("not-a-date")).toThrow();
  });
});
