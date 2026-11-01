import { EntityDetail } from "@/features/settings/master-data/entity-detail";

export default async function DetailPage({ params }: PageProps<"/settings/sales-channels/[id]">) {
  const { id } = await params;
  return <EntityDetail entityKey="sales_channels" id={id} />;
}
