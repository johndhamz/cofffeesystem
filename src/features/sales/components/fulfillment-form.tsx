"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
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
import { toManilaDateString } from "@/lib/units/time";
import { fulfillmentSchema, type FulfillmentInput } from "../schemas";
import { fulfillSalesOrderAction } from "../actions";

type FormValues = z.input<typeof fulfillmentSchema>;

export interface FulfillmentLine {
  order_item_id: string;
  label: string;
  outstanding: number;
  lots: { lot_id: string; lot_code: string; available: number; reserved_for_order: number }[];
}

export function FulfillmentForm({
  orderId,
  orderNumber,
  lines,
  locations,
  defaultLocationId,
}: {
  orderId: string;
  orderNumber: string;
  lines: FulfillmentLine[];
  locations: { id: string; name: string }[];
  defaultLocationId: string | null;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const form = useForm<FormValues, unknown, FulfillmentInput>({
    resolver: zodResolver(fulfillmentSchema),
    defaultValues: {
      location_id: defaultLocationId ?? "",
      fulfilled_at: toManilaDateString(),
      notes: "",
      items: lines.map((l) => {
        const preferred = l.lots.find((x) => x.reserved_for_order > 0) ?? l.lots[0];
        return {
          order_item_id: l.order_item_id,
          finished_goods_lot_id: preferred?.lot_id ?? "",
          quantity: Math.min(
            l.outstanding,
            preferred ? preferred.reserved_for_order || preferred.available : 0,
          ),
        };
      }),
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: FulfillmentInput) {
    setFormError(null);
    const r = await fulfillSalesOrderAction(orderId, values, key);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      setFormError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success("Fulfilled — stock deducted and cost snapshot saved");
    router.push(`/sales/${orderId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="fulfillment-form"
    >
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fulfil {orderNumber}</CardTitle>
          <CardDescription>
            Choose the finished lot per line. Reserved lots are pre-selected. Posting deducts stock
            and snapshots the unit cost.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField name="location_id" label="Ship from" error={errors.location_id?.message}>
            <NativeSelect id="location_id" {...form.register("location_id")}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField name="fulfilled_at" label="Date" error={errors.fulfilled_at?.message} required>
            <Input id="fulfilled_at" type="date" {...form.register("fulfilled_at")} />
          </FormField>
          <FormField name="notes" label="Notes" error={errors.notes?.message}>
            <Textarea id="fulfil_notes" rows={1} {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((l, i) => (
            <div
              key={l.order_item_id}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_120px] sm:items-end"
              data-testid="fulfil-line"
            >
              <input type="hidden" {...form.register(`items.${i}.order_item_id`)} />
              <div className="text-sm">
                <p className="font-medium">{l.label}</p>
                <p className="text-muted-foreground text-xs">{l.outstanding} outstanding</p>
              </div>
              <FormField
                name={`items.${i}.finished_goods_lot_id`}
                label="Finished lot"
                error={errors.items?.[i]?.finished_goods_lot_id?.message}
              >
                <NativeSelect
                  id={`items.${i}.finished_goods_lot_id`}
                  data-testid="select-lot"
                  {...form.register(`items.${i}.finished_goods_lot_id`)}
                >
                  {l.lots.length === 0 ? <option value="">No stock</option> : null}
                  {l.lots.map((x) => (
                    <option key={x.lot_id} value={x.lot_id}>
                      {x.lot_code} — {x.available} avail.
                      {x.reserved_for_order
                        ? ` (${x.reserved_for_order} reserved for this order)`
                        : ""}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                name={`items.${i}.quantity`}
                label="Ship qty"
                error={errors.items?.[i]?.quantity?.message}
              >
                <Input
                  id={`items.${i}.quantity`}
                  inputMode="numeric"
                  data-testid="input-ship-qty"
                  {...form.register(`items.${i}.quantity`)}
                />
              </FormField>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting} data-testid="fulfil-submit">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}Post
          fulfilment
        </Button>
      </div>
    </form>
  );
}
