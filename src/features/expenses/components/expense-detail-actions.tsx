"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { BanIcon, Link2Icon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { formatPHP, toCentavos } from "@/lib/money";
import { allocationSchema, type AllocationInput } from "../schemas";
import { addAllocationAction, removeAllocationAction, voidExpenseAction } from "../actions";
import { ExpenseFormDialog, type ExpenseOptions } from "./expense-form-dialog";
import type { ExpenseFormValues } from "../schemas";

type AllocForm = z.input<typeof allocationSchema>;

interface Targets {
  roast_batch: { id: string; label: string }[];
  packaging_session: { id: string; label: string }[];
  goods_receipt: { id: string; label: string }[];
}

export function ExpenseDetailActions({
  expense,
  options,
  targets,
  canManage,
  canAllocate,
  unallocated,
  isVoided,
}: {
  expense: { id: string } & ExpenseFormValues;
  options: ExpenseOptions;
  targets: Targets;
  canManage: boolean;
  canAllocate: boolean;
  unallocated: number;
  isVoided: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  if (!canManage || isVoided) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="expense-actions">
      <ExpenseFormDialog
        options={options}
        record={expense}
        trigger={
          <Button variant="outline" size="sm" data-testid="edit-expense">
            <PencilIcon /> Edit
          </Button>
        }
      />
      {canAllocate && unallocated > 0 ? (
        <AllocationDialog expenseId={expense.id} targets={targets} max={unallocated} />
      ) : null}
      <ConfirmDialog
        title="Void this expense?"
        confirmLabel="Void"
        destructive
        testId="void-expense-dialog"
        description={
          <span className="block space-y-3">
            <span className="block">
              Voided expenses are kept for audit but excluded from reports.
            </span>
            <FormField name="void_reason" label="Reason" required>
              <Textarea
                id="void_reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="void-reason"
              />
            </FormField>
          </span>
        }
        onConfirm={async () => {
          const r = await voidExpenseAction(expense.id, { reason });
          if (!r.ok) {
            toast.error(r.error.message);
            throw new Error(r.error.message);
          }
          toast.success("Expense voided");
          router.refresh();
        }}
        trigger={
          <Button variant="outline" size="sm" data-testid="void-expense">
            <BanIcon /> Void
          </Button>
        }
      />
    </div>
  );
}

function AllocationDialog({
  expenseId,
  targets,
  max,
}: {
  expenseId: string;
  targets: Targets;
  max: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<AllocForm, unknown, AllocationInput>({
    resolver: zodResolver(allocationSchema),
    defaultValues: { target_type: "roast_batch", target_id: "", amount: max.toFixed(2), notes: "" },
  });
  const errors = form.formState.errors;
  const type = useWatch({ control: form.control, name: "target_type" });
  async function onSubmit(values: AllocationInput) {
    const r = await addAllocationAction(expenseId, values);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<AllocForm>, { message: messages[0] });
      toast.error(r.error.message);
      return;
    }
    toast.success("Allocation recorded");
    setOpen(false);
    router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="allocate-expense">
          <Link2Icon /> Allocate
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="allocation-dialog">
        <DialogHeader>
          <DialogTitle>Allocate to production</DialogTitle>
          <DialogDescription>
            Links up to {formatPHP(toCentavos(max))} of this expense to the document whose recorded
            cost it explains. Allocation is traceability; it never changes COGS twice.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField name="target_type" label="Target" error={errors.target_type?.message}>
            <NativeSelect
              id="target_type"
              data-testid="select-target-type"
              {...form.register("target_type")}
            >
              <option value="roast_batch">Roast batch</option>
              <option value="packaging_session">Packaging session</option>
              <option value="goods_receipt">Goods receipt</option>
            </NativeSelect>
          </FormField>
          <FormField name="target_id" label="Document" error={errors.target_id?.message} required>
            <NativeSelect
              id="target_id"
              data-testid="select-target"
              {...form.register("target_id")}
            >
              <option value="">Select…</option>
              {targets[type as keyof Targets].map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField name="amount" label="Amount (₱)" error={errors.amount?.message} required>
            <Input
              id="alloc_amount"
              inputMode="decimal"
              data-testid="input-alloc-amount"
              {...form.register("amount")}
            />
          </FormField>
          <FormField name="notes" label="Notes" error={errors.notes?.message}>
            <Input id="alloc_notes" {...form.register("notes")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting} data-testid="alloc-submit">
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              Allocate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveAllocationButton({ expenseId, id }: { expenseId: string; id: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Remove allocation"
      onClick={async () => {
        const r = await removeAllocationAction(expenseId, id);
        if (!r.ok) return toast.error(r.error.message);
        router.refresh();
      }}
    >
      <Trash2Icon />
    </Button>
  );
}
