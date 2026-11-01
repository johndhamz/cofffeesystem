import { EntityDetail } from "@/features/settings/master-data/entity-detail";

export default async function DetailPage({ params }: PageProps<"/packaging/materials/[id]">) {
  const { id } = await params;
  return <EntityDetail entityKey="packaging_materials" id={id} />;
}
