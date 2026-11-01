import { z } from "zod";
import type { Permission } from "@/lib/permissions/policy";
import {
  booleanFromForm,
  optionalNumber,
  optionalTrimmed,
  requiredName,
  requiredNumber,
  optionalUuid,
} from "@/lib/validation/common";

/**
 * Declarative configuration for every master-data entity. Drives the list pages,
 * create/edit dialogs, detail views, validation and the generic service/repository.
 * Safe to import from client components (no server-only imports).
 */

export type FieldType = "text" | "textarea" | "number" | "email" | "tel" | "select" | "switch";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  step?: string;
  min?: number;
  max?: number;
  /** span 2 columns in the dialog grid */
  wide?: boolean;
  /** Options loaded server-side from another entity (e.g. roasters); resolved by MasterDataPage. */
  optionsFrom?: "roasters";
}

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  /** render hint for the generic table */
  kind?: "text" | "weight" | "number" | "badge" | "email";
  hideOnMobile?: boolean;
}

export interface MasterEntityDef<TTable extends string, TSchema extends z.ZodType> {
  key: string;
  table: TTable;
  singular: string;
  plural: string;
  description: string;
  basePath: string;
  managePermission: Permission;
  /** defaults to master_data.read */
  readPermission?: Permission;
  schema: TSchema;
  fields: FieldDef[];
  columns: ColumnDef[];
  searchColumns: string[];
  sortableColumns: string[];
  defaultSort: string;
}

const LOCATION_TYPES = [
  { value: "warehouse", label: "Warehouse" },
  { value: "roastery", label: "Roastery" },
  { value: "retail", label: "Retail" },
  { value: "consignment", label: "Consignment" },
  { value: "other", label: "Other" },
];

const CLASSIFICATIONS = [
  { value: "cogs", label: "Cost of goods sold" },
  { value: "operating", label: "Operating" },
  { value: "capital", label: "Capital" },
  { value: "other", label: "Other" },
];

const CHANNEL_TYPES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "online", label: "Online" },
  { value: "wholesale", label: "Wholesale" },
  { value: "cafe", label: "Café" },
  { value: "consignment", label: "Consignment" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];

export const supplierSchema = z.object({
  name: requiredName(),
  contact_person: optionalTrimmed(120),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.email("Enter a valid email address").max(254).optional(),
  ),
  phone: optionalTrimmed(40),
  address: optionalTrimmed(500),
  notes: optionalTrimmed(2000),
  is_active: booleanFromForm.default(true),
});

export const greenCoffeeSchema = z.object({
  name: requiredName(),
  country: optionalTrimmed(80),
  region: optionalTrimmed(120),
  farm: optionalTrimmed(120),
  producer: optionalTrimmed(120),
  variety: optionalTrimmed(120),
  processing_method: optionalTrimmed(80),
  altitude_masl: optionalNumber(
    z
      .number()
      .int("Altitude must be a whole number")
      .min(0, "Altitude cannot be negative")
      .max(6000, "Altitude must be at most 6,000 masl"),
  ),
  low_stock_threshold_g: optionalNumber(
    z.number().int("Use whole grams").min(0, "Cannot be negative"),
  ),
  description: optionalTrimmed(2000),
  is_active: booleanFromForm.default(true),
});

export const roasterSchema = z.object({
  name: requiredName(),
  manufacturer: optionalTrimmed(120),
  model: optionalTrimmed(120),
  capacity_g: requiredNumber(
    z
      .number({ error: "Capacity is required" })
      .int("Capacity must be whole grams")
      .min(1, "Capacity must be at least 1 g")
      .max(1_000_000, "Capacity must be at most 1,000,000 g"),
  ),
  notes: optionalTrimmed(2000),
  is_active: booleanFromForm.default(true),
});

export const inventoryLocationSchema = z.object({
  name: requiredName(),
  location_type: z.enum(["warehouse", "roastery", "retail", "consignment", "other"]),
  is_active: booleanFromForm.default(true),
});

