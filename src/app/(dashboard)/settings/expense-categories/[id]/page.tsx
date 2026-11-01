import { EntityDetail } from "@/features/settings/master-data/entity-detail";

export default async function DetailPage({
  params,
}: PageProps<"/settings/expense-categories/[id]">) {
  const { id } = await params;
  return <EntityDetail entityKey="expense_categories" id={id} />;
}
