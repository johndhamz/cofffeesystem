"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { formatManilaDateTime } from "@/lib/units/time";
import { startMfaEnrollmentAction, unenrollMfaAction, verifyMfaEnrollmentAction } from "./actions";

interface Props {
  factors: { id: string; friendlyName: string | null; createdAt: string }[];
  currentLevel: string | null;
  required: boolean;
}

export function MfaSettings({ factors, currentLevel, required }: Props) {
  const router = useRouter();
  const [enrol, setEnrol] = useState<{ factorId: string; qrSvg: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enabled = factors.length > 0;

  return (
    <Card data-testid="mfa-card" data-enabled={enabled}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {enabled ? (
            <ShieldCheckIcon className="size-4 text-emerald-600" />
          ) : (
            <ShieldOffIcon className="size-4" />
          )}{" "}
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          {enabled
            ? "Signing in requires your password and a 6-digit code from your authenticator app."
            : "Add a second step at sign-in using Google Authenticator, Authy, 1Password or any TOTP app."}
          {required && !enabled
            ? " Your business requires two-factor authentication: enrol to continue using the app."
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          <ul className="divide-y text-sm" data-testid="mfa-factors">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2">
                <span>
                  {f.friendlyName ?? "Authenticator app"}
                  <span className="text-muted-foreground block text-xs">
                    enrolled {formatManilaDateTime(f.createdAt)} · session level{" "}
                    {currentLevel ?? "—"}
                  </span>
                </span>
                <ConfirmDialog
                  title="Remove this authenticator?"
                  description={
                    required
                      ? "Your business requires two-factor authentication; you will be asked to enrol again."
                      : "Sign-in will go back to password only."
                  }
                  confirmLabel="Remove"
                  destructive
                  testId="mfa-remove-dialog"
                  onConfirm={async () => {
                    const r = await unenrollMfaAction(f.id);
                    if (!r.ok) {
                      toast.error(r.error.message);
                      throw new Error(r.error.message);
                    }
                    toast.success("Authenticator removed");
                    router.refresh();
                  }}
                  trigger={
                    <Button variant="outline" size="sm" data-testid="mfa-remove">
                      Remove
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        ) : enrol ? (
          <div className="space-y-4" data-testid="mfa-enrol">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div
                className="w-44 shrink-0 rounded-md border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: enrol.qrSvg }}
              />
              <div className="space-y-2 text-sm">
                <p>1. Scan the QR code with your authenticator app, or enter this key manually:</p>
                <code
                  className="bg-muted block rounded px-2 py-1 font-mono text-xs break-all"
                  data-testid="mfa-secret"
                >
                  {enrol.secret}
                </code>
                <p>2. Enter the 6-digit code the app shows to finish.</p>
              </div>
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                const r = await verifyMfaEnrollmentAction(enrol.factorId, { code });
                setBusy(false);
                if (!r.ok) {
                  setError(r.error.fieldErrors?.code?.[0] ?? r.error.message);
                  return;
                }
                toast.success("Two-factor authentication enabled");
                setEnrol(null);
                setCode("");
                router.refresh();
              }}
            >
              <FormField name="code" label="6-digit code" error={error ?? undefined} required>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-40 font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  data-testid="mfa-code"
                />
              </FormField>
              <Button type="submit" disabled={busy || code.length !== 6} data-testid="mfa-verify">
                {busy ? <Loader2Icon className="animate-spin" /> : null} Verify &amp; enable
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEnrol(null)}>
                Cancel
              </Button>
            </form>
          </div>
        ) : (
          <Button
            data-testid="mfa-enable"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await startMfaEnrollmentAction();
              setBusy(false);
              if (!r.ok) return toast.error(r.error.message);
              setEnrol(r.data);
            }}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />} Enable
            two-factor authentication
          </Button>
        )}
        {!enabled && !enrol ? (
          <Alert>
            <AlertDescription>
              Keep backup access in mind: if you lose your phone, an owner can remove your
              authenticator with the administrative process in docs/SECURITY.md.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
