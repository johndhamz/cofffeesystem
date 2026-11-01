import type { Metadata } from "next";
import Link from "next/link";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Packaging materials" };

export default async function Page({ searchParams }: PageProps<"/packaging/materials">) {
  return (
    <MasterDataPage
      entityKey="packaging_materials"
      searchParams={await searchParams}
      breadcrumb={
        <Link href="/packaging" className="hover:underline">
          Packaging
        </Link>
      }
    />
  );
}
