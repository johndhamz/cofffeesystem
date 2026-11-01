import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ActiveBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseListQuery } from "@/lib/validation/common";
import { getSessionContext, can } from "@/lib/auth/session";
import { listProducts } from "@/server/services/products.service";
import { ProductFormDialog } from "@/features/products/components/product-form-dialog";
import { PRODUCT_CATEGORIES } from "@/lib/packaging/calculations";

export const metadata: Metadata = { title: "Products" };
const CATEGORY: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.value, c.label]),
);

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const query = parseListQuery(await searchParams);
  const [ctx, data] = await Promise.all([getSessionContext(), listProducts(query)]);
  const canManage = can(ctx, "products.manage");
  const createButton = canManage ? (
    <ProductFormDialog
      trigger={
        <Button data-testid="create-button">
          <PlusIcon /> New product
        </Button>
      }
    />
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        description="Sellable coffee products and their weight variants, SKUs and prices."
        actions={createButton}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search products…" />
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
      {data.rows.length === 0 ? (
        <EmptyState
          title="No products"
          description="Create a product, then add weight variants with SKUs and prices."
          action={createButton}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table data-testid="products-table">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((p) => (
                <TableRow key={p.id} data-testid="data-row">
                  <TableCell>
                    <Link
                      href={`/products/${p.id}`}
                      className="font-medium hover:underline"
                      data-testid="row-name"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.category ? CATEGORY[p.category] : "—"}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-x-3 text-sm">
                      {p.product_variants
                        .filter((v) => v.is_active)
                        .map((v) => (
                          <span key={v.id}>
                            {v.name} · <CurrencyDisplay value={v.selling_price} />
                          </span>
                        ))}
                      {p.product_variants.length === 0 ? (
                        <span className="text-muted-foreground">none</span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ActiveBadge isActive={p.is_active} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
