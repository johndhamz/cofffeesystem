import type { Metadata } from "next";
import Link from "next/link";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Suppliers" };

export default async function Page({ searchParams }: PageProps<"/settings/suppliers">) {
  return (
    <MasterDataPage
      entityKey="suppliers"
      searchParams={await searchParams}
      breadcrumb={
        <Link href="/settings" className="hover:underline">
          Settings
        </Link>
      }
    />
  );
}
