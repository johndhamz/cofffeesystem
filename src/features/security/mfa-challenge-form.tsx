"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import { logoutAction } from "@/lib/auth/actions";
import { verifyMfaLoginAction } from "./actions";

export function MfaChallengeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(verifyMfaLoginAction, null);
  const error =
    state && !state.ok ? (state.error.fieldErrors?.code?.[0] ?? state.error.message) : undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4" noValidate data-testid="mfa-challenge-form">
          <input type="hidden" name="next" value={next} />
          {error ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormField name="code" label="Code" required>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="font-mono text-lg tracking-widest"
              data-testid="mfa-login-code"
            />
          </FormField>
          <Button
            type="submit"
            className="w-full"
            disabled={pending}
            data-testid="mfa-login-submit"
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null} Verify
          </Button>
        </form>
        <form action={logoutAction} className="mt-4 text-center">
          <Button type="submit" variant="link" className="h-auto p-0 text-sm">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
