import type { Metadata } from "next";
import { PlaceholderPage } from "@/features/dashboard/placeholder-page";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Products"
      phase="Phase 4"
      description="Finished product catalog, pricing and variants."
    />
  );
}
