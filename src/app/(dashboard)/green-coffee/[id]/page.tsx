import { EntityDetail } from "@/features/settings/master-data/entity-detail";

export default async function GreenCoffeeDetailPage({ params }: PageProps<"/green-coffee/[id]">) {
  const { id } = await params;
  return <EntityDetail entityKey="green_coffees" id={id} />;
}
