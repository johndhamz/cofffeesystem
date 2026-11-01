"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>We will email you a link to choose a new password.</CardDescription>
      </CardHeader>
      <CardContent>
        {state?.ok ? (
          <Alert data-testid="reset-sent">
            <AlertDescription>
              If that email belongs to an account, a reset link is on its way.
            </AlertDescription>
          </Alert>
        ) : (
          <form action={action} className="space-y-4" noValidate data-testid="forgot-form">
            <FormField name="email" label="Email" error={fieldErrors?.email} required>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </FormField>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Send reset link
            </Button>
          </form>
        )}
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/login" className="underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
