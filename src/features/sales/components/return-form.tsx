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
import { returnSchema, type ReturnInput } from "../schemas";
import { createSalesReturnAction } from "../actions";

type FormValues = z.input<typeof returnSchema>;

export interface ReturnLine {
  fulfillment_item_id: string;
  label: string;
  lot_code: string;
  returnable: number;
}

export function ReturnForm({
  orderId,
  orderNumber,
  lines,
  locations,
  defaultLocationId,
}: {
  orderId: string;
  orderNumber: string;
  lines: ReturnLine[];
  locations: { id: string; name: string }[];
  defaultLocationId: string | null;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const form = useForm<FormValues, unknown, ReturnInput>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      location_id: defaultLocationId ?? "",
      reason: "",
      received_at: toManilaDateString(),
      notes: "",
      items: lines.map((l) => ({
        fulfillment_item_id: l.fulfillment_item_id,
        quantity: 0,
        condition: "sealed",
        disposition: "restock",
      })),
    },
  });
  const errors = form.formState.errors;
  async function onSubmit(values: ReturnInput) {
    setFormError(null);
    const r = await createSalesReturnAction(orderId, values, key);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      setFormError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success("Return recorded");
    router.push(`/sales/${orderId}`);
    router.refresh();
  }
  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="return-form"
    >
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Return for {orderNumber}</CardTitle>
          <CardDescription>
            Inspect each item and choose a disposition. Only sealed items marked Restock re-enter
            sellable stock; refunds are recorded separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField name="reason" label="Reason" error={errors.reason?.message} required>
            <Input
              id="return_reason"
              data-testid="input-return-reason"
              {...form.register("reason")}
            />
          </FormField>
          <FormField
            name="received_at"
            label="Received on"
            error={errors.received_at?.message}
            required
          >
            <Input id="return_received_at" type="date" {...form.register("received_at")} />
          </FormField>
          <FormField name="location_id" label="Receive into" error={errors.location_id?.message}>
            <NativeSelect id="return_location_id" {...form.register("location_id")}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="notes"
            label="Notes"
            error={errors.notes?.message}
            className="sm:col-span-3"
          >
            <Textarea id="return_notes" rows={1} {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((l, i) => (
            <div
              key={l.fulfillment_item_id}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_100px_140px_150px] sm:items-end"
              data-testid="return-line"
            >
              <input type="hidden" {...form.register(`items.${i}.fulfillment_item_id`)} />
              <div className="text-sm">
                <p className="font-medium">{l.label}</p>
                <p className="text-muted-foreground text-xs">
                  Lot {l.lot_code} · {l.returnable} returnable
                </p>
              </div>
              <FormField
                name={`items.${i}.quantity`}
                label="Qty"
                error={errors.items?.[i]?.quantity?.message}
              >
                <Input
                  id={`items.${i}.quantity`}
                  inputMode="numeric"
                  data-testid="input-return-qty"
                  {...form.register(`items.${i}.quantity`)}
                />
              </FormField>
              <FormField
                name={`items.${i}.condition`}
                label="Condition"
                error={errors.items?.[i]?.condition?.message}
              >
                <NativeSelect
                  id={`items.${i}.condition`}
                  data-testid="select-condition"
                  {...form.register(`items.${i}.condition`)}
                >
                  <option value="sealed">Sealed</option>
                  <option value="opened">Opened</option>
                  <option value="damaged">Damaged</option>
                </NativeSelect>
              </FormField>
              <FormField
                name={`items.${i}.disposition`}
                label="Disposition"
                error={errors.items?.[i]?.disposition?.message}
              >
                <NativeSelect
                  id={`items.${i}.disposition`}
                  data-testid="select-disposition"
                  {...form.register(`items.${i}.disposition`)}
                >
                  <option value="restock">Restock (sellable)</option>
                  <option value="quarantine">Quarantine</option>
                  <option value="waste">Waste</option>
                </NativeSelect>
              </FormField>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting} data-testid="return-submit">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}Record
          return
        </Button>
      </div>
    </form>
  );
}
