import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { getSessionContext, can } from "@/lib/auth/session";
import { getRoastBatch, getRoastFormOptions } from "@/server/services/roasting.service";
import { RoastCompletionForm } from "@/features/roasting/components/completion-form";
import { toCentavos } from "@/lib/money";

export default async function CompleteRoastPage({ params }: PageProps<"/roasting/[id]/complete">) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!can(ctx, "roasting.manage"))
    return <AccessDenied message="Your role cannot complete roast batches." />;
  const [{ summary, detail }, options] = await Promise.all([
    getRoastBatch(id),
    getRoastFormOptions(),
  ]);
  if (detail.status !== "draft" && detail.status !== "in_progress") redirect(`/roasting/${id}`);

  // Estimated green cost from each lot's current cost per kg (the exact cost is taken from cost layers at completion).
  const lotCost = new Map(options.lots.map((l) => [l.id, l.cost_per_kg ?? 0]));
  const estimatedGreenCost = (detail.roast_batch_inputs ?? []).reduce(
    (a, i) =>
      a + Math.round((toCentavos(lotCost.get(i.green_lot_id) ?? 0) * i.input_weight_g) / 1000),
    0,
  );
  const roaster = options.roasters.find((r) => r.id === detail.roaster_id);
  const fc = (detail.roast_events ?? []).find((e) => e.event_type === "first_crack_start");
  const drop = (detail.roast_events ?? []).find((e) => e.event_type === "drop");

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Complete ${detail.batch_number}`}
        breadcrumb={
          <Link href={`/roasting/${id}`} className="hover:underline">
            {summary.batch_number}
          </Link>
        }
      />
      <RoastCompletionForm
        batchId={detail.id}
        batchNumber={detail.batch_number}
        greenWeightG={detail.green_weight_g}
        estimatedGreenCostCentavos={estimatedGreenCost}
        roaster={
          roaster ?? {
            name: summary.roaster_name,
            capacity_g: summary.roaster_capacity_g,
            capacity_policy: "warn",
          }
        }
        existingCosts={(detail.roast_batch_costs ?? []).map((c) => ({
          cost_type: c.cost_type,
          amount: c.amount,
          notes: c.notes,
        }))}
        defaults={{
          roast_level: null,
          first_crack_seconds: fc?.elapsed_seconds ?? null,
          total_duration_seconds: drop?.elapsed_seconds ?? null,
        }}
      />
    </div>
  );
}
