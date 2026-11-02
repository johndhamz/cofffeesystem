"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DownloadIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormField } from "@/components/shared/form-field";
import { formatPHP, toCentavos } from "@/lib/money";
import { formatManilaDate } from "@/lib/units/time";
import type { ImportPreview, ImportResult } from "@/server/services/sales-import.service";
import { commitSalesImportAction, previewSalesImportAction } from "../import-actions";

interface Props {
  locations: { id: string; name: string }[];
  defaultLocationId: string | null;
}

export function ImportWizard({ locations, defaultLocationId }: Props) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const r = await previewSalesImportAction(new FormData(e.currentTarget));
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    setPreview(r.data);
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const r = await commitSalesImportAction({
      batchKey: preview.batchKey,
      locationId: preview.locationId,
      opening: preview.opening.map(({ variant_id, quantity, unit_cost, packaged_at }) => ({
        variant_id,
        quantity,
        unit_cost,
        packaged_at,
      })),
      orders: preview.orders.map((o) => ({
        key: o.key,
        ordered_at: o.ordered_at,
        sales_channel_id: o.sales_channel_id,
        customer_name: o.customer_name,
        notes: o.notes,
        payment_method: o.payment_method,
        payment_reference: o.payment_reference,
        paid_amount: o.paid_amount,
        items: o.items.map(({ product_variant_id, quantity, unit_price }) => ({
          product_variant_id,
          quantity,
          unit_price,
        })),
      })),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    setResult(r.data);
    setPreview(null);
    toast.success(`Imported ${r.data.orders_created} orders`);
  }

  const canImport = !!preview && preview.errors.length === 0 && preview.orders.length > 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Fill the template</CardTitle>
          <CardDescription>
            One row per product sold. Rows with the same date, channel, customer and reference
            become one order. Product, variant and channel names must match your catalog.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a
              href="/templates/sales-history-template.xlsx"
              download
              data-testid="download-template"
            >
              <DownloadIcon /> Download Excel template
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Upload and check</CardTitle>
          <CardDescription>
            Nothing is saved yet: you will see every order and any problem first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={check}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            data-testid="import-form"
          >
            <FormField name="file" label="Excel file (.xlsx)" required>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                data-testid="import-file"
              />
            </FormField>
            <FormField name="location_id" label="Stock location">
              <NativeSelect
                id="location_id"
                name="location_id"
                defaultValue={defaultLocationId ?? locations[0]?.id ?? ""}
                data-testid="import-location"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <Button type="submit" disabled={busy} data-testid="import-check">
              {busy && !preview ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Check
              file
            </Button>
          </form>
          {error ? (
            <Alert variant="destructive" className="mt-4" data-testid="import-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card data-testid="import-preview">
          <CardHeader>
            <CardTitle className="text-base">3. Review</CardTitle>
            <CardDescription>
              {preview.fileName}: {preview.rowCount} rows → {preview.totals.orders} orders,{" "}
              {preview.totals.units} units, {formatPHP(toCentavos(preview.totals.revenue))} revenue
              ({formatPHP(toCentavos(preview.totals.paid))} marked paid).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.errors.length ? (
              <Alert variant="destructive" data-testid="import-row-errors">
                <AlertTitle>
                  {preview.errors.length} problem{preview.errors.length === 1 ? "" : "s"} to fix in
                  the file
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {preview.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        Row {e.rowNumber}: {e.message}
                      </li>
                    ))}
                    {preview.errors.length > 50 ? (
                      <li>… and {preview.errors.length - 50} more</li>
                    ) : null}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
            {preview.warnings.map((w) => (
              <Alert key={w} data-testid="import-warning">
                <AlertDescription>{w}</AlertDescription>
              </Alert>
            ))}

            <div>
              <h3 className="mb-2 text-sm font-medium">Opening stock that will be created</h3>
              <p className="text-muted-foreground mb-2 text-xs">
                Historical sales are fulfilled from these lots (dated at the first sale), never from
                your current stock.
              </p>
              <div className="overflow-x-auto rounded-md border">
                <Table data-testid="import-opening">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Unit cost</TableHead>
                      <TableHead>Dated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.opening.map((o) => (
                      <TableRow key={o.variant_id}>
                        <TableCell>{o.label}</TableCell>
                        <TableCell className="text-right">{o.quantity}</TableCell>
                        <TableCell className="text-right">
                          {o.cost_known ? (
                            formatPHP(toCentavos(o.unit_cost))
                          ) : (
                            <span className="text-amber-700">₱0.00 (no cost given)</span>
                          )}
                        </TableCell>
                        <TableCell>{formatManilaDate(o.packaged_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Orders ({preview.orders.length})</h3>
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table data-testid="import-orders">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.orders.map((o) => (
                      <TableRow key={o.key}>
                        <TableCell>{formatManilaDate(o.ordered_at)}</TableCell>
                        <TableCell>{o.channel}</TableCell>
                        <TableCell>
                          {o.customer_name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.items
                            .map(
                              (i) =>
                                `${i.quantity} × ${i.label} @ ${formatPHP(toCentavos(i.unit_price))}`,
                            )
                            .join("; ")}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPHP(toCentavos(o.total))}
                        </TableCell>
                        <TableCell>
                          {o.paid_amount > 0 ? `${o.payment_method}` : "unpaid"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {o.rowNumbers.join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={commit} disabled={!canImport || busy} data-testid="import-commit">
                {busy ? <Loader2Icon className="animate-spin" /> : null} Import{" "}
                {preview.orders.length} orders
              </Button>
              {!canImport && preview.errors.length ? (
                <span className="text-muted-foreground text-sm">
                  Fix the problems above and check the file again.
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Alert data-testid="import-result">
          <AlertTitle>Import finished</AlertTitle>
          <AlertDescription>
            {result.orders_created} orders created ({result.orders_skipped} already imported
            earlier), {result.lots_created} opening lots, {result.units} units,{" "}
            {formatPHP(toCentavos(result.revenue))} revenue. See{" "}
            <Link href="/sales/history" className="underline">
              Sales → History
            </Link>{" "}
            and the{" "}
            <Link href="/reports/profitability" className="underline">
              profitability report
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
