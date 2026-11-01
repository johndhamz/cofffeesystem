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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/shared/form-field";
import { formatPHP, toCentavos } from "@/lib/money";
import { toManilaDateString } from "@/lib/units/time";
import { orderTotals } from "@/lib/sales/calculations";
import { salesOrderSchema, type SalesOrderFormValues, type SalesOrderInput } from "../schemas";
import { createSalesOrderAction, updateSalesOrderDraftAction } from "../actions";

export interface OrderFormOptions {
  customers: { id: string; name: string; customer_type: string }[];
  channels: { id: string; name: string; channel_type: string }[];
  variants: {
    id: string;
    label: string;
    selling_price: number;
    wholesale_price: number | null;
    available: number;
  }[];
}

interface Props {
  options: OrderFormOptions;
  initial?: { id: string; values: SalesOrderFormValues };
}

const parse = (s: unknown) => {
  try {
    return toCentavos(String(s ?? "0") || "0");
  } catch {
    return -1; // invalid input → line ignored in the preview
  }
};

export function OrderForm({ options, initial }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const form = useForm<SalesOrderFormValues, unknown, SalesOrderInput>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues: initial?.values ?? {
      customer_id: "",
      sales_channel_id: options.channels[0]?.id ?? "",
      price_tier: "retail",
      ordered_at: toManilaDateString(),
      due_at: "",
      discount_amount: "",
      notes: "",
      items: [
        {
          product_variant_id: "",
          quantity: "" as unknown as number,
          unit_price: "",
          discount_amount: "",
        },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const errors = form.formState.errors;
  const w = useWatch({ control: form.control });

  const totals = useMemo(() => {
    // Preview only: invalid or partial input (negative prices, blanks) is treated as zero here;
    // the schema and the database reject it on submit.
    const lines = (w.items ?? [])
      .map((i) => {
        const q = Number(i.quantity);
        const price = parse(i.unit_price);
        const discount = parse(i.discount_amount);
        if (!Number.isInteger(q) || q <= 0 || price < 0 || discount < 0) return null;
        return {
          quantity: q,
          unitPriceCentavos: price,
          discountCentavos: Math.min(discount, q * price),
        };
      })
      .filter(Boolean) as {
      quantity: number;
      unitPriceCentavos: number;
      discountCentavos: number;
    }[];
    try {
      return orderTotals(lines, Math.max(0, parse(w.discount_amount)));
    } catch {
      return {
        subtotalCentavos: 0,
        lineDiscountCentavos: 0,
        orderDiscountCentavos: 0,
        totalCentavos: 0,
      };
    }
  }, [w]);

  function priceFor(variantId: string) {
    const v = options.variants.find((x) => x.id === variantId);
    if (!v) return "";
    const tier =
      w.price_tier === "wholesale" && v.wholesale_price !== null
        ? v.wholesale_price
        : v.selling_price;
    return tier.toFixed(2);
  }

  async function onSubmit(values: SalesOrderInput) {
    setFormError(null);
    const r = initial
      ? await updateSalesOrderDraftAction(initial.id, values)
      : await createSalesOrderAction(values, idempotencyKey);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<SalesOrderFormValues>, { message: messages[0] });
      setFormError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success(initial ? "Order updated" : "Order created as draft");
    router.push(`/sales/${r.data.id}`);
    router.refresh();
  }

  const stockIssues = (w.items ?? [])
    .map((i) => {
      const v = options.variants.find((x) => x.id === i.product_variant_id);
      return v && Number(i.quantity) > v.available
        ? `${v.label}: only ${v.available} available`
        : null;
    })
    .filter(Boolean) as string[];

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      data-testid="order-form"
    >
      {formError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            name="customer_id"
            label="Customer"
            error={errors.customer_id?.message}
            description="Leave blank for walk-in"
          >
            <NativeSelect
              id="customer_id"
              data-testid="select-customer"
              {...form.register("customer_id", {
                onChange: (e) => {
                  const c = options.customers.find((x) => x.id === e.target.value);
                  if (c)
                    form.setValue(
                      "price_tier",
                      c.customer_type === "wholesale" ? "wholesale" : "retail",
                    );
                },
              })}
            >
              <option value="">Walk-in / no customer</option>
              {options.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            name="sales_channel_id"
            label="Channel"
            error={errors.sales_channel_id?.message}
            required
          >
            <NativeSelect
              id="sales_channel_id"
              data-testid="select-channel"
              {...form.register("sales_channel_id")}
            >
              {options.channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField name="price_tier" label="Price tier" error={errors.price_tier?.message}>
            <NativeSelect
              id="price_tier"
              data-testid="select-price-tier"
              {...form.register("price_tier", {
                onChange: () => {
                  (w.items ?? []).forEach((i, idx) => {
                    if (i.product_variant_id)
                      form.setValue(`items.${idx}.unit_price`, priceFor(i.product_variant_id));
                  });
                },
              })}
            >
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </NativeSelect>
          </FormField>
          <FormField
            name="ordered_at"
            label="Order date"
            error={errors.ordered_at?.message}
            required
          >
            <Input id="ordered_at" type="date" {...form.register("ordered_at")} />
          </FormField>
          <FormField name="due_at" label="Payment due" error={errors.due_at?.message}>
            <Input id="due_at" type="date" {...form.register("due_at")} />
          </FormField>
          <FormField
            name="discount_amount"
            label="Order discount (₱)"
            error={errors.discount_amount?.message}
          >
            <Input
              id="discount_amount"
              inputMode="decimal"
              data-testid="input-order-discount"
              {...form.register("discount_amount")}
            />
          </FormField>
          <FormField
            name="notes"
            label="Notes"
            error={errors.notes?.message}
            className="lg:col-span-2"
          >
            <Textarea id="notes" rows={1} {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Items</CardTitle>
            <CardDescription>
              Prices default from the variant for the selected tier and can be edited.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                product_variant_id: "",
                quantity: "" as unknown as number,
                unit_price: "",
                discount_amount: "",
              })
            }
            data-testid="add-item"
          >
            <PlusIcon /> Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {typeof errors.items?.message === "string" ? (
            <p className="text-destructive text-sm">{errors.items.message}</p>
          ) : null}
          {fields.map((f, i) => {
            const v = options.variants.find((x) => x.id === w.items?.[i]?.product_variant_id);
            return (
              <div
                key={f.id}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_100px_140px_140px_auto] sm:items-end"
                data-testid="order-item-row"
              >
                <FormField
                  name={`items.${i}.product_variant_id`}
                  label="Product"
                  error={errors.items?.[i]?.product_variant_id?.message}
                  required
                  description={v ? `${v.available} available` : undefined}
                >
                  <NativeSelect
                    id={`items.${i}.product_variant_id`}
                    data-testid="select-variant"
                    {...form.register(`items.${i}.product_variant_id`, {
                      onChange: (e) =>
                        form.setValue(`items.${i}.unit_price`, priceFor(e.target.value)),
                    })}
                  >
                    <option value="">Select…</option>
                    {options.variants.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label} — {x.available} avail.
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  name={`items.${i}.quantity`}
                  label="Qty"
                  error={errors.items?.[i]?.quantity?.message}
                  required
                >
                  <Input
                    id={`items.${i}.quantity`}
                    inputMode="numeric"
                    data-testid="input-quantity"
                    {...form.register(`items.${i}.quantity`)}
                  />
                </FormField>
                <FormField
                  name={`items.${i}.unit_price`}
                  label="Unit price (₱)"
                  error={errors.items?.[i]?.unit_price?.message}
                  required
                >
                  <Input
                    id={`items.${i}.unit_price`}
                    inputMode="decimal"
                    data-testid="input-unit-price"
                    {...form.register(`items.${i}.unit_price`)}
                  />
                </FormField>
                <FormField
                  name={`items.${i}.discount_amount`}
                  label="Line discount (₱)"
                  error={errors.items?.[i]?.discount_amount?.message}
                >
                  <Input
                    id={`items.${i}.discount_amount`}
                    inputMode="decimal"
                    data-testid="input-line-discount"
                    {...form.register(`items.${i}.discount_amount`)}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  disabled={fields.length === 1}
                  aria-label="Remove"
                >
                  <Trash2Icon />
                </Button>
              </div>
            );
          })}
          {stockIssues.length ? (
            <Alert data-testid="stock-warning">
              <AlertDescription>
                {stockIssues.join(" · ")} — confirmation will fail unless stock is produced first.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="ml-auto grid w-full max-w-xs gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums" data-testid="order-subtotal">
                {formatPHP(totals.subtotalCentavos)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discounts</span>
              <span className="tabular-nums">
                −{formatPHP(totals.lineDiscountCentavos + totals.orderDiscountCentavos)}
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums" data-testid="order-total">
                {formatPHP(totals.totalCentavos)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting} data-testid="order-submit">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {initial ? "Save draft" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
