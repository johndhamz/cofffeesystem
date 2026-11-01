import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDateTime } from "@/lib/units/time";
import { getSessionContext, can } from "@/lib/auth/session";
import { getAdjustment } from "@/server/services/inventory.service";
import { ReverseAdjustmentButton } from "@/features/inventory/components/reverse-adjustment-button";
import { ADJUSTMENT_REASONS } from "@/features/inventory/schemas";

export default async function AdjustmentDetailPage({
  params,
}: PageProps<"/inventory/adjustments/[id]">) {
  const { id } = await params;
  const [ctx, adj] = await Promise.all([getSessionContext(), getAdjustment(id)]);
  const reason =
    ADJUSTMENT_REASONS.find((r) => r.value === adj.reason)?.label ??
    (adj.reason === "reversal" ? "Reversal" : adj.reason);

  return (
    <div className="space-y-6">
      <PageHeader
        title={adj.adjustment_number}
        description={`${reason}${adj.notes ? ` · ${adj.notes}` : ""}`}
        breadcrumb={
          <Link
            href="/inventory/adjustments"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeftIcon className="size-3" /> Adjustments
          </Link>
        }
        actions={
          <>
            <StatusBadge status={adj.status} />
            {can(ctx, "inventory.adjust") && adj.status === "posted" ? (
              <ReverseAdjustmentButton adjustmentId={adj.id} />
            ) : null}
          </>
        }
      />
      {adj.reversal_of_adjustment_id ? (
        <p className="text-muted-foreground text-sm">
          Reverses{" "}
          <Link
            href={`/inventory/adjustments/${adj.reversal_of_adjustment_id}`}
            className="underline"
          >
            the original adjustment
          </Link>
          .
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="adjustment-lines">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Cost effect</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(adj.inventory_adjustment_lines ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-xs">
                    {line.inventory_item_id.slice(0, 8)}…
                  </TableCell>
                  <TableCell>{line.inventory_locations?.name}</TableCell>
                  <TableCell className="text-right">
                    <WeightDisplay grams={line.quantity_delta} signed />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={line.total_cost} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{line.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        {adj.posted_at ? `Posted ${formatManilaDateTime(adj.posted_at)}` : "Draft"}
      </p>
    </div>
  );
}
