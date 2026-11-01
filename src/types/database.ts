
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
                    "business_id": string,"created_at": string,"id": string,"invited_by": string | null,"is_active": boolean,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"invited_by"?: string | null,"is_active"?: boolean,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"invited_by"?: string | null,"is_active"?: boolean,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
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
                    "business_id": string,"costing_method": string,"created_at": string,"currency": string,"default_location_id": string | null,"default_roaster_id": string | null,"id": string,"inventory_weight_unit": string,"timezone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"costing_method"?: string,"created_at"?: string,"currency"?: string,"default_location_id"?: string | null,"default_roaster_id"?: string | null,"id"?: string,"inventory_weight_unit"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"costing_method"?: string,"created_at"?: string,"currency"?: string,"default_location_id"?: string | null,"default_roaster_id"?: string | null,"id"?: string,"inventory_weight_unit"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
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
                }
          }
          Views: {
            "green_lot_inventory_view": {
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
                }
          }
          Functions: {
            "cancel_purchase_order":
{ Args: { "p_purchase_order_id": string }; Returns: undefined
                           },
"complete_roast_batch":
{ Args: { "p_batch_id": string,"p_charge_bt_c": number,"p_charge_et_c": number,"p_costs": Json,"p_drop_bt_c": number,"p_first_crack_bt_c": number,"p_first_crack_seconds": number,"p_notes": string,"p_roast_level": string,"p_roasted_weight_g": number,"p_total_duration_seconds": number }; Returns: string
                           },
"confirm_purchase_order":
{ Args: { "p_purchase_order_id": string }; Returns: undefined
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
"create_purchase_order":
{ Args: { "p_additional_costs": number,"p_business_id": string,"p_idempotency_key": string,"p_items": Json,"p_notes": string,"p_ordered_at": string,"p_supplier_id": string }; Returns: string
                           },
"create_roast_batch":
{ Args: { "p_business_id": string,"p_idempotency_key": string,"p_inputs": Json,"p_location_id": string,"p_notes": string,"p_operator_id": string,"p_roast_date": string,"p_roast_profile_id": string,"p_roaster_id": string }; Returns: string
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
"release_inventory_reservation":
{ Args: { "p_reservation_id": string }; Returns: undefined
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
"update_purchase_order_draft":
{ Args: { "p_additional_costs": number,"p_items": Json,"p_notes": string,"p_ordered_at": string,"p_purchase_order_id": string,"p_supplier_id": string }; Returns: string
                           },
"update_roast_batch_draft":
{ Args: { "p_batch_id": string,"p_inputs": Json,"p_location_id": string,"p_notes": string,"p_operator_id": string,"p_roast_date": string,"p_roast_profile_id": string,"p_roaster_id": string }; Returns: string
                           },
"void_roast_batch":
{ Args: { "p_batch_id": string,"p_idempotency_key": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "goods_receipt_status": "draft"|"posted"|"cancelled","inventory_adjustment_status": "draft"|"posted"|"reversed","inventory_item_type": "green_coffee_lot"|"roasted_bulk"|"finished_product"|"packaging_material","inventory_movement_type": "receipt"|"adjustment"|"adjustment_reversal"|"roast_consume"|"roast_output"|"pack_consume"|"pack_output"|"sale"|"sale_return"|"transfer_in"|"transfer_out"|"write_off"|"roast_void_restore"|"roast_void_consume","inventory_reservation_status": "active"|"released"|"consumed","member_role": "owner"|"roaster"|"inventory_staff"|"sales_staff"|"viewer","purchase_order_status": "draft"|"confirmed"|"partially_received"|"received"|"cancelled","roast_batch_status": "draft"|"in_progress"|"completed"|"voided","roast_event_type": "charge"|"turning_point"|"dry_end"|"first_crack_start"|"first_crack_end"|"second_crack_start"|"drop"|"cooling_end"|"gas_change"|"airflow_change"|"drum_change"|"note"
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
            "goods_receipt_status": ["draft", "posted", "cancelled"],"inventory_adjustment_status": ["draft", "posted", "reversed"],"inventory_item_type": ["green_coffee_lot", "roasted_bulk", "finished_product", "packaging_material"],"inventory_movement_type": ["receipt", "adjustment", "adjustment_reversal", "roast_consume", "roast_output", "pack_consume", "pack_output", "sale", "sale_return", "transfer_in", "transfer_out", "write_off", "roast_void_restore", "roast_void_consume"],"inventory_reservation_status": ["active", "released", "consumed"],"member_role": ["owner", "roaster", "inventory_staff", "sales_staff", "viewer"],"purchase_order_status": ["draft", "confirmed", "partially_received", "received", "cancelled"],"roast_batch_status": ["draft", "in_progress", "completed", "voided"],"roast_event_type": ["charge", "turning_point", "dry_end", "first_crack_start", "first_crack_end", "second_crack_start", "drop", "cooling_end", "gas_change", "airflow_change", "drum_change", "note"]
          }
        }
} as const
