import type { Metadata } from "next";
import Link from "next/link";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Roast profiles" };

export default async function Page({ searchParams }: PageProps<"/roasting/profiles">) {
  return (
    <MasterDataPage
      entityKey="roast_profiles"
      searchParams={await searchParams}
      breadcrumb={
        <Link href="/roasting" className="hover:underline">
          Roast Production
        </Link>
      }
    />
  );
}
