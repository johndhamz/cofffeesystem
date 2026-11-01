import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { getSessionContext, can } from "@/lib/auth/session";
import { getPackagingFormOptions, getPackagingSession } from "@/server/services/packaging.service";
import { PackagingSessionForm } from "@/features/packaging/components/packaging-session-form";

export default async function EditPackagingPage({ params }: PageProps<"/packaging/[id]/edit">) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!can(ctx, "packaging.manage"))
    return <AccessDenied message="Your role cannot edit packaging sessions." />;
  const [{ detail }, options] = await Promise.all([
    getPackagingSession(id),
    getPackagingFormOptions(),
  ]);
  if (detail.status !== "draft") redirect(`/packaging/${id}`);
  const ids = new Set(options.batches.map((b) => b.id));
  for (const i of detail.packaging_inputs ?? [])
    if (!ids.has(i.roast_batch_id))
      options.batches.push({
        id: i.roast_batch_id,
        label: i.roast_batches?.batch_number ?? "Batch",
        available_g: 0,
        cost_per_kg: null,
      });
  const usage = new Map(
    (detail.packaging_material_usage ?? []).map((u) => [u.material_id, u.quantity]),
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Edit ${detail.session_number}`}
        breadcrumb={
          <Link href={`/packaging/${id}`} className="hover:underline">
            {detail.session_number}
          </Link>
        }
      />
      <PackagingSessionForm
        options={options}
        initial={{
          id: detail.id,
          values: {
            location_id: detail.location_id,
            packaged_at: detail.packaged_at,
            operator_id: detail.operator_id ?? "",
            labor_cost: detail.labor_cost.toFixed(2),
            overhead_cost: detail.overhead_cost.toFixed(2),
            notes: detail.notes ?? "",
            inputs: (detail.packaging_inputs ?? []).map((i) => ({
              roast_batch_id: i.roast_batch_id,
              input_weight_g: i.input_weight_g,
            })),
            outputs: (detail.packaging_outputs ?? []).map((o) => ({
              variant_id: o.variant_id,
              quantity: o.quantity,
              lot_code: o.lot_code ?? "",
              best_before_at: o.best_before_at ?? "",
            })),
            materials: options.materials.map((m) => ({
              material_id: m.id,
              quantity: usage.get(m.id) ?? 0,
            })),
          },
        }}
      />
    </div>
  );
}
