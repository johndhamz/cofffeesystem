"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import { updatePasswordAction } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, null);
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formError = state && !state.ok && !fieldErrors ? state.error.message : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Use at least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4" noValidate data-testid="reset-form">
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <FormField name="password" label="New password" error={fieldErrors?.password} required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </FormField>
          <FormField name="confirm" label="Confirm password" error={fieldErrors?.confirm} required>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
