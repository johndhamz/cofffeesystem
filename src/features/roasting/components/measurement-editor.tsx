"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormField } from "@/components/shared/form-field";
import { formatDuration, rateOfRise } from "@/lib/roasting/calculations";
import { roastMeasurementSchema, type RoastMeasurementInput } from "../schemas";
import { deleteMeasurementAction, saveMeasurementAction } from "../actions";
import type { Tables } from "@/types";

type FormValues = z.input<typeof roastMeasurementSchema>;

interface Props {
  batchId: string;
  measurements: Tables<"roast_measurements">[];
  canEdit: boolean;
  maxGasKpa: number | null;
}

export function MeasurementEditor({ batchId, measurements, canEdit, maxGasKpa }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const sorted = [...measurements].sort((a, b) => a.elapsed_seconds - b.elapsed_seconds);
  const form = useForm<FormValues, unknown, RoastMeasurementInput>({
    resolver: zodResolver(roastMeasurementSchema),
    defaultValues: {
      elapsed_seconds: "" as unknown as number,
      bt_c: "",
      et_c: "",
      gas_kpa: "",
      airflow_pct: "",
      drum_speed_pct: "",
    } as unknown as FormValues,
  });
  const errors = form.formState.errors;

  async function onSubmit(values: RoastMeasurementInput) {
    if (maxGasKpa !== null && values.gas_kpa !== undefined && values.gas_kpa > maxGasKpa) {
      form.setError("gas_kpa", {
        message: `Exceeds the roaster's configured maximum of ${maxGasKpa} kPa`,
      });
      return;
    }
    const r = await saveMeasurementAction(batchId, values);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      toast.error(r.error.message);
      return;
    }
    form.reset({
      elapsed_seconds: "" as unknown as number,
      bt_c: "",
      et_c: "",
      gas_kpa: "",
      airflow_pct: "",
      drum_speed_pct: "",
    } as unknown as FormValues);
    router.refresh();
  }

  return (
    <div className="space-y-4" data-testid="measurement-editor">
      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No measurements yet. Enter readings manually (e.g. every 30 s) or attach an Artisan log.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table data-testid="measurements-table">
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">BT °C</TableHead>
                <TableHead className="text-right">ET °C</TableHead>
                <TableHead className="text-right">RoR °C/min</TableHead>
                <TableHead className="text-right">Gas kPa</TableHead>
                <TableHead className="text-right">Airflow %</TableHead>
                <TableHead className="text-right">Drum %</TableHead>
                {canEdit ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m, i) => {
                const prev = sorted[i - 1];
                const ror =
                  m.bt_c !== null && prev?.bt_c !== null && prev
                    ? rateOfRise(
                        { elapsedSeconds: prev.elapsed_seconds, btC: prev.bt_c! },
                        { elapsedSeconds: m.elapsed_seconds, btC: m.bt_c },
                      )
                    : null;
                return (
                  <TableRow key={m.id} data-testid="measurement-row">
                    <TableCell className="tabular-nums">
                      {formatDuration(m.elapsed_seconds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.bt_c ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.et_c ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{ror ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.gas_kpa ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.airflow_pct ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.drum_speed_pct ?? "—"}
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete measurement"
                          disabled={busy === m.id}
                          onClick={async () => {
                            setBusy(m.id);
                            const r = await deleteMeasurementAction(batchId, m.id);
                            setBusy(null);
                            if (!r.ok) return toast.error(r.error.message);
                            router.refresh();
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {canEdit ? (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-3 rounded-md border p-3 sm:grid-cols-7 sm:items-end"
          noValidate
          data-testid="measurement-form"
        >
          <FormField
            name="elapsed_seconds"
            label="Elapsed (s)"
            error={errors.elapsed_seconds?.message}
            required
          >
            <Input
              id="elapsed_seconds"
              inputMode="numeric"
              data-testid="m-elapsed"
              {...form.register("elapsed_seconds")}
            />
          </FormField>
          <FormField name="bt_c" label="BT °C" error={errors.bt_c?.message}>
            <Input id="bt_c" inputMode="decimal" data-testid="m-bt" {...form.register("bt_c")} />
          </FormField>
          <FormField name="et_c" label="ET °C" error={errors.et_c?.message}>
            <Input id="et_c" inputMode="decimal" data-testid="m-et" {...form.register("et_c")} />
          </FormField>
          <FormField name="gas_kpa" label="Gas kPa" error={errors.gas_kpa?.message}>
            <Input
              id="gas_kpa"
              inputMode="decimal"
              data-testid="m-gas"
              {...form.register("gas_kpa")}
            />
          </FormField>
          <FormField name="airflow_pct" label="Airflow %" error={errors.airflow_pct?.message}>
            <Input
              id="airflow_pct"
              inputMode="decimal"
              data-testid="m-airflow"
              {...form.register("airflow_pct")}
            />
          </FormField>
          <FormField name="drum_speed_pct" label="Drum %" error={errors.drum_speed_pct?.message}>
            <Input
              id="drum_speed_pct"
              inputMode="decimal"
              data-testid="m-drum"
              {...form.register("drum_speed_pct")}
            />
          </FormField>
          <Button type="submit" disabled={form.formState.isSubmitting} data-testid="m-add">
            {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}{" "}
            Add
          </Button>
        </form>
      ) : null}
    </div>
  );
}
