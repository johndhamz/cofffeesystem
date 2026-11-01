"use client";

import { useState, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import { PRODUCT_CATEGORIES } from "@/lib/packaging/calculations";
import { productSchema, type ProductInput } from "../schemas";
import { createProductAction, updateProductAction } from "../actions";

type FormValues = z.input<typeof productSchema>;

interface Props {
  trigger: ReactNode;
  record?: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    is_active: boolean;
  };
}

export function ProductFormDialog({ trigger, record }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: record?.name ?? "",
      description: record?.description ?? "",
      category: (record?.category ?? "") as FormValues["category"],
      is_active: record?.is_active ?? true,
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: ProductInput) {
    setFormError(null);
    const r = record
      ? await updateProductAction(record.id, values)
      : await createProductAction(values);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      setFormError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success(record ? "Product updated" : "Product created");
    setOpen(false);
    if (!record) router.push(`/products/${r.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent data-testid="product-form-dialog">
        <DialogHeader>
          <DialogTitle>{record ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            A product groups sellable variants (e.g. 250 g and 500 g bags).
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
          data-testid="product-form"
        >
          {formError ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <FormField name="name" label="Name" error={errors.name?.message} required>
            <Input
              id="name"
              data-testid="input-name"
              placeholder="Sultan Kudarat Robusta"
              {...form.register("name")}
            />
          </FormField>
          <FormField name="category" label="Category" error={errors.category?.message}>
            <NativeSelect id="category" data-testid="input-category" {...form.register("category")}>
              <option value="">—</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField name="description" label="Description" error={errors.description?.message}>
            <Textarea id="description" rows={3} {...form.register("description")} />
          </FormField>
          {record ? (
            <FormField name="is_active" label="Status">
              <NativeSelect id="is_active" {...form.register("is_active")}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </NativeSelect>
            </FormField>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting} data-testid="form-submit">
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              {record ? "Save" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
