import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requireBusiness } from "@/lib/auth/session";
import { getMfaStatus } from "@/lib/auth/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MfaSettings } from "@/features/security/mfa-settings";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const ctx = await requireBusiness();
  const db = await createSupabaseServerClient();
  const [status, { data: settings }] = await Promise.all([
    getMfaStatus(),
    db
      .from("business_settings")
      .select("require_mfa")
      .eq("business_id", ctx.business.businessId)
      .single(),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Security"
        description={`Signed in as ${ctx.profile.email}.`}
        breadcrumb={
          <Link href="/settings" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Settings
          </Link>
        }
      />
      <MfaSettings
        factors={status.factors}
        currentLevel={status.currentLevel}
        required={settings?.require_mfa ?? false}
      />
    </div>
  );
}
