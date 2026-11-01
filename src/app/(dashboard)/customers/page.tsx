import type { Metadata } from "next";
import { PlaceholderPage } from "@/features/dashboard/placeholder-page";

export const metadata: Metadata = { title: "Customers" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Customers"
      phase="Phase 5"
      description="Wholesale and retail customer records."
    />
  );
}
