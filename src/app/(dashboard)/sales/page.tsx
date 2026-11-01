import type { Metadata } from "next";
import { PlaceholderPage } from "@/features/dashboard/placeholder-page";

export const metadata: Metadata = { title: "Sales" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Sales"
      phase="Phase 5"
      description="Orders, invoices and stock deductions per sales channel."
    />
  );
}