export const expenseCategorySchema = z.object({
  name: requiredName(),
  classification: z.enum(["cogs", "operating", "capital", "other"]),
  is_active: booleanFromForm.default(true),
});

export const salesChannelSchema = z.object({
  name: requiredName(),
  channel_type: z.enum(["walk_in", "online", "wholesale", "cafe", "consignment", "event", "other"]),
  is_active: booleanFromForm.default(true),
});

function defineEntity<TTable extends string, TSchema extends z.ZodType>(
  def: MasterEntityDef<TTable, TSchema>,
): MasterEntityDef<TTable, TSchema> {
  return def;
}

const ROAST_LEVELS = [
  { value: "light", label: "Light" },
  { value: "medium_light", label: "Medium-light" },
  { value: "medium", label: "Medium" },
  { value: "medium_dark", label: "Medium-dark" },
  { value: "dark", label: "Dark" },
];

export const roastProfileSchema = z.object({
  name: requiredName(),
  roaster_id: optionalUuid,
  target_roast_level: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["light", "medium_light", "medium", "medium_dark", "dark"]).optional(),
  ),
  target_notes: optionalTrimmed(2000),
  description: optionalTrimmed(2000),
  is_active: booleanFromForm.default(true),
});

export const packagingMaterialSchema = z.object({
  name: requiredName(),
  sku: optionalTrimmed(60),
  base_unit: z.enum(["pc", "g", "ml"]),
  reorder_level: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : typeof v === "string" ? Number(v) : v),
    z.number().int("Use whole units").min(0, "Cannot be negative"),
  ),
  standard_unit_cost: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? "0" : v),
    z
      .string()
      .trim()
      .regex(/^\d{1,9}(\.\d{1,6})?$/, "Enter a cost with up to 6 decimals"),
  ),
  is_active: booleanFromForm.default(true),
});

