import type { Metadata } from "next";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return <MasterDataPage entityKey="customers" searchParams={await searchParams} />;
}
