import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDate, formatManilaDateTime } from "@/lib/units/time";
import { formatDuration, ROAST_LEVEL_LABELS } from "@/lib/roasting/calculations";
import { getSessionContext, can } from "@/lib/auth/session";
import { getRoastBatch, getRoastFormOptions } from "@/server/services/roasting.service";
import { RoastBatchActions } from "@/features/roasting/components/roast-batch-actions";
import { MeasurementEditor } from "@/features/roasting/components/measurement-editor";
import { EventsPanel } from "@/features/roasting/components/events-panel";
import { RoastChart } from "@/features/roasting/components/roast-chart";
import { AttachmentsPanel } from "@/features/roasting/components/attachments-panel";
import { COST_TYPES, ROAST_STATUS_LABELS } from "@/features/roasting/schemas";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COST_LABELS: Record<string, string> = Object.fromEntries(
  COST_TYPES.map((c) => [c.value, c.label]),
);

export default async function RoastDetailPage({ params }: PageProps<"/roasting/[id]">) {
  const { id } = await params;
  const [ctx, { summary, detail }] = await Promise.all([getSessionContext(), getRoastBatch(id)]);
  const canManage = can(ctx, "roasting.manage");
  const editable = canManage && detail.status !== "voided";
  const db = await createSupabaseServerClient();
  const roaster = await masterDataRepository(db, "roasters").getById(
    ctx!.business!.businessId,
    detail.roaster_id,
  );
  const tone =
    detail.status === "completed"
      ? "success"
      : detail.status === "in_progress"
        ? "info"
        : detail.status === "voided"
          ? "danger"
          : "neutral";
  void getRoastFormOptions; // options only needed on edit/complete screens

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.batch_number}
        description={`${summary.coffee_names ?? "—"} · ${summary.roaster_name} · ${formatManilaDate(detail.roast_date)} · ${summary.operator_name ?? "no operator"}`}
        breadcrumb={
          <Link href="/roasting" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Roast Production
          </Link>
        }
        actions={
          <>
            <StatusBadge
              status={detail.status}
              label={ROAST_STATUS_LABELS[detail.status]}
              tone={tone}
            />
            <RoastBatchActions
              id={detail.id}
              status={detail.status}
              canManage={canManage}
              hasInputs={(detail.roast_batch_inputs ?? []).length > 0}
            />
          </>
        }
      />
      {detail.status === "voided" ? (
        <p className="text-destructive text-sm" data-testid="void-notice">
          Voided {formatManilaDateTime(detail.voided_at)}: {detail.void_reason}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="roast-stats">
        <MetricCard
          label="Green input"
          value={<WeightDisplay grams={detail.green_weight_g} />}
          hint={`${summary.lot_count ?? 0} lot(s)`}
          testId="stat-green"
        />
        <MetricCard
          label="Roasted output"
          value={<WeightDisplay grams={detail.roasted_weight_g} />}
          hint={detail.roast_level ? ROAST_LEVEL_LABELS[detail.roast_level] : undefined}
          testId="stat-roasted"
        />
        <MetricCard
          label="Weight loss / yield"
          value={
            detail.roast_loss_pct !== null
              ? `${detail.roast_loss_pct}% / ${detail.roast_yield_pct}%`
              : "—"
          }
          testId="stat-loss"
        />
        <MetricCard
          label="Cost / roasted kg"
          value={<CurrencyDisplay value={summary.roasted_cost_per_kg} />}
          hint={
            detail.production_cost_total !== null
              ? `total ₱${detail.production_cost_total.toFixed(2)}`
              : undefined
          }
          testId="stat-cost"
        />
        <MetricCard
          label="Duration"
          value={formatDuration(detail.total_duration_seconds)}
          hint={
            detail.first_crack_seconds !== null
              ? `FC at ${formatDuration(detail.first_crack_seconds)}`
              : undefined
          }
        />
        <MetricCard
          label="Development ratio"
          value={detail.development_ratio_pct !== null ? `${detail.development_ratio_pct}%` : "—"}
          hint={
            detail.development_seconds !== null
              ? `${formatDuration(detail.development_seconds)} development`
              : undefined
          }
          testId="stat-dtr"
        />
        <MetricCard
          label="Roasted on hand"
          value={<WeightDisplay grams={summary.roasted_on_hand_g} />}
          hint={summary.roasted_item_id ? "tracked in inventory" : "not yet produced"}
          testId="stat-on-hand"
        />
        <MetricCard
          label="Temperatures"
          value={
            detail.charge_bt_c !== null || detail.drop_bt_c !== null
              ? `${detail.charge_bt_c ?? "—"} → ${detail.drop_bt_c ?? "—"} °C`
              : "—"
          }
          hint={detail.first_crack_bt_c !== null ? `FC ${detail.first_crack_bt_c} °C` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Green coffee inputs</CardTitle>
            <CardDescription>Traceable to the original lots and their actual cost.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="roast-inputs">
              <TableHeader>
                <TableRow>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Green cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detail.roast_batch_inputs ?? []).map((i) => (
                  <TableRow key={i.id} data-testid="roast-input">
                    <TableCell>
                      <Link href={`/inventory/lots/${i.green_lot_id}`} className="hover:underline">
                        {i.green_coffee_lots?.green_coffees?.name} · {i.green_coffee_lots?.lot_code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <WeightDisplay grams={i.input_weight_g} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay value={i.allocated_green_cost} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production cost</CardTitle>
            <CardDescription>Snapshot taken at completion; never recalculated.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1 text-sm" data-testid="roast-costs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Green coffee</dt>
                <dd>
                  <CurrencyDisplay value={detail.green_cost} />
                </dd>
              </div>
              {(detail.roast_batch_costs ?? []).map((c) => (
                <div key={c.id} className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {COST_LABELS[c.cost_type] ?? c.cost_type}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </dt>
                  <dd>
                    <CurrencyDisplay value={c.amount} />
                  </dd>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1 font-medium">
                <dt>Total</dt>
                <dd>
                  <CurrencyDisplay value={detail.production_cost_total} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Per gram</dt>
                <dd className="tabular-nums">
                  {detail.roasted_cost_per_g !== null
                    ? `₱${detail.roasted_cost_per_g.toFixed(6)}`
                    : "—"}
                </dd>
              </div>
            </dl>
            {detail.notes ? (
              <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">
                {detail.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roast curve</CardTitle>
          <CardDescription>
            Bean temperature, environment temperature and rate of rise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoastChart measurements={detail.roast_measurements ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Measurements</CardTitle>
          <CardDescription>
            Manual entries.{" "}
            {roaster?.max_gas_kpa
              ? `Max gas ${roaster.max_gas_kpa} kPa (configured).`
              : "No gas limit configured for this roaster."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MeasurementEditor
            batchId={detail.id}
            measurements={detail.roast_measurements ?? []}
            canEdit={editable}
            maxGasKpa={roaster?.max_gas_kpa ?? null}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events</CardTitle>
          </CardHeader>
          <CardContent>
            <EventsPanel
              batchId={detail.id}
              events={detail.roast_events ?? []}
              canEdit={editable}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentsPanel
              batchId={detail.id}
              attachments={detail.roast_attachments ?? []}
              canEdit={editable}
            />
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-xs">
        Created {formatManilaDateTime(detail.created_at)}
        {detail.started_at ? ` · started ${formatManilaDateTime(detail.started_at)}` : ""}
        {detail.completed_at ? ` · completed ${formatManilaDateTime(detail.completed_at)}` : ""}
      </p>
    </div>
  );
}
