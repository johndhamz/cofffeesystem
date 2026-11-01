import type { Metadata } from "next";
import { PlaceholderPage } from "@/features/dashboard/placeholder-page";

export const metadata: Metadata = { title: "Roast Production" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Roast Production"
      phase="Phase 3"
      description="Roast batches, green consumption, yield and roast profiles."
    />
  );
}
