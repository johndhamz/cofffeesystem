
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"after_data": Json | null,"before_data": Json | null,"business_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"metadata": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after_data"?: Json | null,"before_data"?: Json | null,"business_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"metadata"?: Json | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after_data"?: Json | null,"before_data"?: Json | null,"business_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"metadata"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_members": {
                  Row: {
                    "accepted_at": string | null,"business_id": string,"created_at": string,"id": string,"invited_at": string | null,"invited_by": string | null,"is_active": boolean,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"business_id": string,"created_at"?: string,"id"?: string,"invited_at"?: string | null,"invited_by"?: string | null,"is_active"?: boolean,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"business_id"?: string,"created_at"?: string,"id"?: string,"invited_at"?: string | null,"invited_by"?: string | null,"is_active"?: boolean,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_members_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"business_settings": {
                  Row: {
                    "business_id": string,"costing_method": string,"created_at": string,"currency": string,"default_location_id": string | null,"default_roaster_id": string | null,"id": string,"inventory_weight_unit": string,"require_mfa": boolean,"timezone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"costing_method"?: string,"created_at"?: string,"currency"?: string,"default_location_id"?: string | null,"default_roaster_id"?: string | null,"id"?: string,"inventory_weight_unit"?: string,"require_mfa"?: boolean,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"costing_method"?: string,"created_at"?: string,"currency"?: string,"default_location_id"?: string | null,"default_roaster_id"?: string | null,"id"?: string,"inventory_weight_unit"?: string,"require_mfa"?: boolean,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_settings_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_settings_default_location_fk"
      columns: ["default_location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "business_settings_default_roaster_fk"
      columns: ["default_roaster_id","business_id"]
isOneToOne: false
      referencedRelation: "roasters"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "business_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cost_allocations": {
                  Row: {
                    "amount": number,"business_id": string,"created_at": string,"created_by": string | null,"expense_id": string,"id": string,"notes": string | null,"source_id": string,"source_type": string,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"expense_id": string,"id"?: string,"notes"?: string | null,"source_id": string,"source_type"?: string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"expense_id"?: string,"id"?: string,"notes"?: string | null,"source_id"?: string,"source_type"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cost_allocations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cost_allocations_expense_id_business_id_fkey"
      columns: ["expense_id","business_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "cost_allocations_expense_id_business_id_fkey"
      columns: ["expense_id","business_id"]
isOneToOne: false
      referencedRelation: "report_expenses_view"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "address": string | null,"business_id": string,"created_at": string,"customer_type": string,"email": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"payment_terms_days": number,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"business_id": string,"created_at"?: string,"customer_type"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"payment_terms_days"?: number,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"business_id"?: string,"created_at"?: string,"customer_type"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"payment_terms_days"?: number,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"document_sequences": {
                  Row: {
                    "business_id": string,"kind": string,"next_value": number,"period": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"kind": string,"next_value"?: number,"period": string
                  }
                  Update: {
                    "business_id"?: string,"kind"?: string,"next_value"?: number,"period"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_sequences_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "business_id": string,"classification": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"classification"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"classification"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"business_id": string,"cost_treatment": string,"created_at": string,"created_by": string | null,"description": string,"expense_category_id": string,"expense_number": string,"id": string,"idempotency_key": string | null,"incurred_at": string,"is_voided": boolean,"notes": string | null,"payment_method": Database["public"]['Enums']["payment_method"] | null,"payment_reference": string | null,"receipt_path": string | null,"supplier_id": string | null,"updated_at": string,"void_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_id": string,"cost_treatment": string,"created_at"?: string,"created_by"?: string | null,"description": string,"expense_category_id": string,"expense_number"?: string,"id"?: string,"idempotency_key"?: string | null,"incurred_at"?: string,"is_voided"?: boolean,"notes"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"payment_reference"?: string | null,"receipt_path"?: string | null,"supplier_id"?: string | null,"updated_at"?: string,"void_reason"?: string | null
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"cost_treatment"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"expense_category_id"?: string,"expense_number"?: string,"id"?: string,"idempotency_key"?: string | null,"incurred_at"?: string,"is_voided"?: boolean,"notes"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"payment_reference"?: string | null,"receipt_path"?: string | null,"supplier_id"?: string | null,"updated_at"?: string,"void_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_expense_category_id_business_id_fkey"
      columns: ["expense_category_id","business_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "expenses_supplier_id_business_id_fkey"
      columns: ["supplier_id","business_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"finished_goods_lots": {
                  Row: {
                    "best_before_at": string | null,"business_id": string,"created_at": string,"id": string,"lot_code": string,"packaged_at": string,"packaging_session_id": string | null,"quantity": number,"total_cost": number,"unit_cost": number,"updated_at": string,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "best_before_at"?: string | null,"business_id": string,"created_at"?: string,"id"?: string,"lot_code": string,"packaged_at": string,"packaging_session_id"?: string | null,"quantity": number,"total_cost": number,"unit_cost": number,"updated_at"?: string,"variant_id": string
                  }
                  Update: {
                    "best_before_at"?: string | null,"business_id"?: string,"created_at"?: string,"id"?: string,"lot_code"?: string,"packaged_at"?: string,"packaging_session_id"?: string | null,"quantity"?: number,"total_cost"?: number,"unit_cost"?: number,"updated_at"?: string,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "finished_goods_lots_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "finished_goods_lots_packaging_session_id_business_id_fkey"
      columns: ["packaging_session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_session_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "finished_goods_lots_packaging_session_id_business_id_fkey"
      columns: ["packaging_session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_sessions"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "finished_goods_lots_variant_id_business_id_fkey"
      columns: ["variant_id","business_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "finished_goods_lots_variant_id_business_id_fkey"
      columns: ["variant_id","business_id"]
isOneToOne: false
      referencedRelation: "variant_availability_view"
      referencedColumns: ["variant_id","business_id"]
    }
                  ]
                },"goods_receipt_items": {
                  Row: {
                    "allocated_landed_cost": number,"business_id": string,"created_at": string,"green_lot_id": string,"id": string,"po_cost_share": number | null,"purchase_cost": number | null,"purchase_order_item_id": string,"receipt_id": string,"received_quantity_g": number,"total_cost": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allocated_landed_cost"?: number,"business_id": string,"created_at"?: string,"green_lot_id": string,"id"?: string,"po_cost_share"?: number | null,"purchase_cost"?: number | null,"purchase_order_item_id": string,"receipt_id": string,"received_quantity_g": number,"total_cost"?: number | null
                  }
                  Update: {
                    "allocated_landed_cost"?: number,"business_id"?: string,"created_at"?: string,"green_lot_id"?: string,"id"?: string,"po_cost_share"?: number | null,"purchase_cost"?: number | null,"purchase_order_item_id"?: string,"receipt_id"?: string,"received_quantity_g"?: number,"total_cost"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "goods_receipt_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goods_receipt_items_green_lot_id_business_id_fkey"
      columns: ["green_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "green_coffee_lots"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "goods_receipt_items_green_lot_id_business_id_fkey"
      columns: ["green_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "green_lot_inventory_view"
      referencedColumns: ["lot_id","business_id"]
    },{
      foreignKeyName: "goods_receipt_items_purchase_order_item_id_business_id_fkey"
      columns: ["purchase_order_item_id","business_id"]
isOneToOne: false
      referencedRelation: "purchase_order_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "goods_receipt_items_receipt_id_business_id_fkey"
      columns: ["receipt_id","business_id"]
isOneToOne: false
      referencedRelation: "goods_receipts"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"goods_receipts": {
                  Row: {
                    "additional_costs": number,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string | null,"location_id": string,"notes": string | null,"posted_at": string | null,"posted_by": string | null,"purchase_order_id": string,"receipt_number": string,"received_at": string,"status": Database["public"]['Enums']["goods_receipt_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "additional_costs"?: number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"location_id": string,"notes"?: string | null,"posted_at"?: string | null,"posted_by"?: string | null,"purchase_order_id": string,"receipt_number": string,"received_at"?: string,"status"?: Database["public"]['Enums']["goods_receipt_status"],"updated_at"?: string
                  }
                  Update: {
                    "additional_costs"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"location_id"?: string,"notes"?: string | null,"posted_at"?: string | null,"posted_by"?: string | null,"purchase_order_id"?: string,"receipt_number"?: string,"received_at"?: string,"status"?: Database["public"]['Enums']["goods_receipt_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goods_receipts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goods_receipts_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "goods_receipts_purchase_order_id_business_id_fkey"
      columns: ["purchase_order_id","business_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"green_coffee_lots": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"density_g_per_100ml": number | null,"green_coffee_id": string,"id": string,"lot_code": string,"moisture_pct": number | null,"notes": string | null,"received_at": string | null,"supplier_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"density_g_per_100ml"?: number | null,"green_coffee_id": string,"id"?: string,"lot_code": string,"moisture_pct"?: number | null,"notes"?: string | null,"received_at"?: string | null,"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"density_g_per_100ml"?: number | null,"green_coffee_id"?: string,"id"?: string,"lot_code"?: string,"moisture_pct"?: number | null,"notes"?: string | null,"received_at"?: string | null,"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "green_coffee_lots_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "green_coffee_lots_green_coffee_id_business_id_fkey"
      columns: ["green_coffee_id","business_id"]
isOneToOne: false
      referencedRelation: "green_coffees"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "green_coffee_lots_supplier_id_business_id_fkey"
      columns: ["supplier_id","business_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"green_coffees": {
                  Row: {
                    "altitude_masl": number | null,"business_id": string,"country": string | null,"created_at": string,"description": string | null,"farm": string | null,"id": string,"is_active": boolean,"low_stock_threshold_g": number | null,"name": string,"processing_method": string | null,"producer": string | null,"region": string | null,"updated_at": string,"variety": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "altitude_masl"?: number | null,"business_id": string,"country"?: string | null,"created_at"?: string,"description"?: string | null,"farm"?: string | null,"id"?: string,"is_active"?: boolean,"low_stock_threshold_g"?: number | null,"name": string,"processing_method"?: string | null,"producer"?: string | null,"region"?: string | null,"updated_at"?: string,"variety"?: string | null
                  }
                  Update: {
                    "altitude_masl"?: number | null,"business_id"?: string,"country"?: string | null,"created_at"?: string,"description"?: string | null,"farm"?: string | null,"id"?: string,"is_active"?: boolean,"low_stock_threshold_g"?: number | null,"name"?: string,"processing_method"?: string | null,"producer"?: string | null,"region"?: string | null,"updated_at"?: string,"variety"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "green_coffees_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_adjustment_lines": {
                  Row: {
                    "adjustment_id": string,"business_id": string,"created_at": string,"id": string,"inventory_item_id": string,"location_id": string,"notes": string | null,"quantity_delta": number,"total_cost": number | null,"unit_cost": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment_id": string,"business_id": string,"created_at"?: string,"id"?: string,"inventory_item_id": string,"location_id": string,"notes"?: string | null,"quantity_delta": number,"total_cost"?: number | null,"unit_cost"?: number | null
                  }
                  Update: {
                    "adjustment_id"?: string,"business_id"?: string,"created_at"?: string,"id"?: string,"inventory_item_id"?: string,"location_id"?: string,"notes"?: string | null,"quantity_delta"?: number,"total_cost"?: number | null,"unit_cost"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_adjustment_lines_adjustment_id_business_id_fkey"
      columns: ["adjustment_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_adjustments"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "inventory_adjustment_lines_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_adjustment_lines_inventory_item_id_business_id_fkey"
      columns: ["inventory_item_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "inventory_adjustment_lines_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"inventory_adjustments": {
                  Row: {
                    "adjustment_number": string,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string | null,"notes": string | null,"posted_at": string | null,"posted_by": string | null,"reason": string,"reversal_of_adjustment_id": string | null,"status": Database["public"]['Enums']["inventory_adjustment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment_number": string,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"notes"?: string | null,"posted_at"?: string | null,"posted_by"?: string | null,"reason": string,"reversal_of_adjustment_id"?: string | null,"status"?: Database["public"]['Enums']["inventory_adjustment_status"],"updated_at"?: string
                  }
                  Update: {
                    "adjustment_number"?: string,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"notes"?: string | null,"posted_at"?: string | null,"posted_by"?: string | null,"reason"?: string,"reversal_of_adjustment_id"?: string | null,"status"?: Database["public"]['Enums']["inventory_adjustment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_adjustments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_adjustments_reversal_of_adjustment_id_fkey"
      columns: ["reversal_of_adjustment_id"]
isOneToOne: false
      referencedRelation: "inventory_adjustments"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_balances": {
                  Row: {
                    "business_id": string,"id": string,"inventory_item_id": string,"location_id": string,"on_hand_quantity": number,"reserved_quantity": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"id"?: string,"inventory_item_id": string,"location_id": string,"on_hand_quantity"?: number,"reserved_quantity"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"id"?: string,"inventory_item_id"?: string,"location_id"?: string,"on_hand_quantity"?: number,"reserved_quantity"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_balances_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_balances_inventory_item_id_business_id_fkey"
      columns: ["inventory_item_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "inventory_balances_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"inventory_cost_layers": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"inventory_item_id": string,"original_cost": number,"received_at": string,"received_quantity": number,"remaining_cost": number,"remaining_quantity": number,"source_id": string,"source_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"inventory_item_id": string,"original_cost": number,"received_at"?: string,"received_quantity": number,"remaining_cost": number,"remaining_quantity": number,"source_id": string,"source_type": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"inventory_item_id"?: string,"original_cost"?: number,"received_at"?: string,"received_quantity"?: number,"remaining_cost"?: number,"remaining_quantity"?: number,"source_id"?: string,"source_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_cost_layers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_cost_layers_inventory_item_id_business_id_fkey"
      columns: ["inventory_item_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"inventory_items": {
                  Row: {
                    "base_unit": string,"business_id": string,"created_at": string,"id": string,"item_type": Database["public"]['Enums']["inventory_item_type"],"low_stock_threshold": number | null,"reference_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_unit": string,"business_id": string,"created_at"?: string,"id"?: string,"item_type": Database["public"]['Enums']["inventory_item_type"],"low_stock_threshold"?: number | null,"reference_id": string
                  }
                  Update: {
                    "base_unit"?: string,"business_id"?: string,"created_at"?: string,"id"?: string,"item_type"?: Database["public"]['Enums']["inventory_item_type"],"low_stock_threshold"?: number | null,"reference_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_locations": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"is_active": boolean,"location_type": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location_type"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location_type"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_locations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string,"inventory_item_id": string,"location_id": string,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"notes": string | null,"posted_at": string,"quantity_delta": number,"source_id": string,"source_type": string,"total_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key": string,"inventory_item_id": string,"location_id": string,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"notes"?: string | null,"posted_at"?: string,"quantity_delta": number,"source_id": string,"source_type": string,"total_cost"?: number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string,"inventory_item_id"?: string,"location_id"?: string,"movement_type"?: Database["public"]['Enums']["inventory_movement_type"],"notes"?: string | null,"posted_at"?: string,"quantity_delta"?: number,"source_id"?: string,"source_type"?: string,"total_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_inventory_item_id_business_id_fkey"
      columns: ["inventory_item_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "inventory_movements_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"inventory_reservations": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string,"inventory_item_id": string,"location_id": string,"quantity": number,"released_at": string | null,"source_id": string,"source_type": string,"status": Database["public"]['Enums']["inventory_reservation_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key": string,"inventory_item_id": string,"location_id": string,"quantity": number,"released_at"?: string | null,"source_id": string,"source_type": string,"status"?: Database["public"]['Enums']["inventory_reservation_status"]
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string,"inventory_item_id"?: string,"location_id"?: string,"quantity"?: number,"released_at"?: string | null,"source_id"?: string,"source_type"?: string,"status"?: Database["public"]['Enums']["inventory_reservation_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_reservations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_reservations_inventory_item_id_business_id_fkey"
      columns: ["inventory_item_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "inventory_reservations_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"packaging_inputs": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"inherited_cost": number | null,"input_weight_g": number,"roast_batch_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"inherited_cost"?: number | null,"input_weight_g": number,"roast_batch_id": string,"session_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"inherited_cost"?: number | null,"input_weight_g"?: number,"roast_batch_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "packaging_inputs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "packaging_inputs_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batch_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_inputs_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batches"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_inputs_session_id_business_id_fkey"
      columns: ["session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_session_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_inputs_session_id_business_id_fkey"
      columns: ["session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_sessions"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"packaging_material_usage": {
                  Row: {
                    "business_id": string,"cost": number | null,"created_at": string,"id": string,"material_id": string,"quantity": number,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"cost"?: number | null,"created_at"?: string,"id"?: string,"material_id": string,"quantity": number,"session_id": string
                  }
                  Update: {
                    "business_id"?: string,"cost"?: number | null,"created_at"?: string,"id"?: string,"material_id"?: string,"quantity"?: number,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "packaging_material_usage_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "packaging_material_usage_material_id_business_id_fkey"
      columns: ["material_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_material_inventory_view"
      referencedColumns: ["material_id","business_id"]
    },{
      foreignKeyName: "packaging_material_usage_material_id_business_id_fkey"
      columns: ["material_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_materials"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_material_usage_session_id_business_id_fkey"
      columns: ["session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_session_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_material_usage_session_id_business_id_fkey"
      columns: ["session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_sessions"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"packaging_materials": {
                  Row: {
                    "base_unit": string,"business_id": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"reorder_level": number,"sku": string | null,"standard_unit_cost": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_unit"?: string,"business_id": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"reorder_level"?: number,"sku"?: string | null,"standard_unit_cost"?: number,"updated_at"?: string
                  }
                  Update: {
                    "base_unit"?: string,"business_id"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"reorder_level"?: number,"sku"?: string | null,"standard_unit_cost"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "packaging_materials_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"packaging_outputs": {
                  Row: {
                    "best_before_at": string | null,"business_id": string,"created_at": string,"finished_lot_id": string | null,"id": string,"lot_code": string | null,"quantity": number,"session_id": string,"total_cost": number | null,"unit_cost": number | null,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "best_before_at"?: string | null,"business_id": string,"created_at"?: string,"finished_lot_id"?: string | null,"id"?: string,"lot_code"?: string | null,"quantity": number,"session_id": string,"total_cost"?: number | null,"unit_cost"?: number | null,"variant_id": string
                  }
                  Update: {
                    "best_before_at"?: string | null,"business_id"?: string,"created_at"?: string,"finished_lot_id"?: string | null,"id"?: string,"lot_code"?: string | null,"quantity"?: number,"session_id"?: string,"total_cost"?: number | null,"unit_cost"?: number | null,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "packaging_outputs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "packaging_outputs_finished_lot_id_business_id_fkey"
      columns: ["finished_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "finished_goods_inventory_view"
      referencedColumns: ["lot_id","business_id"]
    },{
      foreignKeyName: "packaging_outputs_finished_lot_id_business_id_fkey"
      columns: ["finished_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "finished_goods_lots"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_outputs_session_id_business_id_fkey"
      columns: ["session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_session_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_outputs_session_id_business_id_fkey"
      columns: ["session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_sessions"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_outputs_variant_id_business_id_fkey"
      columns: ["variant_id","business_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_outputs_variant_id_business_id_fkey"
      columns: ["variant_id","business_id"]
isOneToOne: false
      referencedRelation: "variant_availability_view"
      referencedColumns: ["variant_id","business_id"]
    }
                  ]
                },"packaging_sessions": {
                  Row: {
                    "business_id": string,"coffee_cost": number | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string | null,"input_weight_g": number | null,"labor_cost": number,"location_id": string,"material_cost": number | null,"notes": string | null,"operator_id": string | null,"overhead_cost": number,"packaged_at": string,"required_weight_g": number | null,"session_number": string,"status": Database["public"]['Enums']["packaging_session_status"],"total_cost": number | null,"updated_at": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"coffee_cost"?: number | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"input_weight_g"?: number | null,"labor_cost"?: number,"location_id": string,"material_cost"?: number | null,"notes"?: string | null,"operator_id"?: string | null,"overhead_cost"?: number,"packaged_at"?: string,"required_weight_g"?: number | null,"session_number": string,"status"?: Database["public"]['Enums']["packaging_session_status"],"total_cost"?: number | null,"updated_at"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"coffee_cost"?: number | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"input_weight_g"?: number | null,"labor_cost"?: number,"location_id"?: string,"material_cost"?: number | null,"notes"?: string | null,"operator_id"?: string | null,"overhead_cost"?: number,"packaged_at"?: string,"required_weight_g"?: number | null,"session_number"?: string,"status"?: Database["public"]['Enums']["packaging_session_status"],"total_cost"?: number | null,"updated_at"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "packaging_sessions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "packaging_sessions_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_sessions_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"business_id": string,"created_at": string,"id": string,"idempotency_key": string,"notes": string | null,"order_id": string,"payment_method": Database["public"]['Enums']["payment_method"],"payment_reference": string | null,"received_at": string,"recorded_by": string | null,"status": string,"void_reason": string | null,"voided_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_id": string,"created_at"?: string,"id"?: string,"idempotency_key": string,"notes"?: string | null,"order_id": string,"payment_method": Database["public"]['Enums']["payment_method"],"payment_reference"?: string | null,"received_at"?: string,"recorded_by"?: string | null,"status"?: string,"void_reason"?: string | null,"voided_at"?: string | null
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"created_at"?: string,"id"?: string,"idempotency_key"?: string,"notes"?: string | null,"order_id"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_reference"?: string | null,"received_at"?: string,"recorded_by"?: string | null,"status"?: string,"void_reason"?: string | null,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_order_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "payments_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"net_weight_g": number,"packaging_type": string,"product_id": string,"selling_price": number,"sku": string,"updated_at": string,"wholesale_price": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"net_weight_g": number,"packaging_type"?: string,"product_id": string,"selling_price"?: number,"sku": string,"updated_at"?: string,"wholesale_price"?: number | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"net_weight_g"?: number,"packaging_type"?: string,"product_id"?: string,"selling_price"?: number,"sku"?: string,"updated_at"?: string,"wholesale_price"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_variants_product_id_business_id_fkey"
      columns: ["product_id","business_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"products": {
                  Row: {
                    "business_id": string,"category": string | null,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"category"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"category"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_order_items": {
                  Row: {
                    "business_id": string,"created_at": string,"green_coffee_id": string,"id": string,"line_total": number,"ordered_quantity_g": number,"purchase_order_id": string,"received_quantity_g": number,"unit_cost": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"green_coffee_id": string,"id"?: string,"line_total": number,"ordered_quantity_g": number,"purchase_order_id": string,"received_quantity_g"?: number,"unit_cost": number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"green_coffee_id"?: string,"id"?: string,"line_total"?: number,"ordered_quantity_g"?: number,"purchase_order_id"?: string,"received_quantity_g"?: number,"unit_cost"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_order_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_items_green_coffee_id_business_id_fkey"
      columns: ["green_coffee_id","business_id"]
isOneToOne: false
      referencedRelation: "green_coffees"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "purchase_order_items_purchase_order_id_business_id_fkey"
      columns: ["purchase_order_id","business_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"purchase_orders": {
                  Row: {
                    "additional_costs": number,"business_id": string,"cancelled_at": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string | null,"notes": string | null,"ordered_at": string,"purchase_number": string,"status": Database["public"]['Enums']["purchase_order_status"],"subtotal": number,"supplier_id": string,"total": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "additional_costs"?: number,"business_id": string,"cancelled_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"notes"?: string | null,"ordered_at"?: string,"purchase_number": string,"status"?: Database["public"]['Enums']["purchase_order_status"],"subtotal"?: number,"supplier_id": string,"total"?: number,"updated_at"?: string
                  }
                  Update: {
                    "additional_costs"?: number,"business_id"?: string,"cancelled_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"notes"?: string | null,"ordered_at"?: string,"purchase_number"?: string,"status"?: Database["public"]['Enums']["purchase_order_status"],"subtotal"?: number,"supplier_id"?: string,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_orders_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_orders_supplier_id_business_id_fkey"
      columns: ["supplier_id","business_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string,"order_id": string,"payment_id": string,"reason": string,"refund_method": Database["public"]['Enums']["payment_method"],"refunded_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key": string,"order_id": string,"payment_id": string,"reason": string,"refund_method": Database["public"]['Enums']["payment_method"],"refunded_at"?: string,"status"?: string
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string,"order_id"?: string,"payment_id"?: string,"reason"?: string,"refund_method"?: Database["public"]['Enums']["payment_method"],"refunded_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_order_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "refunds_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "refunds_payment_id_business_id_fkey"
      columns: ["payment_id","business_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"roast_attachments": {
                  Row: {
                    "business_id": string,"created_at": string,"file_name": string,"file_type": string,"id": string,"roast_batch_id": string,"size_bytes": number | null,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"file_name": string,"file_type": string,"id"?: string,"roast_batch_id": string,"size_bytes"?: number | null,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"file_name"?: string,"file_type"?: string,"id"?: string,"roast_batch_id"?: string,"size_bytes"?: number | null,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "roast_attachments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_attachments_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batch_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_attachments_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batches"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"roast_batch_costs": {
                  Row: {
                    "amount": number,"business_id": string,"cost_type": string,"created_at": string,"id": string,"notes": string | null,"roast_batch_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_id": string,"cost_type": string,"created_at"?: string,"id"?: string,"notes"?: string | null,"roast_batch_id": string
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"cost_type"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"roast_batch_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roast_batch_costs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_batch_costs_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batch_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_batch_costs_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batches"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"roast_batch_inputs": {
                  Row: {
                    "allocated_green_cost": number | null,"business_id": string,"created_at": string,"green_lot_id": string,"id": string,"input_weight_g": number,"roast_batch_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allocated_green_cost"?: number | null,"business_id": string,"created_at"?: string,"green_lot_id": string,"id"?: string,"input_weight_g": number,"roast_batch_id": string
                  }
                  Update: {
                    "allocated_green_cost"?: number | null,"business_id"?: string,"created_at"?: string,"green_lot_id"?: string,"id"?: string,"input_weight_g"?: number,"roast_batch_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roast_batch_inputs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_batch_inputs_green_lot_id_business_id_fkey"
      columns: ["green_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "green_coffee_lots"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_batch_inputs_green_lot_id_business_id_fkey"
      columns: ["green_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "green_lot_inventory_view"
      referencedColumns: ["lot_id","business_id"]
    },{
      foreignKeyName: "roast_batch_inputs_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batch_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_batch_inputs_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batches"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"roast_batches": {
                  Row: {
                    "batch_number": string,"business_id": string,"charge_bt_c": number | null,"charge_et_c": number | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"development_ratio_pct": number | null,"development_seconds": number | null,"drop_bt_c": number | null,"first_crack_bt_c": number | null,"first_crack_seconds": number | null,"green_cost": number | null,"green_weight_g": number,"id": string,"idempotency_key": string | null,"location_id": string,"notes": string | null,"operator_id": string | null,"production_cost_total": number | null,"roast_date": string,"roast_level": string | null,"roast_loss_pct": number | null,"roast_profile_id": string | null,"roast_yield_pct": number | null,"roasted_cost_per_g": number | null,"roasted_weight_g": number | null,"roaster_id": string,"started_at": string | null,"status": Database["public"]['Enums']["roast_batch_status"],"total_duration_seconds": number | null,"updated_at": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_number": string,"business_id": string,"charge_bt_c"?: number | null,"charge_et_c"?: number | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"development_ratio_pct"?: number | null,"development_seconds"?: number | null,"drop_bt_c"?: number | null,"first_crack_bt_c"?: number | null,"first_crack_seconds"?: number | null,"green_cost"?: number | null,"green_weight_g"?: number,"id"?: string,"idempotency_key"?: string | null,"location_id": string,"notes"?: string | null,"operator_id"?: string | null,"production_cost_total"?: number | null,"roast_date"?: string,"roast_level"?: string | null,"roast_loss_pct"?: number | null,"roast_profile_id"?: string | null,"roast_yield_pct"?: number | null,"roasted_cost_per_g"?: number | null,"roasted_weight_g"?: number | null,"roaster_id": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["roast_batch_status"],"total_duration_seconds"?: number | null,"updated_at"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "batch_number"?: string,"business_id"?: string,"charge_bt_c"?: number | null,"charge_et_c"?: number | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"development_ratio_pct"?: number | null,"development_seconds"?: number | null,"drop_bt_c"?: number | null,"first_crack_bt_c"?: number | null,"first_crack_seconds"?: number | null,"green_cost"?: number | null,"green_weight_g"?: number,"id"?: string,"idempotency_key"?: string | null,"location_id"?: string,"notes"?: string | null,"operator_id"?: string | null,"production_cost_total"?: number | null,"roast_date"?: string,"roast_level"?: string | null,"roast_loss_pct"?: number | null,"roast_profile_id"?: string | null,"roast_yield_pct"?: number | null,"roasted_cost_per_g"?: number | null,"roasted_weight_g"?: number | null,"roaster_id"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["roast_batch_status"],"total_duration_seconds"?: number | null,"updated_at"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "roast_batches_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_batches_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_batches_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_batches_roast_profile_id_business_id_fkey"
      columns: ["roast_profile_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_profiles"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_batches_roaster_id_business_id_fkey"
      columns: ["roaster_id","business_id"]
isOneToOne: false
      referencedRelation: "roasters"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"roast_events": {
                  Row: {
                    "business_id": string,"created_at": string,"elapsed_seconds": number,"event_type": Database["public"]['Enums']["roast_event_type"],"id": string,"notes": string | null,"roast_batch_id": string,"temperature_c": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"elapsed_seconds": number,"event_type": Database["public"]['Enums']["roast_event_type"],"id"?: string,"notes"?: string | null,"roast_batch_id": string,"temperature_c"?: number | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"elapsed_seconds"?: number,"event_type"?: Database["public"]['Enums']["roast_event_type"],"id"?: string,"notes"?: string | null,"roast_batch_id"?: string,"temperature_c"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "roast_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_events_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batch_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_events_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batches"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"roast_measurements": {
                  Row: {
                    "airflow_pct": number | null,"bt_c": number | null,"business_id": string,"created_at": string,"drum_speed_pct": number | null,"elapsed_seconds": number,"et_c": number | null,"gas_kpa": number | null,"id": string,"roast_batch_id": string,"ror_c_per_min": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "airflow_pct"?: number | null,"bt_c"?: number | null,"business_id": string,"created_at"?: string,"drum_speed_pct"?: number | null,"elapsed_seconds": number,"et_c"?: number | null,"gas_kpa"?: number | null,"id"?: string,"roast_batch_id": string,"ror_c_per_min"?: number | null
                  }
                  Update: {
                    "airflow_pct"?: number | null,"bt_c"?: number | null,"business_id"?: string,"created_at"?: string,"drum_speed_pct"?: number | null,"elapsed_seconds"?: number,"et_c"?: number | null,"gas_kpa"?: number | null,"id"?: string,"roast_batch_id"?: string,"ror_c_per_min"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "roast_measurements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_measurements_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batch_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_measurements_roast_batch_id_business_id_fkey"
      columns: ["roast_batch_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_batches"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"roast_profiles": {
                  Row: {
                    "business_id": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"roaster_id": string | null,"target_notes": string | null,"target_roast_level": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"roaster_id"?: string | null,"target_notes"?: string | null,"target_roast_level"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"roaster_id"?: string | null,"target_notes"?: string | null,"target_roast_level"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roast_profiles_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_profiles_roaster_id_business_id_fkey"
      columns: ["roaster_id","business_id"]
isOneToOne: false
      referencedRelation: "roasters"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"roasters": {
                  Row: {
                    "business_id": string,"capacity_g": number,"capacity_policy": string,"created_at": string,"id": string,"is_active": boolean,"manufacturer": string | null,"max_gas_kpa": number | null,"model": string | null,"name": string,"notes": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"capacity_g": number,"capacity_policy"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"manufacturer"?: string | null,"max_gas_kpa"?: number | null,"model"?: string | null,"name": string,"notes"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"capacity_g"?: number,"capacity_policy"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"manufacturer"?: string | null,"max_gas_kpa"?: number | null,"model"?: string | null,"name"?: string,"notes"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roasters_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission": string,"role": Database["public"]['Enums']["member_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "permission": string,"role": Database["public"]['Enums']["member_role"]
                  }
                  Update: {
                    "permission"?: string,"role"?: Database["public"]['Enums']["member_role"]
                  }
                  Relationships: [
                    
                  ]
                },"sales_channels": {
                  Row: {
                    "business_id": string,"channel_type": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"channel_type"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"channel_type"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_channels_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"sales_fulfillment_items": {
                  Row: {
                    "business_id": string,"created_at": string,"finished_goods_lot_id": string,"fulfillment_id": string,"id": string,"order_item_id": string,"quantity": number,"returned_quantity": number,"total_cost": number | null,"unit_cost_snapshot": number | null,"unit_price_snapshot": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"finished_goods_lot_id": string,"fulfillment_id": string,"id"?: string,"order_item_id": string,"quantity": number,"returned_quantity"?: number,"total_cost"?: number | null,"unit_cost_snapshot"?: number | null,"unit_price_snapshot"?: number | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"finished_goods_lot_id"?: string,"fulfillment_id"?: string,"id"?: string,"order_item_id"?: string,"quantity"?: number,"returned_quantity"?: number,"total_cost"?: number | null,"unit_cost_snapshot"?: number | null,"unit_price_snapshot"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_fulfillment_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_fulfillment_items_finished_goods_lot_id_business_id_fkey"
      columns: ["finished_goods_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "finished_goods_inventory_view"
      referencedColumns: ["lot_id","business_id"]
    },{
      foreignKeyName: "sales_fulfillment_items_finished_goods_lot_id_business_id_fkey"
      columns: ["finished_goods_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "finished_goods_lots"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_fulfillment_items_fulfillment_id_business_id_fkey"
      columns: ["fulfillment_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_fulfillments"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_fulfillment_items_order_item_id_business_id_fkey"
      columns: ["order_item_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_order_items"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"sales_fulfillments": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"fulfilled_at": string,"fulfillment_number": string,"id": string,"idempotency_key": string | null,"location_id": string,"notes": string | null,"order_id": string,"posted_at": string | null,"posted_by": string | null,"status": Database["public"]['Enums']["sales_fulfillment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"fulfilled_at"?: string,"fulfillment_number": string,"id"?: string,"idempotency_key"?: string | null,"location_id": string,"notes"?: string | null,"order_id": string,"posted_at"?: string | null,"posted_by"?: string | null,"status"?: Database["public"]['Enums']["sales_fulfillment_status"],"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"fulfilled_at"?: string,"fulfillment_number"?: string,"id"?: string,"idempotency_key"?: string | null,"location_id"?: string,"notes"?: string | null,"order_id"?: string,"posted_at"?: string | null,"posted_by"?: string | null,"status"?: Database["public"]['Enums']["sales_fulfillment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_fulfillments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_fulfillments_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_fulfillments_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_order_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_fulfillments_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"sales_order_allocations": {
                  Row: {
                    "business_id": string,"created_at": string,"finished_goods_lot_id": string,"id": string,"location_id": string,"order_item_id": string,"quantity": number,"reservation_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"finished_goods_lot_id": string,"id"?: string,"location_id": string,"order_item_id": string,"quantity": number,"reservation_id"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"finished_goods_lot_id"?: string,"id"?: string,"location_id"?: string,"order_item_id"?: string,"quantity"?: number,"reservation_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_order_allocations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_order_allocations_finished_goods_lot_id_business_id_fkey"
      columns: ["finished_goods_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "finished_goods_inventory_view"
      referencedColumns: ["lot_id","business_id"]
    },{
      foreignKeyName: "sales_order_allocations_finished_goods_lot_id_business_id_fkey"
      columns: ["finished_goods_lot_id","business_id"]
isOneToOne: false
      referencedRelation: "finished_goods_lots"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_order_allocations_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_order_allocations_order_item_id_business_id_fkey"
      columns: ["order_item_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_order_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_order_allocations_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: false
      referencedRelation: "inventory_reservations"
      referencedColumns: ["id"]
    }
                  ]
                },"sales_order_items": {
                  Row: {
                    "business_id": string,"created_at": string,"discount_amount": number,"fulfilled_quantity": number,"id": string,"line_total": number,"order_id": string,"product_variant_id": string,"quantity": number,"returned_quantity": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"discount_amount"?: number,"fulfilled_quantity"?: number,"id"?: string,"line_total": number,"order_id": string,"product_variant_id": string,"quantity": number,"returned_quantity"?: number,"unit_price": number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"discount_amount"?: number,"fulfilled_quantity"?: number,"id"?: string,"line_total"?: number,"order_id"?: string,"product_variant_id"?: string,"quantity"?: number,"returned_quantity"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_order_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_order_items_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_order_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_order_items_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_order_items_product_variant_id_business_id_fkey"
      columns: ["product_variant_id","business_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_order_items_product_variant_id_business_id_fkey"
      columns: ["product_variant_id","business_id"]
isOneToOne: false
      referencedRelation: "variant_availability_view"
      referencedColumns: ["variant_id","business_id"]
    }
                  ]
                },"sales_orders": {
                  Row: {
                    "amount_paid": number,"amount_refunded": number,"business_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"completed_at": string | null,"confirmed_at": string | null,"created_at": string,"created_by": string | null,"customer_id": string | null,"discount_amount": number,"due_at": string | null,"id": string,"idempotency_key": string | null,"notes": string | null,"order_number": string,"ordered_at": string,"payment_status": Database["public"]['Enums']["payment_status"],"price_tier": string,"sales_channel_id": string,"status": Database["public"]['Enums']["sales_order_status"],"subtotal": number,"total_amount": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paid"?: number,"amount_refunded"?: number,"business_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"discount_amount"?: number,"due_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"notes"?: string | null,"order_number": string,"ordered_at"?: string,"payment_status"?: Database["public"]['Enums']["payment_status"],"price_tier"?: string,"sales_channel_id": string,"status"?: Database["public"]['Enums']["sales_order_status"],"subtotal"?: number,"total_amount"?: number,"updated_at"?: string
                  }
                  Update: {
                    "amount_paid"?: number,"amount_refunded"?: number,"business_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"discount_amount"?: number,"due_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"notes"?: string | null,"order_number"?: string,"ordered_at"?: string,"payment_status"?: Database["public"]['Enums']["payment_status"],"price_tier"?: string,"sales_channel_id"?: string,"status"?: Database["public"]['Enums']["sales_order_status"],"subtotal"?: number,"total_amount"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_orders_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_orders_customer_id_business_id_fkey"
      columns: ["customer_id","business_id"]
isOneToOne: false
      referencedRelation: "customer_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_orders_customer_id_business_id_fkey"
      columns: ["customer_id","business_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_orders_sales_channel_id_business_id_fkey"
      columns: ["sales_channel_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_channels"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"sales_return_items": {
                  Row: {
                    "business_id": string,"condition": string,"created_at": string,"disposition": string,"fulfillment_item_id": string,"id": string,"quantity": number,"return_id": string,"unit_cost_snapshot": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"condition": string,"created_at"?: string,"disposition": string,"fulfillment_item_id": string,"id"?: string,"quantity": number,"return_id": string,"unit_cost_snapshot"?: number | null
                  }
                  Update: {
                    "business_id"?: string,"condition"?: string,"created_at"?: string,"disposition"?: string,"fulfillment_item_id"?: string,"id"?: string,"quantity"?: number,"return_id"?: string,"unit_cost_snapshot"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_return_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_return_items_fulfillment_item_id_business_id_fkey"
      columns: ["fulfillment_item_id","business_id"]
isOneToOne: false
      referencedRelation: "report_sales_lines_view"
      referencedColumns: ["fulfillment_item_id","business_id"]
    },{
      foreignKeyName: "sales_return_items_fulfillment_item_id_business_id_fkey"
      columns: ["fulfillment_item_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_fulfillment_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_return_items_return_id_business_id_fkey"
      columns: ["return_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_returns"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"sales_returns": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string | null,"location_id": string,"notes": string | null,"order_id": string,"posted_at": string | null,"posted_by": string | null,"reason": string,"received_at": string,"return_number": string,"status": Database["public"]['Enums']["sales_return_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"location_id": string,"notes"?: string | null,"order_id": string,"posted_at"?: string | null,"posted_by"?: string | null,"reason": string,"received_at"?: string,"return_number": string,"status"?: Database["public"]['Enums']["sales_return_status"],"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"location_id"?: string,"notes"?: string | null,"order_id"?: string,"posted_at"?: string | null,"posted_by"?: string | null,"reason"?: string,"received_at"?: string,"return_number"?: string,"status"?: Database["public"]['Enums']["sales_return_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_returns_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_returns_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_returns_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_order_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_returns_order_id_business_id_fkey"
      columns: ["order_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "address": string | null,"business_id": string,"contact_person": string | null,"created_at": string,"email": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"business_id": string,"contact_person"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"business_id"?: string,"contact_person"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"user_profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string,"full_name": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email": string,"full_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"variant_materials": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"material_id": string,"quantity_per_unit": number,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"material_id": string,"quantity_per_unit": number,"variant_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"material_id"?: string,"quantity_per_unit"?: number,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "variant_materials_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "variant_materials_material_id_business_id_fkey"
      columns: ["material_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_material_inventory_view"
      referencedColumns: ["material_id","business_id"]
    },{
      foreignKeyName: "variant_materials_material_id_business_id_fkey"
      columns: ["material_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_materials"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "variant_materials_variant_id_business_id_fkey"
      columns: ["variant_id","business_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "variant_materials_variant_id_business_id_fkey"
      columns: ["variant_id","business_id"]
isOneToOne: false
      referencedRelation: "variant_availability_view"
      referencedColumns: ["variant_id","business_id"]
    }
                  ]
                }
          }
          Views: {
            "business_member_directory_view": {
                  Row: {
                    "accepted_at": string | null,"business_id": string,"created_at": string,"email": string,"full_name": string | null,"id": string,"invited_at": string | null,"invited_by": string | null,"invited_by_name": string | null,"is_active": boolean,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "business_members_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_summary_view": {
                  Row: {
                    "address": string | null,"business_id": string,"created_at": string,"customer_type": string,"email": string | null,"id": string,"is_active": boolean,"last_order_at": string | null,"name": string,"notes": string | null,"orders": number | null,"outstanding": number | null,"payment_terms_days": number,"phone": string | null,"revenue": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "customers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"finished_goods_inventory_view": {
                  Row: {
                    "available": number | null,"best_before_at": string | null,"business_id": string,"category": string | null,"coffee_names": string | null,"green_lot_codes": string | null,"inventory_item_id": string | null,"lot_code": string,"lot_id": string,"net_weight_g": number,"on_hand": number | null,"packaged_at": string,"packaged_quantity": number,"packaging_session_id": string | null,"product_id": string,"product_name": string,"reserved": number | null,"roast_batch_numbers": string | null,"selling_price": number,"session_number": string | null,"sku": string,"stock_status": string | null,"stock_value": number | null,"total_cost": number,"unit_cost": number,"variant_id": string,"variant_name": string,"wholesale_price": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "finished_goods_lots_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "finished_goods_lots_packaging_session_id_business_id_fkey"
      columns: ["packaging_session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_session_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "finished_goods_lots_packaging_session_id_business_id_fkey"
      columns: ["packaging_session_id","business_id"]
isOneToOne: false
      referencedRelation: "packaging_sessions"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"green_lot_inventory_view": {
                  Row: {
                    "available_g": number | null,"business_id": string,"coffee_name": string,"cost_per_kg": number | null,"country": string | null,"density_g_per_100ml": number | null,"green_coffee_id": string,"inventory_item_id": string | null,"last_received_at": string | null,"lot_code": string,"lot_id": string,"low_stock_threshold": number | null,"low_stock_threshold_g": number | null,"moisture_pct": number | null,"on_hand_g": number | null,"processing_method": string | null,"received_at": string | null,"received_quantity_g": number | null,"region": string | null,"reserved_g": number | null,"stock_status": string | null,"stock_value": number | null,"supplier_id": string | null,"supplier_name": string | null,"total_received_cost": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "green_coffee_lots_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movement_history_view": {
                  Row: {
                    "base_unit": string,"business_id": string,"coffee_name": string | null,"created_by": string | null,"created_by_name": string | null,"id": string,"inventory_item_id": string,"item_type": Database["public"]['Enums']["inventory_item_type"],"location_id": string,"location_name": string,"lot_code": string | null,"lot_id": string | null,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"notes": string | null,"posted_at": string,"quantity_delta": number,"source_id": string,"source_type": string,"total_cost": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_inventory_item_id_business_id_fkey"
      columns: ["inventory_item_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "inventory_movements_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"inventory_reconciliation_view": {
                  Row: {
                    "business_id": string,"difference": number | null,"inventory_item_id": string,"ledger_quantity": number | null,"location_id": string,"on_hand_quantity": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "inventory_balances_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_balances_inventory_item_id_business_id_fkey"
      columns: ["inventory_item_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "inventory_balances_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"packaging_material_inventory_view": {
                  Row: {
                    "available": number | null,"base_unit": string,"business_id": string,"inventory_item_id": string | null,"is_active": boolean,"material_id": string,"name": string,"on_hand": number | null,"reorder_level": number,"reserved": number | null,"sku": string | null,"standard_unit_cost": number,"stock_status": string | null,"stock_value": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "packaging_materials_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"packaging_session_summary_view": {
                  Row: {
                    "batch_numbers": string | null,"business_id": string,"coffee_cost": number | null,"completed_at": string | null,"created_at": string,"id": string,"input_weight_g": number | null,"labor_cost": number,"location_id": string,"location_name": string,"material_cost": number | null,"notes": string | null,"operator_id": string | null,"operator_name": string | null,"output_units": number | null,"overhead_cost": number,"packaged_at": string,"product_names": string | null,"required_weight_g": number | null,"session_number": string,"status": Database["public"]['Enums']["packaging_session_status"],"total_cost": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "packaging_sessions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "packaging_sessions_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "packaging_sessions_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"report_expenses_view": {
                  Row: {
                    "allocated_amount": number | null,"amount": number,"business_id": string,"category_id": string,"category_name": string,"classification": string,"cost_treatment": string,"created_at": string,"description": string,"expense_number": string,"id": string,"incurred_at": string,"is_voided": boolean,"operating_amount": number | null,"payment_method": Database["public"]['Enums']["payment_method"] | null,"payment_reference": string | null,"receipt_path": string | null,"supplier_id": string | null,"supplier_name": string | null,"unallocated_amount": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "expenses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"report_sales_lines_view": {
                  Row: {
                    "business_id": string,"channel_id": string,"channel_name": string,"cogs": number | null,"customer_id": string | null,"customer_name": string | null,"fulfillment_item_id": string,"lot_code": string,"net_revenue": number | null,"net_units": number | null,"order_id": string,"order_number": string,"ordered_at": string,"origins": string | null,"product_id": string,"product_name": string,"returned_units": number,"sku": string,"sold_at": string,"unit_cost_snapshot": number | null,"unit_price_snapshot": number | null,"units": number,"variant_id": string,"variant_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sales_fulfillment_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"roast_batch_summary_view": {
                  Row: {
                    "batch_number": string,"business_id": string,"coffee_names": string | null,"completed_at": string | null,"development_ratio_pct": number | null,"development_seconds": number | null,"first_crack_seconds": number | null,"green_cost": number | null,"green_weight_g": number,"id": string,"location_id": string,"location_name": string,"lot_codes": string | null,"lot_count": number | null,"operator_id": string | null,"operator_name": string | null,"production_cost_total": number | null,"profile_name": string | null,"roast_date": string,"roast_level": string | null,"roast_loss_pct": number | null,"roast_profile_id": string | null,"roast_yield_pct": number | null,"roasted_available_g": number | null,"roasted_cost_per_g": number | null,"roasted_cost_per_kg": number | null,"roasted_item_id": string | null,"roasted_on_hand_g": number | null,"roasted_reserved_g": number | null,"roasted_stock_value": number | null,"roasted_weight_g": number | null,"roaster_capacity_g": number,"roaster_id": string,"roaster_name": string,"started_at": string | null,"status": Database["public"]['Enums']["roast_batch_status"],"total_duration_seconds": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "roast_batches_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_batches_location_id_business_id_fkey"
      columns: ["location_id","business_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_batches_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "user_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roast_batches_roast_profile_id_business_id_fkey"
      columns: ["roast_profile_id","business_id"]
isOneToOne: false
      referencedRelation: "roast_profiles"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "roast_batches_roaster_id_business_id_fkey"
      columns: ["roaster_id","business_id"]
isOneToOne: false
      referencedRelation: "roasters"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"sales_order_summary_view": {
                  Row: {
                    "amount_paid": number,"amount_refunded": number,"business_id": string,"cancelled_at": string | null,"channel_name": string,"channel_type": string,"completed_at": string | null,"confirmed_at": string | null,"created_at": string,"customer_id": string | null,"customer_name": string | null,"customer_type": string | null,"discount_amount": number,"due_at": string | null,"fulfilled_units": number | null,"id": string,"item_count": number | null,"notes": string | null,"order_number": string,"ordered_at": string,"ordered_units": number | null,"outstanding_amount": number | null,"payment_status": Database["public"]['Enums']["payment_status"],"price_tier": string,"product_names": string | null,"returned_units": number | null,"sales_channel_id": string,"status": Database["public"]['Enums']["sales_order_status"],"subtotal": number,"total_amount": number,"total_cogs": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sales_orders_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_orders_customer_id_business_id_fkey"
      columns: ["customer_id","business_id"]
isOneToOne: false
      referencedRelation: "customer_summary_view"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_orders_customer_id_business_id_fkey"
      columns: ["customer_id","business_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id","business_id"]
    },{
      foreignKeyName: "sales_orders_sales_channel_id_business_id_fkey"
      columns: ["sales_channel_id","business_id"]
isOneToOne: false
      referencedRelation: "sales_channels"
      referencedColumns: ["id","business_id"]
    }
                  ]
                },"variant_availability_view": {
                  Row: {
                    "available": number | null,"business_id": string,"is_active": boolean,"net_weight_g": number,"on_hand": number | null,"product_name": string,"reserved": number | null,"selling_price": number,"sku": string,"variant_id": string,"variant_name": string,"wholesale_price": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "product_variants_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "cancel_purchase_order":
{ Args: { "p_purchase_order_id": string }; Returns: undefined
                           },
"cancel_sales_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: undefined
                           },
"complete_packaging_session":
{ Args: { "p_session_id": string }; Returns: string
                           },
"complete_roast_batch":
{ Args: { "p_batch_id": string,"p_charge_bt_c": number,"p_charge_et_c": number,"p_costs": Json,"p_drop_bt_c": number,"p_first_crack_bt_c": number,"p_first_crack_seconds": number,"p_notes": string,"p_roast_level": string,"p_roasted_weight_g": number,"p_total_duration_seconds": number }; Returns: string
                           },
"confirm_purchase_order":
{ Args: { "p_purchase_order_id": string }; Returns: undefined
                           },
"confirm_sales_order":
{ Args: { "p_order_id": string,"p_reserve"?: boolean }; Returns: undefined
                           },
"create_business_with_owner":
{ Args: { "p_name": string,"p_owner_user_id": string,"p_slug"?: string }; Returns: string
                           },
"create_goods_receipt":
{ Args: { "p_additional_costs": number,"p_idempotency_key": string,"p_items": Json,"p_location_id": string,"p_notes": string,"p_purchase_order_id": string,"p_received_at": string }; Returns: string
                           },
"create_inventory_adjustment":
{ Args: { "p_business_id": string,"p_idempotency_key": string,"p_lines": Json,"p_notes": string,"p_post"?: boolean,"p_reason": string }; Returns: string
                           },
"create_packaging_session":
{ Args: { "p_business_id": string,"p_idempotency_key": string,"p_inputs": Json,"p_labor_cost": number,"p_location_id": string,"p_materials": Json,"p_notes": string,"p_operator_id": string,"p_outputs": Json,"p_overhead_cost": number,"p_packaged_at": string }; Returns: string
                           },
"create_purchase_order":
{ Args: { "p_additional_costs": number,"p_business_id": string,"p_idempotency_key": string,"p_items": Json,"p_notes": string,"p_ordered_at": string,"p_supplier_id": string }; Returns: string
                           },
"create_roast_batch":
{ Args: { "p_business_id": string,"p_idempotency_key": string,"p_inputs": Json,"p_location_id": string,"p_notes": string,"p_operator_id": string,"p_roast_date": string,"p_roast_profile_id": string,"p_roaster_id": string }; Returns: string
                           },
"create_sales_order":
{ Args: { "p_business_id": string,"p_customer_id": string,"p_discount_amount": number,"p_due_at": string,"p_idempotency_key": string,"p_items": Json,"p_notes": string,"p_ordered_at": string,"p_price_tier": string,"p_sales_channel_id": string }; Returns: string
                           },
"create_sales_return":
{ Args: { "p_idempotency_key": string,"p_items": Json,"p_location_id": string,"p_notes": string,"p_order_id": string,"p_reason": string,"p_received_at": string }; Returns: string
                           },
"dashboard_metrics":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"fulfill_sales_order":
{ Args: { "p_fulfilled_at": string,"p_idempotency_key": string,"p_items": Json,"p_location_id": string,"p_notes": string,"p_order_id": string }; Returns: string
                           },
"issue_refund":
{ Args: { "p_amount": number,"p_idempotency_key": string,"p_method": string,"p_payment_id": string,"p_reason": string }; Returns: string
                           },
"my_memberships":
{ Args: Record<PropertyKey, never>; Returns: {
              "business_id": string,"business_name": string,"business_slug": string,"role": Database["public"]['Enums']["member_role"]
            }[]
                           },
"post_goods_receipt":
{ Args: { "p_receipt_id": string }; Returns: string
                           },
"post_inventory_adjustment":
{ Args: { "p_adjustment_id": string }; Returns: string
                           },
"record_payment":
{ Args: { "p_amount": number,"p_idempotency_key": string,"p_method": string,"p_notes": string,"p_order_id": string,"p_received_at": string,"p_reference": string }; Returns: string
                           },
"release_inventory_reservation":
{ Args: { "p_reservation_id": string }; Returns: undefined
                           },
"report_expenses_by_category":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"category": string,"classification": string,"cost_treatment": string,"operating_amount": number
            }[]
                           },
"report_inventory_valuation":
{ Args: { "p_business_id": string }; Returns: {
              "item_type": Database["public"]['Enums']["inventory_item_type"],"items": number,"quantity": number,"value": number
            }[]
                           },
"report_monthly_sales":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "cogs": number,"gross_margin_pct": number,"gross_profit": number,"month": string,"net_sales": number,"units": number
            }[]
                           },
"report_profitability":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "cogs": number,"gross_margin_pct": number,"gross_profit": number,"net_sales": number,"operating_expenses": number,"operating_result": number,"orders": number,"refunds": number,"units_sold": number
            }[]
                           },
"report_sales_by_dimension":
{ Args: { "p_business_id": string,"p_dimension": string,"p_from": string,"p_to": string }; Returns: {
              "cogs": number,"label": string,"net_sales": number,"units": number
            }[]
                           },
"report_weekly_production":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "batches": number,"cost_per_kg": number,"green_g": number,"loss_pct": number,"roasted_g": number,"week": string
            }[]
                           },
"reserve_inventory":
{ Args: { "p_idempotency_key": string,"p_inventory_item_id": string,"p_location_id": string,"p_quantity": number,"p_source_id": string,"p_source_type": string }; Returns: string
                           },
"reverse_inventory_adjustment":
{ Args: { "p_adjustment_id": string,"p_idempotency_key": string }; Returns: string
                           },
"start_roast_batch":
{ Args: { "p_batch_id": string }; Returns: undefined
                           },
"update_packaging_session_draft":
{ Args: { "p_inputs": Json,"p_labor_cost": number,"p_location_id": string,"p_materials": Json,"p_notes": string,"p_operator_id": string,"p_outputs": Json,"p_overhead_cost": number,"p_packaged_at": string,"p_session_id": string }; Returns: string
                           },
"update_purchase_order_draft":
{ Args: { "p_additional_costs": number,"p_items": Json,"p_notes": string,"p_ordered_at": string,"p_purchase_order_id": string,"p_supplier_id": string }; Returns: string
                           },
"update_roast_batch_draft":
{ Args: { "p_batch_id": string,"p_inputs": Json,"p_location_id": string,"p_notes": string,"p_operator_id": string,"p_roast_date": string,"p_roast_profile_id": string,"p_roaster_id": string }; Returns: string
                           },
"update_sales_order_draft":
{ Args: { "p_customer_id": string,"p_discount_amount": number,"p_due_at": string,"p_items": Json,"p_notes": string,"p_order_id": string,"p_ordered_at": string,"p_price_tier": string,"p_sales_channel_id": string }; Returns: string
                           },
"void_packaging_session":
{ Args: { "p_idempotency_key": string,"p_reason": string,"p_session_id": string }; Returns: undefined
                           },
"void_roast_batch":
{ Args: { "p_batch_id": string,"p_idempotency_key": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "goods_receipt_status": "draft"|"posted"|"cancelled","inventory_adjustment_status": "draft"|"posted"|"reversed","inventory_item_type": "green_coffee_lot"|"roasted_bulk"|"finished_product"|"packaging_material","inventory_movement_type": "receipt"|"adjustment"|"adjustment_reversal"|"roast_consume"|"roast_output"|"pack_consume"|"pack_output"|"sale"|"sale_return"|"transfer_in"|"transfer_out"|"write_off"|"roast_void_restore"|"roast_void_consume"|"pack_void_consume"|"pack_void_restore","inventory_reservation_status": "active"|"released"|"consumed","member_role": "owner"|"roaster"|"inventory_staff"|"sales_staff"|"viewer","packaging_session_status": "draft"|"completed"|"voided","payment_method": "cash"|"bank_transfer"|"gcash"|"maya"|"other","payment_status": "unpaid"|"partially_paid"|"paid"|"partially_refunded"|"refunded","purchase_order_status": "draft"|"confirmed"|"partially_received"|"received"|"cancelled","roast_batch_status": "draft"|"in_progress"|"completed"|"voided","roast_event_type": "charge"|"turning_point"|"dry_end"|"first_crack_start"|"first_crack_end"|"second_crack_start"|"drop"|"cooling_end"|"gas_change"|"airflow_change"|"drum_change"|"note","sales_fulfillment_status": "draft"|"posted"|"cancelled","sales_order_status": "draft"|"confirmed"|"reserved"|"partially_fulfilled"|"fulfilled"|"completed"|"cancelled"|"returned","sales_return_status": "draft"|"posted"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "goods_receipt_status": ["draft", "posted", "cancelled"],"inventory_adjustment_status": ["draft", "posted", "reversed"],"inventory_item_type": ["green_coffee_lot", "roasted_bulk", "finished_product", "packaging_material"],"inventory_movement_type": ["receipt", "adjustment", "adjustment_reversal", "roast_consume", "roast_output", "pack_consume", "pack_output", "sale", "sale_return", "transfer_in", "transfer_out", "write_off", "roast_void_restore", "roast_void_consume", "pack_void_consume", "pack_void_restore"],"inventory_reservation_status": ["active", "released", "consumed"],"member_role": ["owner", "roaster", "inventory_staff", "sales_staff", "viewer"],"packaging_session_status": ["draft", "completed", "voided"],"payment_method": ["cash", "bank_transfer", "gcash", "maya", "other"],"payment_status": ["unpaid", "partially_paid", "paid", "partially_refunded", "refunded"],"purchase_order_status": ["draft", "confirmed", "partially_received", "received", "cancelled"],"roast_batch_status": ["draft", "in_progress", "completed", "voided"],"roast_event_type": ["charge", "turning_point", "dry_end", "first_crack_start", "first_crack_end", "second_crack_start", "drop", "cooling_end", "gas_change", "airflow_change", "drum_change", "note"],"sales_fulfillment_status": ["draft", "posted", "cancelled"],"sales_order_status": ["draft", "confirmed", "reserved", "partially_fulfilled", "fulfilled", "completed", "cancelled", "returned"],"sales_return_status": ["draft", "posted", "cancelled"]
          }
        }
} as const
