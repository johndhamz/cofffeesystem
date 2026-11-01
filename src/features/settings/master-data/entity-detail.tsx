import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ActiveBadge } from "@/components/shared/status-badge";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDateTime } from "@/lib/units/time";
import { getSessionContext, can } from "@/lib/auth/session";
import { getDynamicOptions, getMasterRecord } from "@/server/services/master-data.service";
import { MASTER_ENTITIES, OPTION_LABELS, type MasterEntityKey } from "./entities";
import { MasterRowActions } from "./row-actions";

export async function EntityDetail({ entityKey, id }: { entityKey: MasterEntityKey; id: string }) {
  const entity = MASTER_ENTITIES[entityKey];
  const [ctx, record, dynamicOptions] = await Promise.all([
    getSessionContext(),
    getMasterRecord(entityKey, id),
    getDynamicOptions(entityKey),
  ]);
  if (!record) notFound();
  const row = record as Record<string, unknown> & {
    id: string;
    name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  const canManage = can(ctx, entity.managePermission);
  const canDelete = ctx?.business?.role === "owner";

  return (
    <div className="space-y-5">
      <PageHeader
        title={row.name}
        breadcrumb={
          <Link href={entity.basePath} className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> {entity.plural}
          </Link>
        }
        description={entity.singular}
        actions={
          <>
            <ActiveBadge isActive={row.is_active} />
            <MasterRowActions
              entityKey={entityKey}
              record={row}
              canManage={canManage}
              canDelete={canDelete}
              expanded
            />
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2" data-testid="detail-list">
            {entity.fields.map((field) => {
              const value = row[field.name];
              return (
                <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
                  <dt className="text-muted-foreground text-xs font-medium uppercase">
                    {field.label}
                  </dt>
                  <dd className="text-sm whitespace-pre-wrap" data-testid={`detail-${field.name}`}>
                    {value === null || value === undefined || value === "" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : field.name === "capacity_g" ? (
                      <WeightDisplay grams={Number(value)} />
                    ) : (
                      (dynamicOptions[field.name]?.find((o) => o.value === value)?.label ??
                      OPTION_LABELS[String(value)] ??
                      String(value))
                    )}
                  </dd>
                </div>
              );
            })}
            <div>
              <dt className="text-muted-foreground text-xs font-medium uppercase">Created</dt>
              <dd className="text-sm">{formatManilaDateTime(row.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium uppercase">Last updated</dt>
              <dd className="text-sm">{formatManilaDateTime(row.updated_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      {!canManage ? (
        <p className="text-muted-foreground text-sm">
          You can view this record but your role cannot edit it.{" "}
          <Button asChild variant="link" className="h-auto p-0">
            <Link href={entity.basePath}>Back to list</Link>
          </Button>
        </p>
      ) : null}
    </div>
  );
}
