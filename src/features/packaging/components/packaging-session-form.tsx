"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { toManilaDateString } from "@/lib/units/time";
import {
  allocateSessionCost,
  materialRequirements,
  requiredWeightG,
  unitCost,
} from "@/lib/packaging/calculations";
import {
  packagingSessionSchema,
  type PackagingSessionFormValues,
  type PackagingSessionInput,
} from "../schemas";
import { createPackagingSessionAction, updatePackagingSessionDraftAction } from "../actions";

export interface PackagingFormOptions {
  batches: { id: string; label: string; available_g: number; cost_per_kg: number | null }[];
  variants: {
    id: string;
    label: string;
    net_weight_g: number;
    materials: { material_id: string; quantity_per_unit: number }[];
  }[];
  materials: {
    id: string;
    name: string;
    base_unit: string;
    available: number;
    standard_unit_cost: number;
  }[];
  locations: { id: string; name: string }[];
  members: { id: string; name: string }[];
  defaultLocationId: string | null;
  currentUserId: string;
}

interface Props {
  options: PackagingFormOptions;
  initial?: { id: string; values: PackagingSessionFormValues };
}

export function PackagingSessionForm({ options, initial }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [materialsTouched, setMaterialsTouched] = useState(Boolean(initial));

  const form = useForm<PackagingSessionFormValues, unknown, PackagingSessionInput>({
    resolver: zodResolver(packagingSessionSchema),
    defaultValues: initial?.values ?? {
      location_id: options.defaultLocationId ?? options.locations[0]?.id ?? "",
      packaged_at: toManilaDateString(),
      operator_id: options.currentUserId,
      labor_cost: "",
      overhead_cost: "",
      notes: "",
      inputs: [{ roast_batch_id: "", input_weight_g: "" as unknown as number }],
      outputs: [
        { variant_id: "", quantity: "" as unknown as number, lot_code: "", best_before_at: "" },
      ],
      materials: options.materials.map((m) => ({ material_id: m.id, quantity: 0 })),
    },
  });
  const inputs = useFieldArray({ control: form.control, name: "inputs" });
  const outputs = useFieldArray({ control: form.control, name: "outputs" });
  const errors = form.formState.errors;
  const w = useWatch({ control: form.control });

  const preview = useMemo(() => {
    const outs = (w.outputs ?? [])
      .map((o) => {
        const v = options.variants.find((x) => x.id === o.variant_id);
        const q = Number(o.quantity);
        return v && Number.isInteger(q) && q > 0
          ? { variantId: v.id, quantity: q, netWeightG: v.net_weight_g }
          : null;
      })
      .filter(Boolean) as { variantId: string; quantity: number; netWeightG: number }[];
    const required = outs.length ? requiredWeightG(outs) : 0;
    const inputTotal = (w.inputs ?? []).reduce(
      (a, i) => a + (Number.isInteger(Number(i.input_weight_g)) ? Number(i.input_weight_g) : 0),
      0,
    );
    const bom = options.variants.flatMap((v) =>
      v.materials.map((m) => ({
        variantId: v.id,
        materialId: m.material_id,
        quantityPerUnit: m.quantity_per_unit,
      })),
    );
    const bomReq = materialRequirements(outs, bom);
    // estimated coffee cost from batch cost/kg
    let coffeeC = 0;
    for (const i of w.inputs ?? []) {
      const b = options.batches.find((x) => x.id === i.roast_batch_id);
      const g = Number(i.input_weight_g);
      if (b && b.cost_per_kg !== null && Number.isFinite(g))
        coffeeC += Math.round((toCentavos(b.cost_per_kg) * g) / 1000);
    }
    let matC = 0;
    for (const m of w.materials ?? []) {
      const def = options.materials.find((x) => x.id === m.material_id);
      const q = Number(m.quantity);
      if (def && Number.isFinite(q) && q > 0)
        matC += Math.round(toCentavos(def.standard_unit_cost) * q);
    }
    const parse = (s: unknown) => {
      try {
        return toCentavos(String(s ?? "0") || "0");
      } catch {
        return 0;
      }
    };
    const total = coffeeC + matC + parse(w.labor_cost) + parse(w.overhead_cost);
    const alloc = outs.length ? allocateSessionCost(total, outs) : [];
    return { outs, required, inputTotal, bomReq, coffeeC, matC, total, alloc };
  }, [w, options]);

  // Auto-fill material quantities from the BOM until the user edits them.
  const bomKey = [...preview.bomReq.entries()].map(([k, v]) => `${k}:${v}`).join("|");
  const [lastBomKey, setLastBomKey] = useState("");
  if (!materialsTouched && bomKey !== lastBomKey) {
    setLastBomKey(bomKey);
    options.materials.forEach((m, i) =>
      form.setValue(`materials.${i}.quantity`, preview.bomReq.get(m.id) ?? 0),
    );
  }

  async function onSubmit(values: PackagingSessionInput) {
    setFormError(null);
    const r = initial
      ? await updatePackagingSessionDraftAction(initial.id, values)
      : await createPackagingSessionAction(values, idempotencyKey);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<PackagingSessionFormValues>, { message: messages[0] });
      setFormError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success(initial ? "Packaging session updated" : "Packaging session created as draft");
    router.push(`/packaging/${r.data.id}`);
    router.refresh();
  }

  const shortfall = preview.inputTotal < preview.required;
  const stockIssues = (w.inputs ?? [])
    .map((i) => {
      const b = options.batches.find((x) => x.id === i.roast_batch_id);
      return b && Number(i.input_weight_g) > b.available_g
        ? `${b.label}: only ${formatWeight(b.available_g)} available`
        : null;
    })
    .filter(Boolean) as string[];
  const materialIssues = (w.materials ?? [])
    .map((m) => {
      const def = options.materials.find((x) => x.id === m.material_id);
      return def && Number(m.quantity) > def.available
        ? `${def.name}: only ${def.available} ${def.base_unit} available`
        : null;
    })
    .filter(Boolean) as string[];

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="packaging-form"
    >
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            name="location_id"
            label="Location"
            error={errors.location_id?.message}
            required
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
          <FormField name="packaged_at" label="Date" error={errors.packaged_at?.message} required>
            <Input id="packaged_at" type="date" {...form.register("packaged_at")} />
          </FormField>
          <FormField name="operator_id" label="Operator" error={errors.operator_id?.message}>
            <NativeSelect id="operator_id" {...form.register("operator_id")}>
              {options.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField name="notes" label="Notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={1} {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Roasted coffee inputs</CardTitle>
            <CardDescription>
              Select completed roast batches and how much to take from each.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              inputs.append({ roast_batch_id: "", input_weight_g: "" as unknown as number })
            }
            data-testid="add-input"
          >
            <PlusIcon /> Add batch
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {typeof errors.inputs?.message === "string" ? (
            <p className="text-destructive text-sm">{errors.inputs.message}</p>
          ) : null}
          {inputs.fields.map((f, i) => {
            const b = options.batches.find((x) => x.id === w.inputs?.[i]?.roast_batch_id);
            return (
              <div
                key={f.id}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
                data-testid="input-row"
              >
                <FormField
                  name={`inputs.${i}.roast_batch_id`}
                  label="Roast batch"
                  error={errors.inputs?.[i]?.roast_batch_id?.message}
                  required
                  description={
                    b
                      ? `Available ${formatWeight(b.available_g)}${b.cost_per_kg !== null ? ` · ₱${b.cost_per_kg.toFixed(2)}/kg` : ""}`
                      : undefined
                  }
                >
                  <NativeSelect
                    id={`inputs.${i}.roast_batch_id`}
                    data-testid="select-batch"
                    {...form.register(`inputs.${i}.roast_batch_id`)}
                  >
                    <option value="">Select a batch…</option>
                    {options.batches.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label} — {formatWeight(x.available_g)}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  name={`inputs.${i}.input_weight_g`}
                  label="Weight (g)"
                  error={errors.inputs?.[i]?.input_weight_g?.message}
                  required
                >
                  <Input
                    id={`inputs.${i}.input_weight_g`}
                    inputMode="numeric"
                    data-testid="input-weight"
                    {...form.register(`inputs.${i}.input_weight_g`)}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => inputs.remove(i)}
                  disabled={inputs.fields.length === 1}
                  aria-label="Remove"
                >
                  <Trash2Icon />
                </Button>
              </div>
            );
          })}
          {stockIssues.length ? (
            <Alert variant="destructive" data-testid="stock-warning">
              <AlertDescription>{stockIssues.join(" · ")}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Outputs</CardTitle>
            <CardDescription>Each output line becomes its own finished-goods lot.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              outputs.append({
                variant_id: "",
                quantity: "" as unknown as number,
                lot_code: "",
                best_before_at: "",
              })
            }
            data-testid="add-output"
          >
            <PlusIcon /> Add product
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {typeof errors.outputs?.message === "string" ? (
            <p className="text-destructive text-sm">{errors.outputs.message}</p>
          ) : null}
          {outputs.fields.map((f, i) => (
            <div
              key={f.id}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_110px_150px_150px_auto] sm:items-end"
              data-testid="output-row"
            >
              <FormField
                name={`outputs.${i}.variant_id`}
                label="Product variant"
                error={errors.outputs?.[i]?.variant_id?.message}
                required
              >
                <NativeSelect
                  id={`outputs.${i}.variant_id`}
                  data-testid="select-variant"
                  {...form.register(`outputs.${i}.variant_id`)}
                >
                  <option value="">Select…</option>
                  {options.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                name={`outputs.${i}.quantity`}
                label="Units"
                error={errors.outputs?.[i]?.quantity?.message}
                required
              >
                <Input
                  id={`outputs.${i}.quantity`}
                  inputMode="numeric"
                  data-testid="input-quantity"
                  {...form.register(`outputs.${i}.quantity`)}
                />
              </FormField>
              <FormField
                name={`outputs.${i}.lot_code`}
                label="Lot code"
                error={errors.outputs?.[i]?.lot_code?.message}
                description="Blank = auto"
              >
                <Input
                  id={`outputs.${i}.lot_code`}
                  data-testid="input-lot-code"
                  {...form.register(`outputs.${i}.lot_code`)}
                />
              </FormField>
              <FormField
                name={`outputs.${i}.best_before_at`}
                label="Best before"
                error={errors.outputs?.[i]?.best_before_at?.message}
              >
                <Input
                  id={`outputs.${i}.best_before_at`}
                  type="date"
                  {...form.register(`outputs.${i}.best_before_at`)}
                />
              </FormField>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => outputs.remove(i)}
                disabled={outputs.fields.length === 1}
                aria-label="Remove"
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-6 text-sm">
            <span>
              Required coffee:{" "}
              <strong data-testid="required-weight">{formatWeight(preview.required)}</strong>
            </span>
            <span>
              Input:{" "}
              <strong data-testid="input-weight-total">{formatWeight(preview.inputTotal)}</strong>
            </span>
            <span>
              Remaining after packing:{" "}
              <strong data-testid="remaining-weight">
                {shortfall ? "—" : formatWeight(preview.inputTotal - preview.required)}
              </strong>
            </span>
          </div>
          {shortfall && preview.required > 0 ? (
            <Alert variant="destructive" data-testid="shortfall-warning">
              <AlertTitle>Not enough roasted coffee</AlertTitle>
              <AlertDescription>
                Outputs need {formatWeight(preview.required)} but inputs total{" "}
                {formatWeight(preview.inputTotal)}.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Packaging materials</CardTitle>
          <CardDescription>
            Pre-filled from each variant&apos;s bill of materials; adjust if actual usage differs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {options.materials.length === 0 ? (
            <p className="text-muted-foreground text-sm">No packaging materials defined.</p>
          ) : null}
          {options.materials.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center gap-3"
              data-testid="material-row"
              data-material={m.name}
            >
              <input type="hidden" {...form.register(`materials.${i}.material_id`)} />
              <label htmlFor={`materials.${i}.quantity`} className="flex-1 text-sm">
                {m.name}{" "}
                <span className="text-muted-foreground">
                  · {m.available} {m.base_unit} available
                  {preview.bomReq.get(m.id) ? ` · BOM ${preview.bomReq.get(m.id)}` : ""}
                </span>
              </label>
              <Input
                id={`materials.${i}.quantity`}
                inputMode="numeric"
                className="w-28"
                data-testid="input-material-qty"
                {...form.register(`materials.${i}.quantity`, {
                  onChange: () => setMaterialsTouched(true),
                })}
              />
            </div>
          ))}
          {materialIssues.length ? (
            <Alert variant="destructive" data-testid="material-warning">
              <AlertDescription>{materialIssues.join(" · ")}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costs &amp; preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="labor_cost"
              label="Packaging labor (₱)"
              error={errors.labor_cost?.message}
            >
              <Input
                id="labor_cost"
                inputMode="decimal"
                data-testid="input-labor"
                {...form.register("labor_cost")}
              />
            </FormField>
            <FormField
              name="overhead_cost"
              label="Other packaging overhead (₱)"
              error={errors.overhead_cost?.message}
            >
              <Input
                id="overhead_cost"
                inputMode="decimal"
                data-testid="input-overhead"
                {...form.register("overhead_cost")}
              />
            </FormField>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-4" data-testid="cost-preview">
            <Stat label="Roasted coffee (est.)" value={formatPHP(preview.coffeeC)} />
            <Stat label="Materials (est.)" value={formatPHP(preview.matC)} />
            <Stat label="Total (est.)" value={formatPHP(preview.total)} testId="preview-total" />
            <Stat label="Units" value={String(preview.outs.reduce((a, o) => a + o.quantity, 0))} />
          </div>
          {preview.outs.length ? (
            <ul className="text-sm" data-testid="unit-cost-preview">
              {preview.outs.map((o, i) => (
                <li key={`${o.variantId}-${i}`} className="flex justify-between">
                  <span>
                    {options.variants.find((v) => v.id === o.variantId)?.label} × {o.quantity}
                  </span>
                  <span className="tabular-nums">
                    {formatPHP(preview.alloc[i] ?? 0)} · ₱
                    {unitCost(preview.alloc[i] ?? 0, o.quantity)} / unit
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Estimates use current batch cost per kg and standard material costs; exact costs are
            taken from cost layers at completion.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting} data-testid="packaging-submit">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {initial ? "Save draft" : "Create draft"}
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
