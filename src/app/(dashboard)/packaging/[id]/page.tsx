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
import { getSessionContext, can } from "@/lib/auth/session";
import { getPackagingSession } from "@/server/services/packaging.service";
import { PackagingSessionActions } from "@/features/packaging/components/packaging-session-actions";
import { PACKAGING_STATUS_LABELS } from "@/features/packaging/schemas";

export default async function PackagingDetailPage({ params }: PageProps<"/packaging/[id]">) {
  const { id } = await params;
  const [ctx, { summary, detail }] = await Promise.all([
    getSessionContext(),
    getPackagingSession(id),
  ]);
  const units = (detail.packaging_outputs ?? []).reduce((a, o) => a + o.quantity, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.session_number}
        description={`${summary.product_names ?? "—"} · ${formatManilaDate(detail.packaged_at)} · ${summary.operator_name ?? "no operator"} · ${summary.location_name}`}
        breadcrumb={
          <Link href="/packaging" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Packaging
          </Link>
        }
        actions={
          <>
            <StatusBadge
              status={detail.status}
              label={PACKAGING_STATUS_LABELS[detail.status]}
              tone={
                detail.status === "completed"
                  ? "success"
                  : detail.status === "voided"
                    ? "danger"
                    : "neutral"
              }
            />
            <PackagingSessionActions
              id={detail.id}
              status={detail.status}
              canManage={can(ctx, "packaging.manage")}
            />
          </>
        }
      />
      {detail.status === "voided" ? (
        <p className="text-destructive text-sm" data-testid="void-notice">
          Voided {formatManilaDateTime(detail.voided_at)}: {detail.void_reason}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="session-stats">
        <MetricCard
          label="Coffee required"
          value={<WeightDisplay grams={detail.required_weight_g} />}
          hint={`input ${detail.input_weight_g ?? 0} g`}
          testId="stat-required"
        />
        <MetricCard label="Finished units" value={units} testId="stat-units" />
        <MetricCard
          label="Total cost"
          value={<CurrencyDisplay value={detail.total_cost} />}
          hint={
            detail.coffee_cost !== null
              ? `coffee ₱${detail.coffee_cost.toFixed(2)} · materials ₱${(detail.material_cost ?? 0).toFixed(2)}`
              : "snapshot at completion"
          }
          testId="stat-cost"
        />
        <MetricCard
          label="Labor + overhead"
          value={<CurrencyDisplay value={detail.labor_cost + detail.overhead_cost} />}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roasted inputs</CardTitle>
            <CardDescription>
              Lineage to roast batches (and through them to green lots).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="session-inputs">
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Inherited cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detail.packaging_inputs ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Link href={`/roasting/${i.roast_batch_id}`} className="hover:underline">
                        {i.roast_batches?.batch_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <WeightDisplay grams={i.input_weight_g} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay value={i.inherited_cost} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materials used</CardTitle>
          </CardHeader>
          <CardContent>
            {(detail.packaging_material_usage ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No materials recorded.</p>
            ) : (
              <Table data-testid="session-materials">
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail.packaging_material_usage ?? []).map((u) => (
                    <TableRow key={u.id} data-material={u.packaging_materials?.name}>
                      <TableCell>{u.packaging_materials?.name}</TableCell>
                      <TableCell className="text-right">
                        {u.quantity} {u.packaging_materials?.base_unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay value={u.cost} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finished goods</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="session-outputs">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Line cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(detail.packaging_outputs ?? []).map((o) => (
                <TableRow key={o.id} data-testid="session-output">
                  <TableCell className="font-medium">
                    {o.product_variants?.products?.name} {o.product_variants?.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{o.product_variants?.sku}</TableCell>
                  <TableCell className="text-right">{o.quantity}</TableCell>
                  <TableCell>
                    {o.finished_lot_id ? (
                      <Link
                        href={`/inventory/finished/${o.finished_lot_id}`}
                        className="hover:underline"
                        data-testid="finished-lot-link"
                      >
                        {o.lot_code}
                      </Link>
                    ) : (
                      (o.lot_code ?? "auto")
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="output-unit-cost">
                    {o.unit_cost !== null ? `₱${o.unit_cost.toFixed(4)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={o.total_cost} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {detail.notes ? (
            <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">{detail.notes}</p>
          ) : null}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        Created {formatManilaDateTime(detail.created_at)}
        {detail.completed_at ? ` · completed ${formatManilaDateTime(detail.completed_at)}` : ""}
      </p>
    </div>
  );
}
