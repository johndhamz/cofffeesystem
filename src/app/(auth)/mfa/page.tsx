import type { Metadata } from "next";
import { MfaChallengeForm } from "@/features/security/mfa-challenge-form";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/dashboard";
  return <MfaChallengeForm next={next} />;
}
