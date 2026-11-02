import { describe, expect, it } from "vitest";
import {
  groupOrders,
  parseRow,
  planOpeningStock,
  type ResolvedRow,
} from "@/lib/sales/history-import";

function resolved(over: Partial<ResolvedRow> & { rowNumber: number }): ResolvedRow {
  return {
    date: "2026-09-03",
    channel: "Walk-in",
    customer: "",
    product: "House Blend",
    variant: "250 g",
    quantity: 1,
    unit_price: 350,
    unit_cost: 180,
    paid: true,
    payment_method: "cash",
    reference: "",
    notes: "",
    variant_id: "v1",
    variant_label: "House Blend — 250 g",
    sales_channel_id: "c1",
    ...over,
  };
}

describe("sales history import: row parsing", () => {
  it("accepts a complete row with defaults for optional cells", () => {
    const r = parseRow({
      rowNumber: 2,
      values: {
        Date: "2026-09-03",
        Channel: "Walk-in",
        Product: "House Blend",
        Quantity: "2",
        "Unit price": "350",
      },
    });
    expect(r.row).toMatchObject({
      quantity: 2,
      unit_price: 350,
      paid: true,
      payment_method: "cash",
      customer: "",
      unit_cost: undefined,
    });
  });

  it("reports every problem on a row with the row number", () => {
    const r = parseRow({
      rowNumber: 7,
      values: {
        Date: "3 Sep",
        Channel: "",
        Product: "X",
        Quantity: "1.5",
        "Unit price": "-1",
        Paid: "maybe",
        "Payment method": "card",
      },
    });
    expect(r.row).toBeNull();
    const msgs = r.errors.map((e) => e.message).join("\n");
    expect(r.errors.every((e) => e.rowNumber === 7)).toBe(true);
    expect(msgs).toMatch(/date/i);
    expect(msgs).toMatch(/channel/i);
    expect(msgs).toMatch(/quantity/i);
    expect(msgs).toMatch(/unit_price/i);
    expect(msgs).toMatch(/paid/i);
    expect(msgs).toMatch(/payment_method/i);
  });

  it("normalises payment methods and yes/no spellings", () => {
    const r = parseRow({
      rowNumber: 2,
      values: {
        Date: "2026-09-03",
        Channel: "A",
        Product: "B",
        Quantity: "1",
        "Unit price": "1",
        Paid: "No",
        "Payment method": "Bank",
      },
    });
    expect(r.row).toMatchObject({ paid: false, payment_method: "bank_transfer" });
  });
});

describe("sales history import: grouping", () => {
  it("combines rows with the same date, channel, customer and reference into one order", () => {
    const orders = groupOrders([
      resolved({ rowNumber: 2, quantity: 2 }),
      resolved({
        rowNumber: 3,
        variant_id: "v2",
        variant_label: "Benguet — 250 g",
        unit_price: 420,
      }),
      resolved({
        rowNumber: 4,
        date: "2026-09-05",
        customer: "Cafe Luna",
        paid: false,
        unit_price: 1100,
        quantity: 5,
      }),
      resolved({ rowNumber: 5, quantity: 1 }), // same order as row 2: merges into the same line
    ]);
    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({
      key: "1",
      ordered_at: "2026-09-03",
      total: 1470,
      paid_amount: 1470,
      rowNumbers: [2, 3, 5],
    });
    expect(orders[0].items).toEqual([
      { product_variant_id: "v1", label: "House Blend — 250 g", quantity: 3, unit_price: 350 },
      { product_variant_id: "v2", label: "Benguet — 250 g", quantity: 1, unit_price: 420 },
    ]);
    expect(orders[1]).toMatchObject({
      key: "2",
      customer_name: "Cafe Luna",
      total: 5500,
      paid_amount: 0,
    });
  });

  it("keeps money exact in centavos", () => {
    const orders = groupOrders([
      resolved({ rowNumber: 2, unit_price: 0.1, quantity: 3 }),
      resolved({ rowNumber: 3, unit_price: 0.2, quantity: 1 }),
    ]);
    expect(orders[0].total).toBe(0.5);
  });
});

describe("sales history import: opening stock plan", () => {
  it("creates one lot per variant for the full sold quantity at the weighted average cost, dated at the first sale", () => {
    const plan = planOpeningStock([
      resolved({ rowNumber: 2, quantity: 2, unit_cost: 180, date: "2026-09-10" }),
      resolved({ rowNumber: 3, quantity: 2, unit_cost: 200, date: "2026-09-01" }),
      resolved({
        rowNumber: 4,
        quantity: 5,
        unit_cost: undefined,
        variant_id: "v2",
        variant_label: "B",
      }),
    ]);
    expect(plan).toEqual([
      {
        variant_id: "v2",
        label: "B",
        quantity: 5,
        unit_cost: 0,
        packaged_at: "2026-09-03",
        cost_known: false,
      },
      {
        variant_id: "v1",
        label: "House Blend — 250 g",
        quantity: 4,
        unit_cost: 190,
        packaged_at: "2026-09-01",
        cost_known: true,
      },
    ]);
  });
});
