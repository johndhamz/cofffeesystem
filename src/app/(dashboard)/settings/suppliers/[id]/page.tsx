import { EntityDetail } from "@/features/settings/master-data/entity-detail";

export default async function DetailPage({ params }: PageProps<"/settings/suppliers/[id]">) {
  const { id } = await params;
  return <EntityDetail entityKey="suppliers" id={id} />;
}
