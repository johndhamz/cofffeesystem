"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { formatPHP, toCentavos } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/sales/calculations";
import { refundSchema } from "../schemas";
import { issueRefundAction } from "../actions";

type FormValues = z.input<typeof refundSchema>;
type Output = z.output<typeof refundSchema>;

export function RefundDialog({
  orderId,
  paymentId,
  refundable,
  method,
}: {
  orderId: string;
  paymentId: string;
  refundable: number;
  method: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const form = useForm<FormValues, unknown, Output>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      payment_id: paymentId,
      amount: refundable.toFixed(2),
      reason: "",
      refund_method: method as FormValues["refund_method"],
    },
  });
  const errors = form.formState.errors;
  async function onSubmit(values: Output) {
    const r = await issueRefundAction(orderId, values, key);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      toast.error(r.error.message);
      return;
    }
    toast.success("Refund issued");
    setOpen(false);
    setKey(crypto.randomUUID());
    router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" data-testid="refund-button">
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="refund-dialog">
        <DialogHeader>
          <DialogTitle>Issue refund</DialogTitle>
          <DialogDescription>
            Up to {formatPHP(toCentavos(refundable))} can be refunded from this payment. Refunds do
            not return stock; record a return for that.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <input type="hidden" {...form.register("payment_id")} />
          <FormField name="amount" label="Amount (₱)" error={errors.amount?.message} required>
            <Input
              id="refund_amount"
              inputMode="decimal"
              data-testid="input-refund-amount"
              {...form.register("amount")}
            />
          </FormField>
          <FormField name="refund_method" label="Method" error={errors.refund_method?.message}>
            <NativeSelect id="refund_method" {...form.register("refund_method")}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField name="reason" label="Reason" error={errors.reason?.message} required>
            <Textarea
              id="refund_reason"
              rows={2}
              data-testid="input-refund-reason"
              {...form.register("reason")}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="refund-submit"
            >
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}Issue
              refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
