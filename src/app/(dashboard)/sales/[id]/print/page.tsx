import { formatManilaDate } from "@/lib/units/time";
import { formatPHP, toCentavos } from "@/lib/money";
import { getSessionContext } from "@/lib/auth/session";
import { getSalesOrder } from "@/server/services/sales.service";
import { PAYMENT_STATUS_LABELS } from "@/lib/sales/calculations";

/** Printable sales document (invoice / delivery note). Server-rendered; uses print styles. */
export default async function PrintOrderPage({ params }: PageProps<"/sales/[id]/print">) {
  const { id } = await params;
  const [ctx, { summary, detail }] = await Promise.all([getSessionContext(), getSalesOrder(id)]);
  const items = detail.sales_order_items ?? [];
  return (
    <div
      className="mx-auto max-w-3xl bg-white p-8 text-sm text-black print:p-0"
      data-testid="print-document"
    >
      <style>{`@media print { nav, header, aside, [data-testid="topnav"], [data-testid="sidebar"] { display: none !important; } main { padding: 0 !important; } }`}</style>
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{ctx?.business?.businessName}</h1>
          <p className="text-muted-foreground">Sales document</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{detail.order_number}</p>
          <p>Date: {formatManilaDate(detail.ordered_at)}</p>
          {detail.due_at ? <p>Due: {formatManilaDate(detail.due_at)}</p> : null}
          <p>Channel: {summary.channel_name}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 py-4">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Bill to</p>
          <p className="font-medium">{detail.customers?.name ?? "Walk-in customer"}</p>
          {detail.customers?.address ? (
            <p className="whitespace-pre-wrap">{detail.customers.address}</p>
          ) : null}
          {detail.customers?.phone ? <p>{detail.customers.phone}</p> : null}
          {detail.customers?.email ? <p>{detail.customers.email}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs uppercase">Payment</p>
          <p className="font-medium">{PAYMENT_STATUS_LABELS[detail.payment_status]}</p>
          <p>
            Paid {formatPHP(toCentavos(detail.amount_paid - detail.amount_refunded))} · Balance{" "}
            {formatPHP(toCentavos(summary.outstanding_amount ?? 0))}
          </p>
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit price</th>
            <th className="py-2 text-right">Discount</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b">
              <td className="py-2">
                {i.product_variants?.products?.name} {i.product_variants?.name}
                <span className="text-muted-foreground block text-xs">
                  {i.product_variants?.sku}
                </span>
              </td>
              <td className="py-2 text-right">{i.quantity}</td>
              <td className="py-2 text-right">{formatPHP(toCentavos(i.unit_price))}</td>
              <td className="py-2 text-right">{formatPHP(toCentavos(i.discount_amount))}</td>
              <td className="py-2 text-right">{formatPHP(toCentavos(i.line_total))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="pt-3 text-right">
              Subtotal
            </td>
            <td className="pt-3 text-right">{formatPHP(toCentavos(detail.subtotal))}</td>
          </tr>
          {detail.discount_amount > 0 ? (
            <tr>
              <td colSpan={4} className="text-right">
                Order discount
              </td>
              <td className="text-right">−{formatPHP(toCentavos(detail.discount_amount))}</td>
            </tr>
          ) : null}
          <tr className="font-bold">
            <td colSpan={4} className="pt-1 text-right">
              Total
            </td>
            <td className="pt-1 text-right">{formatPHP(toCentavos(detail.total_amount))}</td>
          </tr>
        </tfoot>
      </table>
      {detail.notes ? <p className="mt-4 whitespace-pre-wrap">{detail.notes}</p> : null}
      <p className="text-muted-foreground mt-8 text-xs">
        Thank you for your order. Prices in Philippine Peso. This is a management document, not an
        official receipt.
      </p>
    </div>
  );
}
