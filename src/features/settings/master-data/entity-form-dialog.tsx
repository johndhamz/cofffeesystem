"use client";

import { useState, type ReactNode } from "react";
import { useForm, type FieldValues, type Path } from "react-hook-form";
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
import {
  MASTER_ENTITIES,
  type DynamicOptions,
  type FieldDef,
  type MasterEntityKey,
} from "./entities";
import { createMasterRecordAction, updateMasterRecordAction } from "./actions";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface EntityFormDialogProps {
  entityKey: MasterEntityKey;
  trigger?: ReactNode;
  /** When provided, the dialog edits this record. */
  record?: Record<string, unknown> & { id: string };
  onSaved?: (id: string) => void;
  /** Controlled mode (used when the dialog is opened from a menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  dynamicOptions?: DynamicOptions;
}

export function EntityFormDialog({
  entityKey,
  trigger,
  record,
  onSaved,
  open: controlledOpen,
  onOpenChange,
  dynamicOptions,
}: EntityFormDialogProps) {
  const entity = MASTER_ENTITIES[entityKey];
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = Boolean(record);

  const defaults: FieldValues = {};
  for (const field of entity.fields) {
    const current = record?.[field.name];
    if (current === null || current === undefined) {
      // Required selects default to their first option so a native <select> never submits "".
      const options = dynamicOptions?.[field.name] ?? field.options;
      defaults[field.name] =
        field.type === "select" && field.required ? (options?.[0]?.value ?? "") : "";
    } else {
      defaults[field.name] = current;
    }
  }
  defaults.is_active = record ? Boolean(record.is_active) : true;

  const form = useForm<FieldValues>({
    resolver: zodResolver(entity.schema as never),
    defaultValues: defaults,
    mode: "onBlur",
  });

  async function onSubmit(values: FieldValues) {
    setFormError(null);
    const result: ActionResult<{ id: string }> = isEdit
      ? await updateMasterRecordAction(entityKey, record!.id, values)
      : await createMasterRecordAction(entityKey, values);
    if (!result.ok) {
      if (result.error.fieldErrors) {
        for (const [name, messages] of Object.entries(result.error.fieldErrors)) {
          if (name === "_form") setFormError(messages[0] ?? null);
          else form.setError(name as Path<FieldValues>, { message: messages[0] });
        }
      }
      if (!result.error.fieldErrors || result.error.code === "CONFLICT") {
        setFormError(result.error.message);
      }
      toast.error(result.error.message);
      return;
    }
    toast.success(`${entity.singular} ${isEdit ? "updated" : "created"}`);
    setOpen(false);
    form.reset(isEdit ? values : defaults);
    onSaved?.(result.data.id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFormError(null);
          form.reset(defaults);
        }
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
        data-testid={`${entityKey}-form-dialog`}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Edit ${entity.singular.toLowerCase()}`
              : `New ${entity.singular.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>{entity.description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
          data-testid={`${entityKey}-form`}
        >
          {formError ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {entity.fields.map((field) => (
              <FieldControl
                key={field.name}
                field={field}
                form={form}
                options={dynamicOptions?.[field.name]}
              />
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting} data-testid="form-submit">
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              {isEdit ? "Save changes" : `Create ${entity.singular.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldControl({
  field,
  form,
  options,
}: {
  field: FieldDef;
  form: ReturnType<typeof useForm<FieldValues>>;
  options?: { value: string; label: string }[];
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;
  const common = {
    id: field.name,
    "aria-invalid": error ? true : undefined,
    placeholder: field.placeholder,
    "data-testid": `input-${field.name}`,
  };
  return (
    <FormField
      name={field.name}
      label={field.label}
      description={field.description}
      error={error}
      required={field.required}
      className={cn(field.wide && "sm:col-span-2")}
    >
      {field.type === "textarea" ? (
        <Textarea {...common} rows={3} {...form.register(field.name)} />
      ) : field.type === "select" ? (
        <NativeSelect {...common} {...form.register(field.name)}>
          {!field.required ? <option value="">—</option> : null}
          {(options ?? field.options)?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      ) : field.type === "number" ? (
        <Input
          {...common}
          type="number"
          inputMode="numeric"
          step={field.step}
          min={field.min}
          max={field.max}
          {...form.register(field.name)}
        />
      ) : (
        <Input {...common} type={field.type} {...form.register(field.name)} />
      )}
    </FormField>
  );
}
