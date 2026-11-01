import { EntityDetail } from "@/features/settings/master-data/entity-detail";

export default async function DetailPage({ params }: PageProps<"/roasting/profiles/[id]">) {
  const { id } = await params;
  return <EntityDetail entityKey="roast_profiles" id={id} />;
}
