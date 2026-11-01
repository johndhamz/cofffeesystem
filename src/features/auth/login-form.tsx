"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import { loginAction } from "@/lib/auth/actions";

export function LoginForm({ next, urlError }: { next?: string; urlError?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formError = state && !state.ok && !fieldErrors ? state.error.message : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Accounts are provisioned by the business owner.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4" data-testid="login-form" noValidate>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {urlError === "link_expired" ? (
            <Alert variant="destructive">
              <AlertDescription>
                That link has expired or was already used. Request a new one.
              </AlertDescription>
            </Alert>
          ) : null}
          {formError ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <FormField name="email" label="Email" error={fieldErrors?.email} required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              data-testid="email-input"
            />
          </FormField>
          <FormField name="password" label="Password" error={fieldErrors?.password} required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              data-testid="password-input"
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={pending} data-testid="login-submit">
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Sign in
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            <Link
              href="/forgot-password"
              className="underline-offset-4 hover:underline"
              data-testid="forgot-password-link"
            >
              Forgot your password?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
