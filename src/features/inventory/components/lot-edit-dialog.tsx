"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { lotUpdateSchema } from "../schemas";
import { updateGreenLotAction } from "../actions";

type FormValues = z.input<typeof lotUpdateSchema>;
type Output = z.output<typeof lotUpdateSchema>;

interface Props {
  lotId: string;
  initial: {
    moisture_pct: number | null;
    density_g_per_100ml: number | null;
    notes: string | null;
    low_stock_threshold_g: number | null;
  };
}

export function LotEditDialog({ lotId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues, unknown, Output>({
    resolver: zodResolver(lotUpdateSchema),
    defaultValues: {
      moisture_pct: (initial.moisture_pct ?? "") as unknown as number,
      density_g_per_100ml: (initial.density_g_per_100ml ?? "") as unknown as number,
      notes: initial.notes ?? "",
      low_stock_threshold_g: (initial.low_stock_threshold_g ?? "") as unknown as number,
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: Output) {
    const result = await updateGreenLotAction(lotId, values);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        form.setError(name as Path<FormValues>, { message: messages[0] });
      }
      toast.error(result.error.message);
      return;
    }
    toast.success("Lot updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="edit-lot-button">
          <PencilIcon /> Edit lot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit lot details</DialogTitle>
          <DialogDescription>
            Quality measurements and thresholds. Quantities are changed through adjustments.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="moisture_pct"
              label="Moisture %"
              error={errors.moisture_pct?.message}
              description="Optional"
            >
              <Input id="moisture_pct" inputMode="decimal" {...form.register("moisture_pct")} />
            </FormField>
            <FormField
              name="density_g_per_100ml"
              label="Density g/100ml"
              error={errors.density_g_per_100ml?.message}
              description="Optional"
            >
              <Input
                id="density_g_per_100ml"
                inputMode="decimal"
                {...form.register("density_g_per_100ml")}
              />
            </FormField>
            <FormField
              name="low_stock_threshold_g"
              label="Low-stock threshold (g)"
              error={errors.low_stock_threshold_g?.message}
              className="sm:col-span-2"
              description="Overrides the coffee's default threshold"
            >
              <Input
                id="low_stock_threshold_g"
                inputMode="numeric"
                {...form.register("low_stock_threshold_g")}
              />
            </FormField>
            <FormField
              name="notes"
              label="Notes"
              error={errors.notes?.message}
              className="sm:col-span-2"
            >
              <Textarea id="notes" rows={3} {...form.register("notes")} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
