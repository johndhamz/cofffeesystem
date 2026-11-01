import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "./database";

export type { Database, Tables, TablesInsert, TablesUpdate, Enums };

export type Supplier = Tables<"suppliers">;
export type GreenCoffee = Tables<"green_coffees">;
export type Roaster = Tables<"roasters">;
export type InventoryLocation = Tables<"inventory_locations">;
export type ExpenseCategory = Tables<"expense_categories">;
export type SalesChannel = Tables<"sales_channels">;
export type BusinessSettings = Tables<"business_settings">;
export type AuditLog = Tables<"audit_logs">;

export type PurchaseOrder = Tables<"purchase_orders">;
export type PurchaseOrderItem = Tables<"purchase_order_items">;
export type GoodsReceipt = Tables<"goods_receipts">;
export type GoodsReceiptItem = Tables<"goods_receipt_items">;
export type GreenCoffeeLot = Tables<"green_coffee_lots">;
export type InventoryItem = Tables<"inventory_items">;
export type InventoryMovement = Tables<"inventory_movements">;
export type InventoryBalance = Tables<"inventory_balances">;
export type InventoryCostLayer = Tables<"inventory_cost_layers">;
export type InventoryAdjustment = Tables<"inventory_adjustments">;
export type InventoryAdjustmentLine = Tables<"inventory_adjustment_lines">;

export type GreenLotInventoryRow = Database["public"]["Views"]["green_lot_inventory_view"]["Row"];
export type InventoryMovementHistoryRow =
  Database["public"]["Views"]["inventory_movement_history_view"]["Row"];

export type MemberRole = Enums<"member_role">;
export type PurchaseOrderStatus = Enums<"purchase_order_status">;
export type GoodsReceiptStatus = Enums<"goods_receipt_status">;
export type InventoryAdjustmentStatus = Enums<"inventory_adjustment_status">;
export type InventoryMovementType = Enums<"inventory_movement_type">;

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
