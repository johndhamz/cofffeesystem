import type { Metadata } from "next";
import Link from "next/link";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Sales channels" };

export default async function Page({ searchParams }: PageProps<"/settings/sales-channels">) {
  return (
    <MasterDataPage
      entityKey="sales_channels"
      searchParams={await searchParams}
      breadcrumb={
        <Link href="/settings" className="hover:underline">
          Settings
        </Link>
      }
    />
  );
}
