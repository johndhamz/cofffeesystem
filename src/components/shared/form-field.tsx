"use client";

import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

interface FormFieldProps {
  name: string;
  label: string;
  description?: string;
  error?: string | string[];
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Consistent label + control + description + error layout.
 * Pass the control as children with `id={name}` for label association.
 */
export function FormField({
  name,
  label,
  description,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <Field
      data-invalid={message ? true : undefined}
      className={className}
      data-testid={`field-${name}`}
    >
      <FieldLabel htmlFor={name}>
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </FieldLabel>
      {children}
      {description && !message ? <FieldDescription>{description}</FieldDescription> : null}
      {message ? <FieldError data-testid={`error-${name}`}>{message}</FieldError> : null}
    </Field>
  );
}