export const MASTER_ENTITIES = {
  suppliers: defineEntity({
    key: "suppliers",
    table: "suppliers",
    singular: "Supplier",
    plural: "Suppliers",
    description: "Green coffee and packaging suppliers.",
    basePath: "/settings/suppliers",
    managePermission: "suppliers.manage",
    schema: supplierSchema,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, wide: true },
      { name: "contact_person", label: "Contact person", type: "text" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "email", label: "Email", type: "email", wide: true },
      { name: "address", label: "Address", type: "textarea", wide: true },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "contact_person", label: "Contact", sortable: true, hideOnMobile: true },
      { key: "phone", label: "Phone", hideOnMobile: true },
      { key: "email", label: "Email", kind: "email", hideOnMobile: true },
      { key: "is_active", label: "Status", kind: "badge", sortable: true },
    ],
    searchColumns: ["name", "contact_person", "email", "phone"],
    sortableColumns: ["name", "contact_person", "is_active", "created_at"],
    defaultSort: "name",
  }),
  green_coffees: defineEntity({
    key: "green_coffees",
    table: "green_coffees",
    singular: "Green coffee",
    plural: "Green coffees",
    description: "Catalog of green coffees you buy. Stock lives in lots.",
    basePath: "/green-coffee",
    managePermission: "green_coffees.manage",
    schema: greenCoffeeSchema,
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        wide: true,
        placeholder: "Atok Benguet Arabica Washed",
      },
      { name: "country", label: "Country", type: "text" },
      { name: "region", label: "Region", type: "text" },
      { name: "farm", label: "Farm", type: "text" },
      { name: "producer", label: "Producer", type: "text" },
      {
        name: "variety",
        label: "Variety",
        type: "text",
        placeholder: "Arabica, Robusta, Liberica…",
      },
      {
        name: "processing_method",
        label: "Processing method",
        type: "text",
        placeholder: "Washed, Natural, Honey…",
      },
      {
        name: "altitude_masl",
        label: "Altitude (masl)",
        type: "number",
        min: 0,
        max: 6000,
        step: "1",
        description: "Leave blank if unknown",
      },
      {
        name: "low_stock_threshold_g",
        label: "Low-stock threshold (g)",
        type: "number",
        min: 0,
        step: "1",
        description: "Alert when available stock falls to this level",
      },
      { name: "description", label: "Description", type: "textarea", wide: true },
    ],
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "country", label: "Country", sortable: true, hideOnMobile: true },
      { key: "region", label: "Region", hideOnMobile: true },
      { key: "variety", label: "Variety", hideOnMobile: true },
      { key: "processing_method", label: "Process", sortable: true, hideOnMobile: true },
      { key: "is_active", label: "Status", kind: "badge", sortable: true },
    ],
    searchColumns: [
      "name",
      "country",
      "region",
      "farm",
      "producer",
      "variety",
      "processing_method",
    ],
    sortableColumns: ["name", "country", "processing_method", "is_active", "created_at"],
    defaultSort: "name",
  }),
  roasters: defineEntity({
    key: "roasters",
    table: "roasters",
    singular: "Roaster",
    plural: "Roasters",
    description: "Roasting machines and their batch capacity.",
    basePath: "/settings/roasters",
    managePermission: "roasters.manage",
    schema: roasterSchema,
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        wide: true,
        placeholder: "Yoshan DY-2kg",
      },
      { name: "manufacturer", label: "Manufacturer", type: "text" },
      { name: "model", label: "Model", type: "text" },
      {
        name: "capacity_g",
        label: "Batch capacity (g)",
        type: "number",
        required: true,
        min: 1,
        step: "1",
        description: "Maximum green weight per batch",
      },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "manufacturer", label: "Manufacturer", hideOnMobile: true },
      { key: "model", label: "Model", hideOnMobile: true },
      { key: "capacity_g", label: "Capacity", kind: "weight", sortable: true },
      { key: "is_active", label: "Status", kind: "badge", sortable: true },
    ],
    searchColumns: ["name", "manufacturer", "model"],
    sortableColumns: ["name", "capacity_g", "is_active", "created_at"],
    defaultSort: "name",
  }),
  inventory_locations: defineEntity({
    key: "inventory_locations",
    table: "inventory_locations",
    singular: "Location",
    plural: "Inventory locations",
    description: "Where stock is physically kept.",
    basePath: "/settings/locations",
    managePermission: "locations.manage",
    schema: inventoryLocationSchema,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, wide: true },
      {
        name: "location_type",
        label: "Type",
        type: "select",
        required: true,
        options: LOCATION_TYPES,
        wide: true,
      },
    ],
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "location_type", label: "Type", sortable: true },
      { key: "is_active", label: "Status", kind: "badge", sortable: true },
    ],
    searchColumns: ["name"],
    sortableColumns: ["name", "location_type", "is_active", "created_at"],
    defaultSort: "name",
  }),
  expense_categories: defineEntity({
    key: "expense_categories",
    table: "expense_categories",
    singular: "Expense category",
    plural: "Expense categories",
    description: "How expenses are grouped in reports.",
    basePath: "/settings/expense-categories",
    managePermission: "expense_categories.manage",
    schema: expenseCategorySchema,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, wide: true },
      {
        name: "classification",
        label: "Classification",
        type: "select",
        required: true,
        options: CLASSIFICATIONS,
        wide: true,
      },
    ],
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "classification", label: "Classification", sortable: true },
      { key: "is_active", label: "Status", kind: "badge", sortable: true },
    ],
    searchColumns: ["name"],
    sortableColumns: ["name", "classification", "is_active", "created_at"],
    defaultSort: "name",
  }),
  sales_channels: defineEntity({
    key: "sales_channels",
    table: "sales_channels",
    singular: "Sales channel",
    plural: "Sales channels",
    description: "Where products are sold.",
    basePath: "/settings/sales-channels",
    managePermission: "sales_channels.manage",
    schema: salesChannelSchema,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, wide: true },
      {
        name: "channel_type",
        label: "Type",
        type: "select",
        required: true,
        options: CHANNEL_TYPES,
        wide: true,
      },
    ],
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "channel_type", label: "Type", sortable: true },
      { key: "is_active", label: "Status", kind: "badge", sortable: true },
    ],
    searchColumns: ["name"],
    sortableColumns: ["name", "channel_type", "is_active", "created_at"],
    defaultSort: "name",
  }),
  roast_profiles: defineEntity({
    key: "roast_profiles",
    table: "roast_profiles",
    singular: "Roast profile",
    plural: "Roast profiles",
    description: "Target roast levels and notes to follow when roasting.",
    basePath: "/roasting/profiles",
    managePermission: "roasting.manage",
    readPermission: "roasting.read",
    schema: roastProfileSchema,
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        wide: true,
        placeholder: "Benguet Washed – Medium",
      },
      { name: "roaster_id", label: "Roaster", type: "select", optionsFrom: "roasters" },
      {
        name: "target_roast_level",
        label: "Target roast level",
        type: "select",
        options: ROAST_LEVELS,
      },
      {
        name: "target_notes",
        label: "Target notes",
        type: "textarea",
        wide: true,
        placeholder: "Charge 200°C, FC ~8:30, DTR 18–22%…",
      },
      { name: "description", label: "Description", type: "textarea", wide: true },
    ],
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "target_roast_level", label: "Target level", sortable: true },
      { key: "is_active", label: "Status", kind: "badge", sortable: true },
    ],
    searchColumns: ["name", "target_notes"],
    sortableColumns: ["name", "target_roast_level", "is_active", "created_at"],
    defaultSort: "name",
  }),
  packaging_materials: defineEntity({
    key: "packaging_materials",
    table: "packaging_materials",
    singular: "Packaging material",
    plural: "Packaging materials",
    description: "Bags, labels and boxes. Stock is received through inventory adjustments.",
    basePath: "/packaging/materials",
    managePermission: "packaging.manage",
    readPermission: "packaging.read",
    schema: packagingMaterialSchema,
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        wide: true,
        placeholder: "250 g kraft bag with valve",
      },
      { name: "sku", label: "SKU", type: "text" },
      {
        name: "base_unit",
        label: "Unit",
        type: "select",
        required: true,
        options: [
          { value: "pc", label: "Piece" },
          { value: "g", label: "Gram" },
          { value: "ml", label: "Millilitre" },
        ],
      },
      {
        name: "reorder_level",
        label: "Reorder level",
        type: "number",
        min: 0,
        step: "1",
        description: "Low-stock alert threshold",
      },
      {
        name: "standard_unit_cost",
        label: "Standard cost per unit (₱)",
        type: "text",
        description: "Used when no received cost is recorded",
      },
    ],
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "sku", label: "SKU", hideOnMobile: true },
      { key: "base_unit", label: "Unit" },
      { key: "reorder_level", label: "Reorder level", kind: "number", hideOnMobile: true },
      { key: "is_active", label: "Status", kind: "badge", sortable: true },
    ],
    searchColumns: ["name", "sku"],
    sortableColumns: ["name", "is_active", "created_at"],
    defaultSort: "name",
  }),
};

export type MasterEntityKey = keyof typeof MASTER_ENTITIES;
export const MASTER_ENTITY_KEYS = Object.keys(MASTER_ENTITIES) as MasterEntityKey[];

export function isMasterEntityKey(value: string): value is MasterEntityKey {
  return value in MASTER_ENTITIES;
}

export const OPTION_LABELS: Record<string, string> = Object.fromEntries(
  [...LOCATION_TYPES, ...CLASSIFICATIONS, ...CHANNEL_TYPES, ...ROAST_LEVELS].map((o) => [
    o.value,
    o.label,
  ]),
);

export type DynamicOptions = Record<string, { value: string; label: string }[]>;
