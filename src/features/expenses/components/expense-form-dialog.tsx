"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import { toManilaDateString } from "@/lib/units/time";
import { COST_TREATMENTS } from "@/lib/finance/calculations";
import { PAYMENT_METHODS } from "@/lib/sales/calculations";
import { expenseSchema, type ExpenseFormValues, type ExpenseInput } from "../schemas";
import { createExpenseAction, updateExpenseAction } from "../actions";

export interface ExpenseOptions {
  categories: { id: string; name: string; classification: string }[];
  suppliers: { id: string; name: string }[];
}

export function ExpenseFormDialog({
  trigger,
  options,
  record,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: ReactNode;
  options: ExpenseOptions;
  record?: { id: string } & Partial<ExpenseFormValues>;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const router = useRouter();
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (o: boolean) => {
    setUncontrolled(o);
    onOpenChange?.(o);
  };
  const [formError, setFormError] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const form = useForm<ExpenseFormValues, unknown, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expense_category_id: record?.expense_category_id ?? options.categories[0]?.id ?? "",
      supplier_id: record?.supplier_id ?? "",
      amount: record?.amount ?? "",
      incurred_at: record?.incurred_at ?? toManilaDateString(),
      description: record?.description ?? "",
      cost_treatment: record?.cost_treatment ?? "other_operating",
      payment_method: record?.payment_method ?? "",
      payment_reference: record?.payment_reference ?? "",
      notes: record?.notes ?? "",
    },
  });
  const errors = form.formState.errors;
  const treatment = useWatch({ control: form.control, name: "cost_treatment" });
  const hint = COST_TREATMENTS.find((t) => t.value === treatment);

  async function onSubmit(values: ExpenseInput) {
    setFormError(null);
    const r = record
      ? await updateExpenseAction(record.id, values)
      : await createExpenseAction(values, key);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<ExpenseFormValues>, { message: messages[0] });
      setFormError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success(record ? "Expense updated" : "Expense recorded");
    setOpen(false);
    setKey(crypto.randomUUID());
    if (!record) router.push(`/expenses/${r.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
        data-testid="expense-form-dialog"
      >
        <DialogHeader>
          <DialogTitle>{record ? "Edit expense" : "Record expense"}</DialogTitle>
          <DialogDescription>
            Cost treatment decides whether this is a period expense or already part of inventory
            cost.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
          data-testid="expense-form"
        >
          {formError ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="description"
              label="Description"
              error={errors.description?.message}
              required
              className="sm:col-span-2"
            >
              <Input
                id="description"
                data-testid="input-description"
                placeholder="LPG refill, 11 kg"
                {...form.register("description")}
              />
            </FormField>
            <FormField name="amount" label="Amount (₱)" error={errors.amount?.message} required>
              <Input
                id="amount"
                inputMode="decimal"
                data-testid="input-amount"
                {...form.register("amount")}
              />
            </FormField>
            <FormField name="incurred_at" label="Date" error={errors.incurred_at?.message} required>
              <Input id="incurred_at" type="date" {...form.register("incurred_at")} />
            </FormField>
            <FormField
              name="expense_category_id"
              label="Category"
              error={errors.expense_category_id?.message}
              required
            >
              <NativeSelect
                id="expense_category_id"
                data-testid="select-category"
                {...form.register("expense_category_id")}
              >
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              name="cost_treatment"
              label="Cost treatment"
              error={errors.cost_treatment?.message}
              required
              description={hint?.hint}
            >
              <NativeSelect
                id="cost_treatment"
                data-testid="select-treatment"
                {...form.register("cost_treatment")}
              >
                {COST_TREATMENTS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField name="supplier_id" label="Supplier" error={errors.supplier_id?.message}>
              <NativeSelect id="supplier_id" {...form.register("supplier_id")}>
                <option value="">—</option>
                {options.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              name="payment_method"
              label="Paid via"
              error={errors.payment_method?.message}
            >
              <NativeSelect id="payment_method" {...form.register("payment_method")}>
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              name="payment_reference"
              label="Reference"
              error={errors.payment_reference?.message}
            >
              <Input id="payment_reference" {...form.register("payment_reference")} />
            </FormField>
            <FormField
              name="notes"
              label="Notes"
              error={errors.notes?.message}
              className="sm:col-span-2"
            >
              <Textarea id="expense_notes" rows={2} {...form.register("notes")} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="expense-submit"
            >
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              {record ? "Save" : "Record expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
