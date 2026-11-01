import type { Metadata } from "next";
import { MasterDataPage } from "@/features/settings/master-data/master-data-page";

export const metadata: Metadata = { title: "Green Coffee" };

export default async function GreenCoffeePage({ searchParams }: PageProps<"/green-coffee">) {
  return <MasterDataPage entityKey="green_coffees" searchParams={await searchParams} />;
}
