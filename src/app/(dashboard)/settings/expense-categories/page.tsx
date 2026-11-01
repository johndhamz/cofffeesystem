import type { Metadata } from "next";
import Link from "next/link";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Expense categories" };

export default async function Page({ searchParams }: PageProps<"/settings/expense-categories">) {
  return (
    <MasterDataPage
      entityKey="expense_categories"
      searchParams={await searchParams}
      breadcrumb={
        <Link href="/settings" className="hover:underline">
          Settings
        </Link>
      }
    />
  );
}
