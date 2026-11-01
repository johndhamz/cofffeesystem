"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon, WalletIcon } from "lucide-react";
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
import { toManilaDateString } from "@/lib/units/time";
import { PAYMENT_METHODS } from "@/lib/sales/calculations";
import { paymentSchema, type PaymentInput } from "../schemas";
import { recordPaymentAction } from "../actions";

type FormValues = z.input<typeof paymentSchema>;

export function PaymentDialog({ orderId, outstanding }: { orderId: string; outstanding: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const form = useForm<FormValues, unknown, PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: outstanding.toFixed(2),
      payment_method: "cash",
      payment_reference: "",
      received_at: toManilaDateString(),
      notes: "",
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: PaymentInput) {
    const r = await recordPaymentAction(orderId, values, key);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      toast.error(r.error.message);
      return;
    }
    toast.success("Payment recorded");
    setOpen(false);
    setKey(crypto.randomUUID());
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="record-payment-button">
          <WalletIcon /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="payment-dialog">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Outstanding {formatPHP(toCentavos(outstanding))}. Payments never change revenue; they
            settle the balance.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
          data-testid="payment-form"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="amount" label="Amount (₱)" error={errors.amount?.message} required>
              <Input
                id="amount"
                inputMode="decimal"
                data-testid="input-payment-amount"
                {...form.register("amount")}
              />
            </FormField>
            <FormField
              name="payment_method"
              label="Method"
              error={errors.payment_method?.message}
              required
            >
              <NativeSelect
                id="payment_method"
                data-testid="select-payment-method"
                {...form.register("payment_method")}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              name="received_at"
              label="Received on"
              error={errors.received_at?.message}
              required
            >
              <Input id="received_at" type="date" {...form.register("received_at")} />
            </FormField>
            <FormField
              name="payment_reference"
              label="Reference"
              error={errors.payment_reference?.message}
              description="GCash/bank ref — duplicates are rejected"
            >
              <Input
                id="payment_reference"
                data-testid="input-payment-reference"
                {...form.register("payment_reference")}
              />
            </FormField>
            <FormField
              name="notes"
              label="Notes"
              error={errors.notes?.message}
              className="sm:col-span-2"
            >
              <Textarea id="payment_notes" rows={2} {...form.register("notes")} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="payment-submit"
            >
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
