import Link from "next/link";
import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ActiveBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { getSessionContext, can } from "@/lib/auth/session";
import { getProduct } from "@/server/services/products.service";
import { ProductFormDialog } from "@/features/products/components/product-form-dialog";
import { VariantFormDialog } from "@/features/products/components/variant-form-dialog";
import { PACKAGING_TYPES, PRODUCT_CATEGORIES } from "@/lib/packaging/calculations";

const CATEGORY: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.value, c.label]),
);
const PACK: Record<string, string> = Object.fromEntries(
  PACKAGING_TYPES.map((c) => [c.value, c.label]),
);

export default async function ProductDetailPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const [ctx, { product, materials }] = await Promise.all([getSessionContext(), getProduct(id)]);
  const canManage = can(ctx, "products.manage");
  const variants = [...(product.product_variants ?? [])].sort(
    (a, b) => a.net_weight_g - b.net_weight_g,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={
          [product.category ? CATEGORY[product.category] : null, product.description]
            .filter(Boolean)
            .join(" · ") || "Product"
        }
        breadcrumb={
          <Link href="/products" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Products
          </Link>
        }
        actions={
          <>
            <ActiveBadge isActive={product.is_active} />
            {canManage ? (
              <ProductFormDialog
                record={{
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  category: product.category,
                  is_active: product.is_active,
                }}
                trigger={
                  <Button variant="outline" size="sm" data-testid="edit-product">
                    <PencilIcon /> Edit
                  </Button>
                }
              />
            ) : null}
          </>
        }
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Variants</CardTitle>
          {canManage ? (
            <VariantFormDialog
              productId={product.id}
              materials={materials}
              trigger={
                <Button size="sm" data-testid="add-variant">
                  <PlusIcon /> Add variant
                </Button>
              }
            />
          ) : null}
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No variants yet. Add one per bag size (e.g. 250 g, 500 g).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="variants-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Net weight</TableHead>
                    <TableHead>Packaging</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                    <TableHead className="text-right">Wholesale</TableHead>
                    <TableHead>Materials / unit</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((v) => (
                    <TableRow key={v.id} data-testid="variant-row" data-sku={v.sku}>
                      <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-right">
                        <WeightDisplay grams={v.net_weight_g} />
                      </TableCell>
                      <TableCell>{PACK[v.packaging_type] ?? v.packaging_type}</TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay value={v.selling_price} />
                      </TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay value={v.wholesale_price} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {(v.variant_materials ?? [])
                          .map((m) => `${m.quantity_per_unit} × ${m.packaging_materials?.name}`)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <ActiveBadge isActive={v.is_active} />
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <VariantFormDialog
                            productId={product.id}
                            materials={materials}
                            record={{
                              id: v.id,
                              sku: v.sku,
                              name: v.name,
                              net_weight_g: v.net_weight_g,
                              packaging_type: v.packaging_type,
                              selling_price: v.selling_price,
                              wholesale_price: v.wholesale_price,
                              is_active: v.is_active,
                              materials: (v.variant_materials ?? []).map((m) => ({
                                material_id: m.material_id,
                                quantity_per_unit: m.quantity_per_unit,
                              })),
                            }}
                            trigger={
                              <Button variant="ghost" size="sm" data-testid="edit-variant">
                                <PencilIcon /> Edit
                              </Button>
                            }
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
