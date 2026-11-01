"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/shared/form-field";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatPHP, toCentavos, allocateCentavos } from "@/lib/money";
import { kgToGrams } from "@/lib/units";
import { toManilaDateString } from "@/lib/units/time";
import { goodsReceiptSchema, type GoodsReceiptInput } from "../schemas";
import { receiveGoodsAction } from "../actions";

type FormValues = z.input<typeof goodsReceiptSchema>;

interface ItemInfo {
  purchase_order_item_id: string;
  coffee_name: string;
  ordered_g: number;
  received_g: number;
  unit_cost: number;
}

interface Props {
  purchaseOrderId: string;
  purchaseNumber: string;
  locations: { id: string; name: string }[];
  defaultLocationId: string | null;
  items: ItemInfo[];
}

export function ReceiveGoodsForm({
  purchaseOrderId,
  purchaseNumber,
  locations,
  defaultLocationId,
  items,
}: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const form = useForm<FormValues, unknown, GoodsReceiptInput>({
    resolver: zodResolver(goodsReceiptSchema),
    defaultValues: {
      purchase_order_id: purchaseOrderId,
      location_id: defaultLocationId ?? locations[0]?.id ?? "",
      received_at: toManilaDateString(),
      additional_costs: "0",
      notes: "",
      items: items.map((item) => ({
        purchase_order_item_id: item.purchase_order_item_id,
        quantity_kg: ((item.ordered_g - item.received_g) / 1000) as unknown as number,
        lot_code: "",
        moisture_pct: "" as unknown as number,
        density_g_per_100ml: "" as unknown as number,
        lot_notes: "",
      })),
    },
  });
  const errors = form.formState.errors;
  const watched = useWatch({ control: form.control });

  const preview = useMemo(() => {
    const grams = (watched.items ?? []).map((i) => {
      try {
        return kgToGrams(Number(i.quantity_kg) || 0);
      } catch {
        return 0;
      }
    });
    let landed = 0;
    try {
      landed = toCentavos(String(watched.additional_costs ?? "0") || "0");
    } catch {
      landed = 0;
    }
    const allocation = allocateCentavos(landed, grams);
    return items.map((item, idx) => {
      const g = grams[idx] ?? 0;
      const purchase = Math.round((g * item.unit_cost * 100) / 1000);
      const total = purchase + (g > 0 ? (allocation[idx] ?? 0) : 0);
      return {
        grams: g,
        purchase,
        landed: g > 0 ? (allocation[idx] ?? 0) : 0,
        total,
        over: item.received_g + g > item.ordered_g,
      };
    });
  }, [watched, items]);

  const totalGrams = preview.reduce((a, p) => a + p.grams, 0);
  const totalCost = preview.reduce((a, p) => a + p.total, 0);

  async function onSubmit(values: GoodsReceiptInput) {
    setFormError(null);
    const result = await receiveGoodsAction(values, idempotencyKey);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        form.setError(name as Path<FormValues>, { message: messages[0] });
      }
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success("Goods received and stock posted");
    router.push(`/purchases/receipts/${result.data.receiptId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="receive-goods-form"
    >
      <input type="hidden" {...form.register("purchase_order_id")} />
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt for {purchaseNumber}</CardTitle>
          <CardDescription>
            Posting this receipt increases green stock immediately. Partial receipts are allowed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField
            name="location_id"
            label="Receive into"
            error={errors.location_id?.message}
            required
          >
            <NativeSelect
              id="location_id"
              data-testid="select-location"
              {...form.register("location_id")}
            >
              <option value="">Select…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="received_at"
            label="Received on"
            error={errors.received_at?.message}
            required
          >
            <Input id="received_at" type="date" {...form.register("received_at")} />
          </FormField>
          <FormField
            name="additional_costs"
            label="Landed costs for this receipt (₱)"
            error={errors.additional_costs?.message}
            description="Allocated to lots by weight."
          >
            <Input
              id="additional_costs"
              inputMode="decimal"
              data-testid="input-landed-costs"
              {...form.register("additional_costs")}
            />
          </FormField>
          <FormField
            name="notes"
            label="Notes"
            error={errors.notes?.message}
            className="sm:col-span-3"
          >
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>
            Each received line becomes its own green coffee lot with its actual cost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {typeof errors.items?.message === "string" ? (
            <p className="text-destructive text-sm">{errors.items.message}</p>
          ) : null}
          {items.map((item, index) => {
            const itemErrors = errors.items?.[index];
            const p = preview[index];
            const remaining = item.ordered_g - item.received_g;
            return (
              <div
                key={item.purchase_order_item_id}
                className="space-y-3 rounded-md border p-3"
                data-testid="receipt-item-row"
              >
                <input type="hidden" {...form.register(`items.${index}.purchase_order_item_id`)} />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{item.coffee_name}</span>
                  <span className="text-muted-foreground text-xs">
                    Ordered <WeightDisplay grams={item.ordered_g} /> · Received{" "}
                    <WeightDisplay grams={item.received_g} /> · Remaining{" "}
                    <WeightDisplay grams={remaining} /> ·{" "}
                    {formatPHP(Math.round(item.unit_cost * 100))}/kg
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <FormField
                    name={`items.${index}.quantity_kg`}
                    label="Received (kg)"
                    error={
                      itemErrors?.quantity_kg?.message ??
                      (p?.over ? "Exceeds remaining ordered quantity" : undefined)
                    }
                    required
                  >
                    <Input
                      id={`items.${index}.quantity_kg`}
                      inputMode="decimal"
                      data-testid="input-received-kg"
                      {...form.register(`items.${index}.quantity_kg`)}
                    />
                  </FormField>
                  <FormField
                    name={`items.${index}.lot_code`}
                    label="Lot code"
                    error={itemErrors?.lot_code?.message}
                    description="Blank = auto-generated"
                  >
                    <Input
                      id={`items.${index}.lot_code`}
                      data-testid="input-lot-code"
                      {...form.register(`items.${index}.lot_code`)}
                    />
                  </FormField>
                  <FormField
                    name={`items.${index}.moisture_pct`}
                    label="Moisture %"
                    error={itemErrors?.moisture_pct?.message}
                    description="Optional"
                  >
                    <Input
                      id={`items.${index}.moisture_pct`}
                      inputMode="decimal"
                      {...form.register(`items.${index}.moisture_pct`)}
                    />
                  </FormField>
                  <FormField
                    name={`items.${index}.density_g_per_100ml`}
                    label="Density g/100ml"
                    error={itemErrors?.density_g_per_100ml?.message}
                    description="Optional"
                  >
                    <Input
                      id={`items.${index}.density_g_per_100ml`}
                      inputMode="decimal"
                      {...form.register(`items.${index}.density_g_per_100ml`)}
                    />
                  </FormField>
                </div>
                <div
                  className="text-muted-foreground flex flex-wrap gap-x-4 text-xs"
                  data-testid="receipt-item-preview"
                >
                  <span>
                    Purchase cost:{" "}
                    <span className="text-foreground tabular-nums">
                      {formatPHP(p?.purchase ?? 0)}
                    </span>
                  </span>
                  <span>
                    Landed share:{" "}
                    <span className="text-foreground tabular-nums">
                      {formatPHP(p?.landed ?? 0)}
                    </span>
                  </span>
                  <span>
                    Lot cost:{" "}
                    <span className="text-foreground tabular-nums">{formatPHP(p?.total ?? 0)}</span>
                  </span>
                </div>
              </div>
            );
          })}
          <div className="ml-auto grid w-full max-w-xs gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total weight</span>
              <span className="tabular-nums" data-testid="receipt-total-weight">
                <WeightDisplay grams={totalGrams} />
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total landed cost</span>
              <span className="tabular-nums" data-testid="receipt-total-cost">
                {formatPHP(totalCost)}
              </span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            PO-level additional costs are added to each lot proportionally when the receipt is
            posted.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting || totalGrams <= 0}
          data-testid="receive-submit"
        >
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          Post receipt
        </Button>
      </div>
    </form>
  );
}
