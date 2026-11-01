import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";
import { parseListQuery } from "@/lib/validation/common";
import { getSessionContext, can } from "@/lib/auth/session";
import { getDynamicOptions, listMasterRecords } from "@/server/services/master-data.service";
import { MASTER_ENTITIES, type MasterEntityKey } from "./entities";
import { EntityFormDialog } from "./entity-form-dialog";
import { MasterDataTable } from "./master-data-table";

interface MasterDataPageProps {
  entityKey: MasterEntityKey;
  searchParams: Record<string, string | string[] | undefined>;
  breadcrumb?: React.ReactNode;
}

/** Server component shared by every master-data list page. */
export async function MasterDataPage({ entityKey, searchParams, breadcrumb }: MasterDataPageProps) {
  const entity = MASTER_ENTITIES[entityKey];
  const query = parseListQuery(searchParams);
  const [ctx, data, dynamicOptions] = await Promise.all([
    getSessionContext(),
    listMasterRecords(entityKey, query),
    getDynamicOptions(entityKey),
  ]);
  const canManage = can(ctx, entity.managePermission);
  const canDelete = ctx?.business?.role === "owner";

  const createButton = canManage ? (
    <EntityFormDialog
      entityKey={entityKey}
      dynamicOptions={dynamicOptions}
      trigger={
        <Button data-testid="create-button">
          <PlusIcon /> New {entity.singular.toLowerCase()}
        </Button>
      }
    />
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={entity.plural}
        description={entity.description}
        actions={createButton}
        breadcrumb={breadcrumb}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder={`Search ${entity.plural.toLowerCase()}…`} />
        <ParamSelect
          paramKey="status"
          label="Status"
          defaultValue="active"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      <MasterDataTable
        entityKey={entityKey}
        data={data as never}
        canManage={canManage}
        canDelete={canDelete}
        emptyAction={createButton}
        dynamicOptions={dynamicOptions}
      />
    </div>
  );
}
