import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/shared/empty-state";
import { formatManilaDateTime } from "@/lib/units/time";
import { getSessionContext, can } from "@/lib/auth/session";
import { listAdjustments } from "@/server/services/inventory.service";
import { ADJUSTMENT_REASONS } from "@/features/inventory/schemas";

export const metadata: Metadata = { title: "Adjustments" };

export default async function AdjustmentsPage({
  searchParams,
}: PageProps<"/inventory/adjustments">) {
  const params = await searchParams;
  const page = Math.max(1, Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1);
  const [ctx, data] = await Promise.all([getSessionContext(), listAdjustments(page)]);
  const canAdjust = can(ctx, "inventory.adjust");
  const reasonLabel = (r: string) =>
    ADJUSTMENT_REASONS.find((x) => x.value === r)?.label ?? (r === "reversal" ? "Reversal" : r);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory adjustments"
        description="Corrections to stock. Posted adjustments are immutable; use a reversal to undo."
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Inventory
          </Link>
        }
        actions={
          canAdjust ? (
            <Button asChild data-testid="new-adjustment-button">
              <Link href="/inventory/adjustments/new">
                <PlusIcon /> New adjustment
              </Link>
            </Button>
          ) : null
        }
      />
      {data.rows.length === 0 ? (
        <EmptyState
          title="No adjustments yet"
          description="Use adjustments for count corrections, damage, samples and moisture loss."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table data-testid="adjustments-table">
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((a) => (
                <TableRow key={a.id} data-testid="adjustment-row">
                  <TableCell>
                    <Link
                      href={`/inventory/adjustments/${a.id}`}
                      className="font-medium hover:underline"
                    >
                      {a.adjustment_number}
                    </Link>
                  </TableCell>
                  <TableCell>{reasonLabel(a.reason)}</TableCell>
                  <TableCell>{a.inventory_adjustment_lines?.length ?? 0}</TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell>{formatManilaDateTime(a.posted_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
