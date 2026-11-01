import type { Metadata } from "next";
import Link from "next/link";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Inventory locations" };

export default async function Page({ searchParams }: PageProps<"/settings/locations">) {
  return (
    <MasterDataPage
      entityKey="inventory_locations"
      searchParams={await searchParams}
      breadcrumb={
        <Link href="/settings" className="hover:underline">
          Settings
        </Link>
      }
    />
  );
}
