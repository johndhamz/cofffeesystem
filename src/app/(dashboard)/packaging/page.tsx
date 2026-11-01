import type { Metadata } from "next";
import { PlaceholderPage } from "@/features/dashboard/placeholder-page";

export const metadata: Metadata = { title: "Packaging" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Packaging"
      phase="Phase 4"
      description="Pack roasted bulk into finished products and track packaging materials."
    />
  );
}
