import { EntityDetail } from "@/features/settings/master-data/entity-detail";

export default async function DetailPage({ params }: PageProps<"/settings/locations/[id]">) {
  const { id } = await params;
  return <EntityDetail entityKey="inventory_locations" id={id} />;
}
