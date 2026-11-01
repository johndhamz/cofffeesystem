import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { getSessionContext, can } from "@/lib/auth/session";
import { getRoastBatch, getRoastFormOptions } from "@/server/services/roasting.service";
import { RoastBatchForm } from "@/features/roasting/components/roast-batch-form";

export default async function EditRoastPage({ params }: PageProps<"/roasting/[id]/edit">) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!can(ctx, "roasting.manage"))
    return <AccessDenied message="Your role cannot edit roast batches." />;
  const [{ detail }, options] = await Promise.all([getRoastBatch(id), getRoastFormOptions()]);
  if (detail.status !== "draft" && detail.status !== "in_progress") redirect(`/roasting/${id}`);
  // Lots currently in this batch must stay selectable even if their available stock is now below the input.
  const lotIds = new Set(options.lots.map((l) => l.id));
  for (const i of detail.roast_batch_inputs ?? []) {
    if (!lotIds.has(i.green_lot_id)) {
      options.lots.push({
        id: i.green_lot_id,
        label: `${i.green_coffee_lots?.green_coffees?.name ?? "Lot"} · ${i.green_coffee_lots?.lot_code ?? ""}`,
        available_g: 0,
        cost_per_kg: null,
      });
    }
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Edit ${detail.batch_number}`}
        breadcrumb={
          <Link href={`/roasting/${id}`} className="hover:underline">
            {detail.batch_number}
          </Link>
        }
      />
      <RoastBatchForm
        options={options}
        initial={{
          id: detail.id,
          values: {
            roaster_id: detail.roaster_id,
            roast_profile_id: detail.roast_profile_id ?? "",
            location_id: detail.location_id,
            operator_id: detail.operator_id ?? "",
            roast_date: detail.roast_date,
            notes: detail.notes ?? "",
            inputs: (detail.roast_batch_inputs ?? []).map((i) => ({
              green_lot_id: i.green_lot_id,
              input_weight_g: i.input_weight_g,
            })),
          },
        }}
      />
    </div>
  );
}
