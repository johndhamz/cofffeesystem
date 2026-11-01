import type { Metadata } from "next";
import Link from "next/link";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Roasters" };

export default async function Page({ searchParams }: PageProps<"/settings/roasters">) {
  return (
    <MasterDataPage
      entityKey="roasters"
      searchParams={await searchParams}
      breadcrumb={
        <Link href="/settings" className="hover:underline">
          Settings
        </Link>
      }
    />
  );
}
