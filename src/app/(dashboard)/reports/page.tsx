import type { Metadata } from "next";
import { PlaceholderPage } from "@/features/dashboard/placeholder-page";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Reports"
      phase="Phase 6"
      description="Margins, inventory valuation and production reports."
    />
  );
}
