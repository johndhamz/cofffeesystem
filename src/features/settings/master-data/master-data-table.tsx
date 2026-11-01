"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ActiveBadge } from "@/components/shared/status-badge";
import { WeightDisplay } from "@/components/shared/weight-display";
import { MASTER_ENTITIES, OPTION_LABELS, type MasterEntityKey } from "./entities";
import { MasterRowActions } from "./row-actions";
import type { Paginated } from "@/types";

type Row = Record<string, unknown> & { id: string; name: string; is_active: boolean };

interface MasterDataTableProps {
  entityKey: MasterEntityKey;
  data: Paginated<Row>;
  canManage: boolean;
  canDelete: boolean;
  emptyAction?: React.ReactNode;
}

export function MasterDataTable({
  entityKey,
  data,
  canManage,
  canDelete,
  emptyAction,
}: MasterDataTableProps) {
  const entity = MASTER_ENTITIES[entityKey];

  const columns: DataTableColumn<Row>[] = entity.columns.map((col) => ({
    key: col.key,
    header: col.label,
    sortable: col.sortable,
    hideOnMobile: col.hideOnMobile,
    cell: (row) => {
      const value = row[col.key];
      if (col.key === "name") {
        return (
          <Link
            href={`${entity.basePath}/${row.id}`}
            className="font-medium underline-offset-4 hover:underline"
            data-testid="row-name"
          >
            {String(value)}
          </Link>
        );
      }
      if (col.kind === "badge") return <ActiveBadge isActive={Boolean(value)} />;
      if (col.kind === "weight")
        return <WeightDisplay grams={typeof value === "number" ? value : null} />;
      if (value === null || value === undefined || value === "")
        return <span className="text-muted-foreground">—</span>;
      return OPTION_LABELS[String(value)] ?? String(value);
    },
  }));

  if (canManage) {
    columns.push({
      key: "_actions",
      header: "",
      className: "w-12 text-right",
      cell: (row) => (
        <MasterRowActions
          entityKey={entityKey}
          record={row}
          canManage={canManage}
          canDelete={canDelete}
        />
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={data.rows}
      rowKey={(r) => r.id}
      page={data.page}
      pageCount={data.pageCount}
      total={data.total}
      pageSize={data.pageSize}
      emptyTitle={`No ${entity.plural.toLowerCase()} found`}
      emptyDescription={
        canManage ? `Create your first ${entity.singular.toLowerCase()} to get started.` : undefined
      }
      emptyAction={emptyAction}
      testId={`${entityKey}-table`}
    />
  );
}
