"use client";

import { useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/shared/form-field";
import { formatWeight } from "@/lib/units";
import {
  ADJUSTMENT_REASONS,
  inventoryAdjustmentSchema,
  type InventoryAdjustmentInput,
} from "../schemas";
import { createInventoryAdjustmentAction } from "../actions";

type FormValues = z.input<typeof inventoryAdjustmentSchema>;

interface ItemOption {
  inventory_item_id: string;
  label: string;
  available: number;
  unit: string;
  group: string;
}

interface Props {
  items: ItemOption[];
  locations: { id: string; name: string }[];
  defaultItemId?: string;
}

export function AdjustmentForm({ items, locations, defaultItemId }: Props) {
  const groups = [...new Set(items.map((i) => i.group))];
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const emptyLine = () => ({
    inventory_item_id: defaultItemId ?? "",
    location_id: locations[0]?.id ?? "",
    direction: "decrease" as const,
    quantity: "" as unknown as number,
    unit_cost: "",
    notes: "",
  });

  const form = useForm<FormValues, unknown, InventoryAdjustmentInput>({
    resolver: zodResolver(inventoryAdjustmentSchema),
    defaultValues: { reason: "count_correction", notes: "", lines: [emptyLine()] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const errors = form.formState.errors;
  const lines = useWatch({ control: form.control, name: "lines" });

  async function onSubmit(values: InventoryAdjustmentInput) {
    setFormError(null);
    const result = await createInventoryAdjustmentAction(values, idempotencyKey);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        form.setError(name as Path<FormValues>, { message: messages[0] });
      }
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success("Adjustment posted");
    router.push(`/inventory/adjustments/${result.data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="adjustment-form"
    >
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adjustment</CardTitle>
          <CardDescription>
            Posted immediately. Mistakes are corrected with a reversal, never by editing history.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField name="reason" label="Reason" error={errors.reason?.message} required>
            <NativeSelect id="reason" data-testid="select-reason" {...form.register("reason")}>
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField name="notes" label="Notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={2} data-testid="input-notes" {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lines</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyLine())}
            data-testid="add-line"
          >
            <PlusIcon /> Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {typeof errors.lines?.message === "string" ? (
            <p className="text-destructive text-sm">{errors.lines.message}</p>
          ) : null}
          {fields.map((field, index) => {
            const lineErrors = errors.lines?.[index];
            const selected = items.find(
              (l) => l.inventory_item_id === lines?.[index]?.inventory_item_id,
            );
            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_150px_120px_120px_130px_auto] sm:items-end"
                data-testid="adjustment-line"
              >
                <FormField
                  name={`lines.${index}.inventory_item_id`}
                  label="Item"
                  error={lineErrors?.inventory_item_id?.message}
                  required
                  description={
                    selected
                      ? `Available: ${selected.unit === "g" ? formatWeight(selected.available) : `${selected.available} ${selected.unit}`}`
                      : undefined
                  }
                >
                  <NativeSelect
                    id={`lines.${index}.inventory_item_id`}
                    data-testid="select-lot"
                    {...form.register(`lines.${index}.inventory_item_id`)}
                  >
                    <option value="">Select an item…</option>
                    {groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {items
                          .filter((i) => i.group === g)
                          .map((l) => (
                            <option key={l.inventory_item_id} value={l.inventory_item_id}>
                              {l.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  name={`lines.${index}.location_id`}
                  label="Location"
                  error={lineErrors?.location_id?.message}
                  required
                >
                  <NativeSelect
                    id={`lines.${index}.location_id`}
                    data-testid="select-location"
                    {...form.register(`lines.${index}.location_id`)}
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  name={`lines.${index}.direction`}
                  label="Direction"
                  error={lineErrors?.direction?.message}
                  required
                >
                  <NativeSelect
                    id={`lines.${index}.direction`}
                    data-testid="select-direction"
                    {...form.register(`lines.${index}.direction`)}
                  >
                    <option value="decrease">Decrease</option>
                    <option value="increase">Increase</option>
                  </NativeSelect>
                </FormField>
                <FormField
                  name={`lines.${index}.quantity`}
                  label={`Quantity (${selected?.unit ?? "base unit"})`}
                  error={lineErrors?.quantity?.message}
                  required
                >
                  <Input
                    id={`lines.${index}.quantity`}
                    inputMode="numeric"
                    data-testid="input-quantity"
                    {...form.register(`lines.${index}.quantity`)}
                  />
                </FormField>
                <FormField
                  name={`lines.${index}.unit_cost`}
                  label="Cost / unit (₱)"
                  error={lineErrors?.unit_cost?.message}
                  description="Increases only"
                >
                  <Input
                    id={`lines.${index}.unit_cost`}
                    inputMode="decimal"
                    placeholder="auto"
                    {...form.register(`lines.${index}.unit_cost`)}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  aria-label="Remove line"
                >
                  <Trash2Icon />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          data-testid="adjustment-submit"
        >
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          Post adjustment
        </Button>
      </div>
    </form>
  );
}
