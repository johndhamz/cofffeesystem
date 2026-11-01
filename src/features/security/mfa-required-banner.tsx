import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function MfaRequiredBanner() {
  return (
    <Alert className="mb-4" data-testid="mfa-required-banner">
      <ShieldAlertIcon />
      <AlertTitle>Two-factor authentication is required</AlertTitle>
      <AlertDescription>
        Your business requires an authenticator app for every member.{" "}
        <Link href="/settings/security" className="underline">
          Enable it now
        </Link>{" "}
        to continue.
      </AlertDescription>
    </Alert>
  );
}
