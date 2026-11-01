"use client";

import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/shared/form-field";
import { formatDuration } from "@/lib/roasting/calculations";
import { ROAST_EVENT_TYPES, roastEventSchema, type RoastEventInput } from "../schemas";
import { addRoastEventAction, deleteRoastEventAction } from "../actions";
import type { Tables } from "@/types";

type FormValues = z.input<typeof roastEventSchema>;
const LABELS: Record<string, string> = Object.fromEntries(
  ROAST_EVENT_TYPES.map((e) => [e.value, e.label]),
);

export function EventsPanel({
  batchId,
  events,
  canEdit,
}: {
  batchId: string;
  events: Tables<"roast_events">[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const sorted = [...events].sort((a, b) => a.elapsed_seconds - b.elapsed_seconds);
  const form = useForm<FormValues, unknown, RoastEventInput>({
    resolver: zodResolver(roastEventSchema),
    defaultValues: {
      event_type: "first_crack_start",
      elapsed_seconds: "" as unknown as number,
      temperature_c: "",
      notes: "",
    } as unknown as FormValues,
  });
  const errors = form.formState.errors;

  async function onSubmit(values: RoastEventInput) {
    const r = await addRoastEventAction(batchId, values);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      toast.error(r.error.message);
      return;
    }
    form.reset({
      event_type: "note",
      elapsed_seconds: "" as unknown as number,
      temperature_c: "",
      notes: "",
    } as unknown as FormValues);
    router.refresh();
  }

  return (
    <div className="space-y-3" data-testid="events-panel">
      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm">No events recorded.</p>
      ) : (
        <ul className="divide-y text-sm">
          {sorted.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 py-1.5"
              data-testid="event-row"
            >
              <span>
                <span className="tabular-nums">{formatDuration(e.elapsed_seconds)}</span> ·{" "}
                <strong>{LABELS[e.event_type] ?? e.event_type}</strong>
                {e.temperature_c !== null ? (
                  <span className="text-muted-foreground"> · {e.temperature_c} °C</span>
                ) : null}
                {e.notes ? <span className="text-muted-foreground"> · {e.notes}</span> : null}
              </span>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete event"
                  onClick={async () => {
                    const r = await deleteRoastEventAction(batchId, e.id);
                    if (!r.ok) return toast.error(r.error.message);
                    router.refresh();
                  }}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_110px_110px_1fr_auto] sm:items-end"
          noValidate
          data-testid="event-form"
        >
          <FormField name="event_type" label="Event" error={errors.event_type?.message}>
            <NativeSelect id="event_type" data-testid="e-type" {...form.register("event_type")}>
              {ROAST_EVENT_TYPES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="elapsed_seconds"
            label="Elapsed (s)"
            error={errors.elapsed_seconds?.message}
            required
          >
            <Input
              id="event_elapsed"
              inputMode="numeric"
              data-testid="e-elapsed"
              {...form.register("elapsed_seconds")}
            />
          </FormField>
          <FormField name="temperature_c" label="Temp °C" error={errors.temperature_c?.message}>
            <Input id="temperature_c" inputMode="decimal" {...form.register("temperature_c")} />
          </FormField>
          <FormField name="notes" label="Notes" error={errors.notes?.message}>
            <Input id="event_notes" {...form.register("notes")} />
          </FormField>
          <Button type="submit" disabled={form.formState.isSubmitting} data-testid="e-add">
            <PlusIcon /> Add
          </Button>
        </form>
      ) : null}
    </div>
  );
}
