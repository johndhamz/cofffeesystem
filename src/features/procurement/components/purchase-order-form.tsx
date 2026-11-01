"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/shared/form-field";
import { formatPHP, toCentavos } from "@/lib/money";
import { toManilaDateString } from "@/lib/units/time";
import { purchaseOrderSchema, type PurchaseOrderInput } from "../schemas";
import { createPurchaseOrderAction, updatePurchaseOrderDraftAction } from "../actions";

type FormValues = z.input<typeof purchaseOrderSchema>;

interface Props {
  suppliers: { id: string; name: string }[];
  greenCoffees: { id: string; name: string }[];
  initial?: { id: string; values: FormValues };
}

export function PurchaseOrderForm({ suppliers, greenCoffees, initial }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // One idempotency key per form instance: retries of the same submission never create duplicates.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const form = useForm<FormValues, unknown, PurchaseOrderInput>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: initial?.values ?? {
      supplier_id: "",
      ordered_at: toManilaDateString(),
      notes: "",
      additional_costs: "0",
      items: [{ green_coffee_id: "", quantity_kg: "" as unknown as number, unit_cost: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const errors = form.formState.errors;
  const watched = useWatch({ control: form.control });

  const totals = useMemo(() => {
    const lines = (watched.items ?? []).map((item) => {
      const kg = Number(item.quantity_kg);
      const cost = Number(item.unit_cost);
      if (!Number.isFinite(kg) || !Number.isFinite(cost) || kg <= 0 || cost < 0) return 0;
      return Math.round(kg * cost * 100);
    });
    const subtotal = lines.reduce((a, b) => a + b, 0);
    let additional = 0;
    try {
      additional = toCentavos(String(watched.additional_costs ?? "0") || "0");
    } catch {
      additional = 0;
    }
    return { lines, subtotal, additional, total: subtotal + additional };
  }, [watched]);

  async function onSubmit(values: PurchaseOrderInput) {
    setFormError(null);
    const result = initial
      ? await updatePurchaseOrderDraftAction(initial.id, values)
      : await createPurchaseOrderAction(values, idempotencyKey);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        form.setError(name as Path<FormValues>, { message: messages[0] });
      }
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success(initial ? "Purchase order updated" : "Purchase order created as draft");
    router.push(`/purchases/${result.data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="purchase-order-form"
    >
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="supplier_id"
            label="Supplier"
            error={errors.supplier_id?.message}
            required
          >
            <NativeSelect
              id="supplier_id"
              data-testid="select-supplier"
              {...form.register("supplier_id")}
            >
              <option value="">Select a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="ordered_at"
            label="Order date"
            error={errors.ordered_at?.message}
            required
          >
            <Input
              id="ordered_at"
              type="date"
              data-testid="input-ordered_at"
              {...form.register("ordered_at")}
            />
          </FormField>
          <FormField
            name="additional_costs"
            label="Additional costs (₱)"
            error={errors.additional_costs?.message}
            description="Freight, handling, etc. Allocated to lots by weight when received."
          >
            <Input
              id="additional_costs"
              inputMode="decimal"
              data-testid="input-additional_costs"
              {...form.register("additional_costs")}
            />
          </FormField>
          <FormField
            name="notes"
            label="Notes"
            error={errors.notes?.message}
            className="sm:col-span-2"
          >
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ green_coffee_id: "", quantity_kg: "" as unknown as number, unit_cost: "" })
            }
            data-testid="add-item"
          >
            <PlusIcon /> Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {typeof errors.items?.message === "string" ? (
            <p className="text-destructive text-sm" data-testid="error-items">
              {errors.items.message}
            </p>
          ) : null}
          {fields.map((field, index) => {
            const itemErrors = errors.items?.[index];
            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_120px_140px_120px_auto] sm:items-end"
                data-testid="po-item-row"
              >
                <FormField
                  name={`items.${index}.green_coffee_id`}
                  label="Green coffee"
                  error={itemErrors?.green_coffee_id?.message}
                  required
                >
                  <NativeSelect
                    id={`items.${index}.green_coffee_id`}
                    data-testid="select-green-coffee"
                    {...form.register(`items.${index}.green_coffee_id`)}
                  >
                    <option value="">Select…</option>
                    {greenCoffees.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  name={`items.${index}.quantity_kg`}
                  label="Quantity (kg)"
                  error={itemErrors?.quantity_kg?.message}
                  required
                >
                  <Input
                    id={`items.${index}.quantity_kg`}
                    inputMode="decimal"
                    placeholder="10"
                    data-testid="input-quantity-kg"
                    {...form.register(`items.${index}.quantity_kg`)}
                  />
                </FormField>
                <FormField
                  name={`items.${index}.unit_cost`}
                  label="Cost per kg (₱)"
                  error={itemErrors?.unit_cost?.message}
                  required
                >
                  <Input
                    id={`items.${index}.unit_cost`}
                    inputMode="decimal"
                    placeholder="450.00"
                    data-testid="input-unit-cost"
                    {...form.register(`items.${index}.unit_cost`)}
                  />
                </FormField>
                <div className="text-sm">
                  <span className="text-muted-foreground block text-xs uppercase">Line total</span>
                  <span className="tabular-nums" data-testid="line-total">
                    {formatPHP(totals.lines[index] ?? 0)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  aria-label="Remove item"
                >
                  <Trash2Icon />
                </Button>
              </div>
            );
          })}
          <div className="ml-auto grid w-full max-w-xs gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums" data-testid="po-subtotal">
                {formatPHP(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Additional costs</span>
              <span className="tabular-nums">{formatPHP(totals.additional)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums" data-testid="po-total">
                {formatPHP(totals.total)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting} data-testid="po-submit">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {initial ? "Save draft" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
