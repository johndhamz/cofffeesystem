/**
 * Sales arithmetic in integer centavos. Mirrors app.replace_order_items() / app.refresh_payment_status().
 */

export interface OrderLineInput {
  quantity: number;
  unitPriceCentavos: number;
  discountCentavos?: number;
}

function assertNonNegInt(v: number, name: string) {
  if (!Number.isInteger(v) || v < 0) throw new RangeError(`${name} must be a non-negative integer`);
}

export function lineTotalCentavos(line: OrderLineInput): number {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0)
    throw new RangeError("quantity must be a positive integer");
  assertNonNegInt(line.unitPriceCentavos, "unitPrice");
  assertNonNegInt(line.discountCentavos ?? 0, "discount");
  const gross = line.quantity * line.unitPriceCentavos;
  const discount = line.discountCentavos ?? 0;
  if (discount > gross) throw new RangeError("line discount exceeds the line amount");
  return gross - discount;
}

export interface OrderTotals {
  subtotalCentavos: number;
  lineDiscountCentavos: number;
  orderDiscountCentavos: number;
  totalCentavos: number;
}

/** subtotal = Σ qty × price; total = Σ line totals − order discount (never below zero). */
export function orderTotals(lines: OrderLineInput[], orderDiscountCentavos = 0): OrderTotals {
  assertNonNegInt(orderDiscountCentavos, "orderDiscount");
  const subtotal = lines.reduce((a, l) => a + l.quantity * l.unitPriceCentavos, 0);
  const lineTotals = lines.reduce((a, l) => a + lineTotalCentavos(l), 0);
  const lineDiscount = subtotal - lineTotals;
  return {
    subtotalCentavos: subtotal,
    lineDiscountCentavos: lineDiscount,
    orderDiscountCentavos: orderDiscountCentavos,
    totalCentavos: Math.max(0, lineTotals - orderDiscountCentavos),
  };
}

export type PaymentStatus =
  "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded";

export interface PaymentBalance {
  paidCentavos: number;
  refundedCentavos: number;
  netPaidCentavos: number;
  outstandingCentavos: number;
  status: PaymentStatus;
}

export function paymentBalance(
  totalCentavos: number,
  paymentsCentavos: number[],
  refundsCentavos: number[] = [],
): PaymentBalance {
  assertNonNegInt(totalCentavos, "total");
  const paid = paymentsCentavos.reduce((a, p) => {
    if (!Number.isInteger(p) || p <= 0)
      throw new RangeError("payments must be positive integer centavos");
    return a + p;
  }, 0);
  const refunded = refundsCentavos.reduce((a, r) => {
    if (!Number.isInteger(r) || r <= 0)
      throw new RangeError("refunds must be positive integer centavos");
    return a + r;
  }, 0);
  if (refunded > paid) throw new RangeError("refunds cannot exceed payments");
  const net = paid - refunded;
  let status: PaymentStatus;
  if (refunded > 0 && net <= 0) status = "refunded";
  else if (refunded > 0) status = "partially_refunded";
  else if (totalCentavos > 0 && net >= totalCentavos) status = "paid";
  else if (net > 0) status = "partially_paid";
  else status = "unpaid";
  return {
    paidCentavos: paid,
    refundedCentavos: refunded,
    netPaidCentavos: net,
    outstandingCentavos: Math.max(0, totalCentavos - net),
    status,
  };
}

/** Maximum refundable amount for one payment. */
export function refundableCentavos(
  paymentCentavos: number,
  alreadyRefundedCentavos: number,
): number {
  assertNonNegInt(paymentCentavos, "payment");
  assertNonNegInt(alreadyRefundedCentavos, "alreadyRefunded");
  return Math.max(0, paymentCentavos - alreadyRefundedCentavos);
}

/** Gross profit on a fulfilled line: revenue − COGS. */
export function grossProfitCentavos(revenueCentavos: number, cogsCentavos: number): number {
  return revenueCentavos - cogsCentavos;
}

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "other", label: "Other" },
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  reserved: "Reserved",
  partially_fulfilled: "Partially fulfilled",
  fulfilled: "Fulfilled",
  completed: "Completed",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export function orderTone(status: string): "success" | "info" | "danger" | "warning" | "neutral" {
  if (["fulfilled", "completed"].includes(status)) return "success";
  if (["reserved", "confirmed", "partially_fulfilled"].includes(status)) return "info";
  if (status === "cancelled") return "danger";
  if (status === "returned") return "warning";
  return "neutral";
}

export function paymentTone(status: string): "success" | "info" | "warning" | "neutral" {
  if (status === "paid") return "success";
  if (status === "partially_paid") return "warning";
  if (status.includes("refund")) return "info";
  return "neutral";
}
