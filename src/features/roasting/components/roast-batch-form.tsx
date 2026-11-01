"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/shared/form-field";
import { formatWeight } from "@/lib/units";
import { toManilaDateString } from "@/lib/units/time";
import { capacityStatus } from "@/lib/roasting/calculations";
import { roastBatchSchema, type RoastBatchInput } from "../schemas";
import { createRoastBatchAction, updateRoastBatchDraftAction } from "../actions";

type FormValues = z.input<typeof roastBatchSchema>;

export interface RoastFormOptions {
  roasters: { id: string; name: string; capacity_g: number; capacity_policy: string }[];
  profiles: { id: string; name: string; roaster_id: string | null }[];
  locations: { id: string; name: string }[];
  lots: { id: string; label: string; available_g: number; cost_per_kg: number | null }[];
  members: { id: string; name: string; role: string }[];
  defaultRoasterId: string | null;
  defaultLocationId: string | null;
  currentUserId: string;
}

interface Props {
  options: RoastFormOptions;
  initial?: { id: string; values: FormValues };
}

export function RoastBatchForm({ options, initial }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const form = useForm<FormValues, unknown, RoastBatchInput>({
    resolver: zodResolver(roastBatchSchema),
    defaultValues: initial?.values ?? {
      roaster_id: options.defaultRoasterId ?? options.roasters[0]?.id ?? "",
      roast_profile_id: "",
      location_id: options.defaultLocationId ?? options.locations[0]?.id ?? "",
      operator_id: options.currentUserId,
      roast_date: toManilaDateString(),
      notes: "",
      inputs: [{ green_lot_id: "", input_weight_g: "" as unknown as number }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "inputs" });
  const errors = form.formState.errors;
  const watched = useWatch({ control: form.control });

  const greenTotal = useMemo(
    () =>
      (watched.inputs ?? []).reduce(
        (a, i) => a + (Number.isFinite(Number(i.input_weight_g)) ? Number(i.input_weight_g) : 0),
        0,
      ),
    [watched.inputs],
  );
  const roaster = options.roasters.find((r) => r.id === watched.roaster_id);
  const capacity = roaster ? capacityStatus(greenTotal, roaster.capacity_g) : null;
  const stockIssues = (watched.inputs ?? [])
    .map((i, idx) => {
      const lot = options.lots.find((l) => l.id === i.green_lot_id);
      const w = Number(i.input_weight_g);
      return lot && w > lot.available_g
        ? `${lot.label}: only ${formatWeight(lot.available_g)} available (row ${idx + 1})`
        : null;
    })
    .filter(Boolean) as string[];

  async function onSubmit(values: RoastBatchInput) {
    setFormError(null);
    const result = initial
      ? await updateRoastBatchDraftAction(initial.id, values)
      : await createRoastBatchAction(values, idempotencyKey);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success(initial ? "Roast batch updated" : "Roast batch created");
    if (result.data.warning) toast.warning(result.data.warning, { duration: 8000 });
    router.push(`/roasting/${result.data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="roast-batch-form"
    >
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batch setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="roaster_id"
            label="Roaster"
            error={errors.roaster_id?.message}
            required
            description={
              roaster
                ? `Capacity ${formatWeight(roaster.capacity_g)} · policy: ${roaster.capacity_policy}`
                : undefined
            }
          >
            <NativeSelect
              id="roaster_id"
              data-testid="select-roaster"
              {...form.register("roaster_id")}
            >
              <option value="">Select…</option>
              {options.roasters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({formatWeight(r.capacity_g)})
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="roast_profile_id"
            label="Roast profile"
            error={errors.roast_profile_id?.message}
          >
            <NativeSelect
              id="roast_profile_id"
              data-testid="select-profile"
              {...form.register("roast_profile_id")}
            >
              <option value="">— None —</option>
              {options.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="location_id"
            label="Location"
            error={errors.location_id?.message}
            required
            description="Green is consumed from and roasted stock is stored at this location."
          >
            <NativeSelect
              id="location_id"
              data-testid="select-location"
              {...form.register("location_id")}
            >
              {options.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField name="operator_id" label="Operator" error={errors.operator_id?.message}>
            <NativeSelect
              id="operator_id"
              data-testid="select-operator"
              {...form.register("operator_id")}
            >
              {options.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="roast_date"
            label="Roast date"
            error={errors.roast_date?.message}
            required
          >
            <Input id="roast_date" type="date" {...form.register("roast_date")} />
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
          <div>
            <CardTitle className="text-base">Green coffee inputs</CardTitle>
            <CardDescription>
              One or more lots. Stock is checked again when the roast is completed.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ green_lot_id: "", input_weight_g: "" as unknown as number })}
            data-testid="add-input"
          >
            <PlusIcon /> Add lot
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {typeof errors.inputs?.message === "string" ? (
            <p className="text-destructive text-sm">{errors.inputs.message}</p>
          ) : null}
          {fields.map((field, index) => {
            const itemErrors = errors.inputs?.[index];
            const lot = options.lots.find((l) => l.id === watched.inputs?.[index]?.green_lot_id);
            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
                data-testid="roast-input-row"
              >
                <FormField
                  name={`inputs.${index}.green_lot_id`}
                  label="Green lot"
                  error={itemErrors?.green_lot_id?.message}
                  required
                  description={lot ? `Available ${formatWeight(lot.available_g)}` : undefined}
                >
                  <NativeSelect
                    id={`inputs.${index}.green_lot_id`}
                    data-testid="select-lot"
                    {...form.register(`inputs.${index}.green_lot_id`)}
                  >
                    <option value="">Select a lot…</option>
                    {options.lots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label} — {formatWeight(l.available_g)}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  name={`inputs.${index}.input_weight_g`}
                  label="Weight (g)"
                  error={itemErrors?.input_weight_g?.message}
                  required
                >
                  <Input
                    id={`inputs.${index}.input_weight_g`}
                    inputMode="numeric"
                    placeholder="1500"
                    data-testid="input-weight"
                    {...form.register(`inputs.${index}.input_weight_g`)}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  aria-label="Remove lot"
                >
                  <Trash2Icon />
                </Button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              Total green: <strong data-testid="green-total">{formatWeight(greenTotal)}</strong>
              {capacity && roaster ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {capacity.pct}% of {roaster.name} capacity
                </span>
              ) : null}
            </span>
          </div>
          {capacity?.over ? (
            <Alert data-testid="capacity-warning">
              <TriangleAlertIcon />
              <AlertTitle>Over capacity</AlertTitle>
              <AlertDescription>
                {formatWeight(greenTotal)} exceeds the configured capacity of{" "}
                {formatWeight(roaster!.capacity_g)}.
                {roaster!.capacity_policy === "block"
                  ? " This roaster blocks over-capacity batches at completion."
                  : " You can save the draft; completion follows the roaster's policy."}
              </AlertDescription>
            </Alert>
          ) : null}
          {stockIssues.length > 0 ? (
            <Alert variant="destructive" data-testid="stock-warning">
              <AlertTitle>Insufficient green stock</AlertTitle>
              <AlertDescription>{stockIssues.join(" · ")}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting} data-testid="roast-submit">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {initial ? "Save changes" : "Create roast batch"}
        </Button>
      </div>
    </form>
  );
}
