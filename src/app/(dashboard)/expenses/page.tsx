import type { Metadata } from "next";
import { PlaceholderPage } from "@/features/dashboard/placeholder-page";

export const metadata: Metadata = { title: "Expenses" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Expenses"
      phase="Phase 6"
      description="Operating and capital expenses by category."
    />
  );
}
