"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import {
  businessSettingsSchema,
  COSTING_METHOD_LABELS,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  type BusinessSettingsInput,
  type BusinessSettingsFormValues,
} from "./schemas";
import { updateBusinessSettingsAction } from "./actions";
import type { BusinessSettings } from "@/types";

interface Props {
  businessName: string;
  settings: BusinessSettings;
  roasters: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  canUpdate: boolean;
}

export function BusinessSettingsForm({
  businessName,
  settings,
  roasters,
  locations,
  canUpdate,
}: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<BusinessSettingsFormValues, unknown, BusinessSettingsInput>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      business_name: businessName,
      currency: settings.currency as "PHP",
      timezone: settings.timezone as "Asia/Manila",
      inventory_weight_unit: settings.inventory_weight_unit as "g" | "kg",
      costing_method: settings.costing_method as BusinessSettingsInput["costing_method"],
      default_roaster_id: settings.default_roaster_id ?? "",
      default_location_id: settings.default_location_id ?? "",
      require_mfa: settings.require_mfa,
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: BusinessSettingsInput) {
    setFormError(null);
    const result = await updateBusinessSettingsAction(values);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        form.setError(name as Path<BusinessSettingsFormValues>, { message: messages[0] });
      }
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  const disabled = !canUpdate || form.formState.isSubmitting;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      data-testid="business-settings-form"
    >
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <FormField
        name="business_name"
        label="Business name"
        error={errors.business_name?.message}
        required
      >
        <Input
          id="business_name"
          disabled={disabled}
          data-testid="input-business_name"
          {...form.register("business_name")}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="currency" label="Currency" error={errors.currency?.message}>
          <NativeSelect id="currency" disabled={disabled} {...form.register("currency")}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} — Philippine Peso
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField name="timezone" label="Timezone" error={errors.timezone?.message}>
          <NativeSelect id="timezone" disabled={disabled} {...form.register("timezone")}>
            {SUPPORTED_TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          name="inventory_weight_unit"
          label="Display weight unit"
          error={errors.inventory_weight_unit?.message}
          description="Stock is always stored in grams."
        >
          <NativeSelect
            id="inventory_weight_unit"
            disabled={disabled}
            {...form.register("inventory_weight_unit")}
          >
            <option value="g">Grams (g)</option>
            <option value="kg">Kilograms (kg)</option>
          </NativeSelect>
        </FormField>
        <FormField
          name="costing_method"
          label="Costing method"
          error={errors.costing_method?.message}
        >
          <NativeSelect
            id="costing_method"
            disabled={disabled}
            {...form.register("costing_method")}
          >
            {Object.entries(COSTING_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          name="default_roaster_id"
          label="Default roaster"
          error={errors.default_roaster_id?.message}
        >
          <NativeSelect
            id="default_roaster_id"
            disabled={disabled}
            data-testid="select-default_roaster_id"
            {...form.register("default_roaster_id")}
          >
            <option value="">— None —</option>
            {roasters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          name="default_location_id"
          label="Default inventory location"
          error={errors.default_location_id?.message}
        >
          <NativeSelect
            id="default_location_id"
            disabled={disabled}
            data-testid="select-default_location_id"
            {...form.register("default_location_id")}
          >
            <option value="">— None —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormField
        name="require_mfa"
        label="Require two-factor authentication"
        description="Every member must enrol an authenticator app before using the app."
      >
        <NativeSelect
          id="require_mfa"
          disabled={disabled}
          data-testid="select-require_mfa"
          {...form.register("require_mfa")}
        >
          <option value="false">Optional (members may enable it)</option>
          <option value="true">Required for all members</option>
        </NativeSelect>
      </FormField>
      {canUpdate ? (
        <Button type="submit" disabled={disabled} data-testid="settings-submit">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          Save settings
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm" data-testid="settings-readonly">
          Read-only: your role cannot change business settings.
        </p>
      )}
    </form>
  );
}
