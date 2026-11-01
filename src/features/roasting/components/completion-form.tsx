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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/shared/form-field";
import { formatWeight } from "@/lib/units";
import { formatPHP, toCentavos } from "@/lib/money";
import {
  capacityStatus,
  developmentRatioPct,
  formatDuration,
  roastLossPct,
  roastYieldPct,
  roastedCostPerKgCentavos,
  ROAST_LEVELS,
} from "@/lib/roasting/calculations";
import { COST_TYPES, roastCompletionSchema, type RoastCompletionInput } from "../schemas";
import { completeRoastBatchAction } from "../actions";

type FormValues = z.input<typeof roastCompletionSchema>;

interface Props {
  batchId: string;
  batchNumber: string;
  greenWeightG: number;
  estimatedGreenCostCentavos: number;
  roaster: { name: string; capacity_g: number; capacity_policy: string };
  existingCosts: { cost_type: string; amount: number; notes: string | null }[];
  defaults: {
    roast_level?: string | null;
    first_crack_seconds?: number | null;
    total_duration_seconds?: number | null;
  };
}

export function RoastCompletionForm({
  batchId,
  batchNumber,
  greenWeightG,
  estimatedGreenCostCentavos,
  roaster,
  existingCosts,
  defaults,
}: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues, unknown, RoastCompletionInput>({
    resolver: zodResolver(roastCompletionSchema),
    defaultValues: {
      roasted_weight_g: "" as unknown as number,
      roast_level: (defaults.roast_level ?? "") as FormValues["roast_level"],
      total_duration_seconds: (defaults.total_duration_seconds ?? "") as unknown as number,
      first_crack_seconds: (defaults.first_crack_seconds ?? "") as unknown as number,
      charge_bt_c: "" as unknown as number,
      charge_et_c: "" as unknown as number,
      first_crack_bt_c: "" as unknown as number,
      drop_bt_c: "" as unknown as number,
      costs: existingCosts.length
        ? existingCosts.map((c) => ({
            cost_type: c.cost_type as "lpg",
            amount: c.amount.toFixed(2),
            notes: c.notes ?? "",
          }))
        : [{ cost_type: "lpg", amount: "", notes: "" }],
      notes: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "costs" });
  const errors = form.formState.errors;
  const w = useWatch({ control: form.control });

  const preview = useMemo(() => {
    const roasted = Number(w.roasted_weight_g);
    const duration = Number(w.total_duration_seconds);
    const fc =
      w.first_crack_seconds === "" || w.first_crack_seconds === undefined
        ? null
        : Number(w.first_crack_seconds);
    const validWeights = Number.isInteger(roasted) && roasted > 0 && roasted <= greenWeightG;
    let other = 0;
    for (const c of w.costs ?? []) {
      try {
        other += toCentavos(String(c.amount ?? "0") || "0");
      } catch {
        /* ignore partial input */
      }
    }
    const total = estimatedGreenCostCentavos + other;
    return {
      loss: validWeights ? roastLossPct({ greenWeightG, roastedWeightG: roasted }) : null,
      yield: validWeights ? roastYieldPct({ greenWeightG, roastedWeightG: roasted }) : null,
      dtr:
        Number.isInteger(duration) && duration > 0 && fc !== null && fc >= 0 && fc <= duration
          ? developmentRatioPct(duration, fc)
          : null,
      other,
      total,
      perKg: validWeights ? roastedCostPerKgCentavos(total, roasted) : null,
    };
  }, [w, greenWeightG, estimatedGreenCostCentavos]);

  const capacity = capacityStatus(greenWeightG, roaster.capacity_g);

  async function onSubmit(values: RoastCompletionInput) {
    setFormError(null);
    const result = await completeRoastBatchAction(batchId, values);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success("Roast completed — green consumed and roasted stock created");
    router.push(`/roasting/${batchId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="completion-form"
    >
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      {capacity.over ? (
        <Alert
          variant={roaster.capacity_policy === "block" ? "destructive" : "default"}
          data-testid="capacity-warning"
        >
          <AlertTitle>Over capacity</AlertTitle>
          <AlertDescription>
            {formatWeight(greenWeightG)} exceeds {roaster.name}&apos;s capacity of{" "}
            {formatWeight(roaster.capacity_g)}.
            {roaster.capacity_policy === "block"
              ? " Completion will be refused by the roaster's policy."
              : " The roaster policy allows completion with a warning."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Complete {batchNumber}</CardTitle>
          <CardDescription>
            Green input {formatWeight(greenWeightG)}. Completing consumes the green lots and creates
            roasted bulk stock in one transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField
            name="roasted_weight_g"
            label="Roasted output (g)"
            error={errors.roasted_weight_g?.message}
            required
          >
            <Input
              id="roasted_weight_g"
              inputMode="numeric"
              placeholder="1260"
              data-testid="input-roasted-weight"
              {...form.register("roasted_weight_g")}
            />
          </FormField>
          <FormField name="roast_level" label="Roast level" error={errors.roast_level?.message}>
            <NativeSelect
              id="roast_level"
              data-testid="select-roast-level"
              {...form.register("roast_level")}
            >
              <option value="">—</option>
              {ROAST_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="total_duration_seconds"
            label="Total duration (s)"
            error={errors.total_duration_seconds?.message}
            required
            description={
              w.total_duration_seconds
                ? formatDuration(Number(w.total_duration_seconds))
                : undefined
            }
          >
            <Input
              id="total_duration_seconds"
              inputMode="numeric"
              placeholder="600"
              data-testid="input-duration"
              {...form.register("total_duration_seconds")}
            />
          </FormField>
          <FormField
            name="first_crack_seconds"
            label="First crack (s)"
            error={errors.first_crack_seconds?.message}
            description="Optional"
          >
            <Input
              id="first_crack_seconds"
              inputMode="numeric"
              placeholder="480"
              data-testid="input-first-crack"
              {...form.register("first_crack_seconds")}
            />
          </FormField>
          <FormField name="charge_bt_c" label="Charge BT (°C)" error={errors.charge_bt_c?.message}>
            <Input id="charge_bt_c" inputMode="decimal" {...form.register("charge_bt_c")} />
          </FormField>
          <FormField name="charge_et_c" label="Charge ET (°C)" error={errors.charge_et_c?.message}>
            <Input id="charge_et_c" inputMode="decimal" {...form.register("charge_et_c")} />
          </FormField>
          <FormField
            name="first_crack_bt_c"
            label="First crack BT (°C)"
            error={errors.first_crack_bt_c?.message}
          >
            <Input
              id="first_crack_bt_c"
              inputMode="decimal"
              {...form.register("first_crack_bt_c")}
            />
          </FormField>
          <FormField name="drop_bt_c" label="Drop BT (°C)" error={errors.drop_bt_c?.message}>
            <Input id="drop_bt_c" inputMode="decimal" {...form.register("drop_bt_c")} />
          </FormField>
          <FormField
            name="notes"
            label="Completion notes"
            error={errors.notes?.message}
            className="sm:col-span-3"
          >
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Production costs</CardTitle>
            <CardDescription>
              Green coffee cost is taken from the lots automatically. Add LPG, labor and other
              costs.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ cost_type: "other", amount: "", notes: "" })}
            data-testid="add-cost"
          >
            <PlusIcon /> Add cost
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 sm:grid-cols-[180px_160px_1fr_auto] sm:items-end"
              data-testid="cost-row"
            >
              <FormField
                name={`costs.${index}.cost_type`}
                label="Type"
                error={errors.costs?.[index]?.cost_type?.message}
              >
                <NativeSelect
                  id={`costs.${index}.cost_type`}
                  data-testid="select-cost-type"
                  {...form.register(`costs.${index}.cost_type`)}
                >
                  {COST_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                name={`costs.${index}.amount`}
                label="Amount (₱)"
                error={errors.costs?.[index]?.amount?.message}
              >
                <Input
                  id={`costs.${index}.amount`}
                  inputMode="decimal"
                  placeholder="0.00"
                  data-testid="input-cost-amount"
                  {...form.register(`costs.${index}.amount`)}
                />
              </FormField>
              <FormField
                name={`costs.${index}.notes`}
                label="Notes"
                error={errors.costs?.[index]?.notes?.message}
              >
                <Input id={`costs.${index}.notes`} {...form.register(`costs.${index}.notes`)} />
              </FormField>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label="Remove cost"
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="completion-preview">
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Roast loss"
            value={preview.loss !== null ? `${preview.loss}%` : "—"}
            testId="preview-loss"
          />
          <Stat
            label="Yield"
            value={preview.yield !== null ? `${preview.yield}%` : "—"}
            testId="preview-yield"
          />
          <Stat
            label="Development ratio"
            value={preview.dtr !== null ? `${preview.dtr}%` : "—"}
            testId="preview-dtr"
          />
          <Stat label="Green cost (est.)" value={formatPHP(estimatedGreenCostCentavos)} />
          <Stat label="Total cost (est.)" value={formatPHP(preview.total)} testId="preview-total" />
          <Stat
            label="Cost / roasted kg"
            value={preview.perKg !== null ? formatPHP(preview.perKg) : "—"}
            testId="preview-per-kg"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting} data-testid="complete-submit">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          Complete roast
        </Button>
      </div>
    </form>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase">{label}</p>
      <p className="font-medium tabular-nums" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}
