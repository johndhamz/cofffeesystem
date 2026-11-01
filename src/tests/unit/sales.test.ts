import { describe, expect, it } from "vitest";
import {
  grossProfitCentavos,
  lineTotalCentavos,
  orderTotals,
  paymentBalance,
  refundableCentavos,
} from "@/lib/sales/calculations";

describe("sales calculations", () => {
  it("computes line totals with discounts", () => {
    expect(lineTotalCentavos({ quantity: 3, unitPriceCentavos: 35_000 })).toBe(105_000);
    expect(
      lineTotalCentavos({ quantity: 3, unitPriceCentavos: 35_000, discountCentavos: 5_000 }),
    ).toBe(100_000);
    expect(() => lineTotalCentavos({ quantity: 0, unitPriceCentavos: 1 })).toThrow();
    expect(() =>
      lineTotalCentavos({ quantity: 1, unitPriceCentavos: 100, discountCentavos: 101 }),
    ).toThrow(/exceeds/);
  });

  it("computes order totals with line and order discounts", () => {
    const t = orderTotals(
      [
        { quantity: 3, unitPriceCentavos: 35_000, discountCentavos: 5_000 },
        { quantity: 1, unitPriceCentavos: 60_000 },
      ],
      10_000,
    );
    expect(t).toEqual({
      subtotalCentavos: 165_000,
      lineDiscountCentavos: 5_000,
      orderDiscountCentavos: 10_000,
      totalCentavos: 150_000,
    });
    expect(orderTotals([{ quantity: 1, unitPriceCentavos: 100 }], 500).totalCentavos).toBe(0);
  });

  it("derives payment status and balances", () => {
    expect(paymentBalance(105_000, [])).toMatchObject({
      status: "unpaid",
      outstandingCentavos: 105_000,
    });
    expect(paymentBalance(105_000, [50_000])).toMatchObject({
      status: "partially_paid",
      outstandingCentavos: 55_000,
    });
    expect(paymentBalance(105_000, [50_000, 55_000])).toMatchObject({
      status: "paid",
      outstandingCentavos: 0,
    });
    expect(paymentBalance(105_000, [105_000], [30_000])).toMatchObject({
      status: "partially_refunded",
      netPaidCentavos: 75_000,
      outstandingCentavos: 30_000,
    });
    expect(paymentBalance(105_000, [105_000], [105_000])).toMatchObject({
      status: "refunded",
      netPaidCentavos: 0,
    });
    expect(() => paymentBalance(100, [50], [60])).toThrow(/exceed/);
    expect(() => paymentBalance(100, [0])).toThrow();
  });

  it("limits refunds to the payment", () => {
    expect(refundableCentavos(50_000, 0)).toBe(50_000);
    expect(refundableCentavos(50_000, 20_000)).toBe(30_000);
    expect(refundableCentavos(50_000, 50_000)).toBe(0);
  });

  it("computes gross profit", () => {
    expect(grossProfitCentavos(105_000, 47_961)).toBe(57_039);
  });
});
