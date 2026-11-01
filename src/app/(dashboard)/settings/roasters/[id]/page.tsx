import { EntityDetail } from "@/features/settings/master-data/entity-detail";

export default async function DetailPage({ params }: PageProps<"/settings/roasters/[id]">) {
  const { id } = await params;
  return <EntityDetail entityKey="roasters" id={id} />;
}
