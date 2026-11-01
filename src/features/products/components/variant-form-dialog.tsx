"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import { PACKAGING_TYPES } from "@/lib/packaging/calculations";
import { variantSchema, type VariantFormValues, type VariantInput } from "../schemas";
import { saveVariantAction } from "../actions";

interface Material {
  id: string;
  name: string;
  base_unit: string;
}

interface Props {
  productId: string;
  trigger: ReactNode;
  materials: Material[];
  record?: {
    id: string;
    sku: string;
    name: string;
    net_weight_g: number;
    packaging_type: string;
    selling_price: number;
    wholesale_price: number | null;
    is_active: boolean;
    materials: { material_id: string; quantity_per_unit: number }[];
  };
}

export function VariantFormDialog({ productId, trigger, materials, record }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<VariantFormValues, unknown, VariantInput>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      sku: record?.sku ?? "",
      name: record?.name ?? "",
      net_weight_g: (record?.net_weight_g ?? "") as unknown as number,
      packaging_type: (record?.packaging_type ?? "bag") as VariantFormValues["packaging_type"],
      selling_price: record ? record.selling_price.toFixed(2) : "",
      wholesale_price: record?.wholesale_price != null ? record.wholesale_price.toFixed(2) : "",
      is_active: record?.is_active ?? true,
      materials: materials.map((m) => ({
        material_id: m.id,
        quantity_per_unit:
          record?.materials.find((x) => x.material_id === m.id)?.quantity_per_unit ?? 0,
      })),
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: VariantInput) {
    setFormError(null);
    const r = await saveVariantAction(productId, record?.id ?? null, values);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<VariantFormValues>, { message: messages[0] });
      setFormError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success(record ? "Variant updated" : "Variant added");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
        data-testid="variant-form-dialog"
      >
        <DialogHeader>
          <DialogTitle>{record ? "Edit variant" : "New variant"}</DialogTitle>
          <DialogDescription>
            Net weight drives packaging requirements; the bill of materials drives material usage.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
          data-testid="variant-form"
        >
          {formError ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="sku" label="SKU" error={errors.sku?.message} required>
              <Input
                id="sku"
                data-testid="input-sku"
                placeholder="SKR-250"
                {...form.register("sku")}
              />
            </FormField>
            <FormField name="name" label="Variant name" error={errors.name?.message} required>
              <Input
                id="variant_name"
                data-testid="input-variant-name"
                placeholder="250 g bag"
                {...form.register("name")}
              />
            </FormField>
            <FormField
              name="net_weight_g"
              label="Net weight (g)"
              error={errors.net_weight_g?.message}
              required
            >
              <Input
                id="net_weight_g"
                inputMode="numeric"
                data-testid="input-net-weight"
                {...form.register("net_weight_g")}
              />
            </FormField>
            <FormField
              name="packaging_type"
              label="Packaging"
              error={errors.packaging_type?.message}
            >
              <NativeSelect id="packaging_type" {...form.register("packaging_type")}>
                {PACKAGING_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              name="selling_price"
              label="Retail price (₱)"
              error={errors.selling_price?.message}
            >
              <Input
                id="selling_price"
                inputMode="decimal"
                data-testid="input-selling-price"
                {...form.register("selling_price")}
              />
            </FormField>
            <FormField
              name="wholesale_price"
              label="Wholesale price (₱)"
              error={errors.wholesale_price?.message}
              description="Optional"
            >
              <Input
                id="wholesale_price"
                inputMode="decimal"
                data-testid="input-wholesale-price"
                {...form.register("wholesale_price")}
              />
            </FormField>
            {record ? (
              <FormField name="is_active" label="Status">
                <NativeSelect id="variant_is_active" {...form.register("is_active")}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </NativeSelect>
              </FormField>
            ) : null}
          </div>
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Bill of materials (per unit)</legend>
            {materials.length === 0 ? (
              <p className="text-muted-foreground text-sm">No packaging materials defined yet.</p>
            ) : null}
            {materials.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <input type="hidden" {...form.register(`materials.${i}.material_id`)} />
                <label htmlFor={`materials.${i}.quantity_per_unit`} className="flex-1 text-sm">
                  {m.name} <span className="text-muted-foreground">({m.base_unit})</span>
                </label>
                <Input
                  id={`materials.${i}.quantity_per_unit`}
                  inputMode="numeric"
                  className="w-24"
                  data-testid={`bom-${m.name.replace(/\s+/g, "-").toLowerCase()}`}
                  {...form.register(`materials.${i}.quantity_per_unit`)}
                />
              </div>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="variant-submit"
            >
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              {record ? "Save" : "Add variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
