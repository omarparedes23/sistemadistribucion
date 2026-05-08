// ============================================================
// MANUAL TYPES for Core Masters tables
// Generated from migrations/001_initial_schema.sql + 003_missing_tables.sql
// TODO: Replace with `supabase gen types typescript` output when credentials available
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      re_companies: {
        Row: {
          id: string;
          legal_name: string;
          ruc: string;
          address: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legal_name: string;
          ruc: string;
          address?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          legal_name?: string;
          ruc?: string;
          address?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      re_branches: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          region: string;
          address: string | null;
          gre_serie: string | null;
          factura_serie: string | null;
          boleta_serie: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          region: string;
          address?: string | null;
          gre_serie?: string | null;
          factura_serie?: string | null;
          boleta_serie?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          region?: string;
          address?: string | null;
          gre_serie?: string | null;
          factura_serie?: string | null;
          boleta_serie?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_branches_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "re_companies";
            referencedColumns: ["id"];
          }
        ];
      };
      re_warehouses: {
        Row: {
          id: string;
          branch_id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          name?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_warehouses_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          }
        ];
      };
      re_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      re_brands: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_brands_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "re_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      re_products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          brand_id: string;
          unit_of_measure: string;
          weight_kg: number | null;
          volume_m3: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          brand_id: string;
          unit_of_measure: string;
          weight_kg?: number | null;
          volume_m3?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          brand_id?: string;
          unit_of_measure?: string;
          weight_kg?: number | null;
          volume_m3?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "re_brands";
            referencedColumns: ["id"];
          }
        ];
      };
      re_profiles: {
        Row: {
          id: string;
          full_name: string;
          document_type: string;
          document_number: string;
          role: string;
          branch_id: string;
          company_id: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          document_type?: string;
          document_number: string;
          role: string;
          branch_id: string;
          company_id: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          document_type?: string;
          document_number?: string;
          role?: string;
          branch_id?: string;
          company_id?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_profiles_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "re_companies";
            referencedColumns: ["id"];
          }
        ];
      };
      re_sales_routes: {
        Row: {
          id: string;
          branch_id: string;
          name: string;
          description: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          name: string;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          name?: string;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_sales_routes_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          }
        ];
      };
      re_inventory_stock: {
        Row: {
          id: string;
          branch_id: string;
          warehouse_id: string;
          product_id: string;
          stock_actual: number;
          stock_reserved: number;
          stock_available: number;
          weighted_avg_cost: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          warehouse_id: string;
          product_id: string;
          stock_actual?: number;
          stock_reserved?: number;
          weighted_avg_cost?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          warehouse_id?: string;
          product_id?: string;
          stock_actual?: number;
          stock_reserved?: number;
          weighted_avg_cost?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_inventory_stock_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_inventory_stock_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "re_warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_inventory_stock_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_inventory_movements: {
        Row: {
          id: string;
          branch_id: string;
          warehouse_id: string;
          product_id: string;
          type: Database["public"]["Enums"]["re_movement_type"];
          reason_code: Database["public"]["Enums"]["re_movement_reason"];
          quantity: number;
          unit_cost: number;
          reference_id: string;
          reference_type: string;
          user_id: string;
          movement_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          warehouse_id: string;
          product_id: string;
          type: Database["public"]["Enums"]["re_movement_type"];
          reason_code: Database["public"]["Enums"]["re_movement_reason"];
          quantity: number;
          unit_cost?: number;
          reference_id: string;
          reference_type: string;
          user_id: string;
          movement_date: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          warehouse_id?: string;
          product_id?: string;
          type?: Database["public"]["Enums"]["re_movement_type"];
          reason_code?: Database["public"]["Enums"]["re_movement_reason"];
          quantity?: number;
          unit_cost?: number;
          reference_id?: string;
          reference_type?: string;
          user_id?: string;
          movement_date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_inventory_movements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_inventory_movements_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "re_warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_inventory_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_stock_transfers: {
        Row: {
          id: string;
          from_branch_id: string;
          from_warehouse_id: string;
          to_branch_id: string;
          to_warehouse_id: string;
          product_id: string;
          quantity: number;
          unit_cost: number;
          status: Database["public"]["Enums"]["re_transfer_status"];
          requested_by: string;
          confirmed_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_branch_id: string;
          from_warehouse_id: string;
          to_branch_id: string;
          to_warehouse_id: string;
          product_id: string;
          quantity: number;
          unit_cost?: number;
          status?: Database["public"]["Enums"]["re_transfer_status"];
          requested_by: string;
          confirmed_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          from_branch_id?: string;
          from_warehouse_id?: string;
          to_branch_id?: string;
          to_warehouse_id?: string;
          product_id?: string;
          quantity?: number;
          unit_cost?: number;
          status?: Database["public"]["Enums"]["re_transfer_status"];
          requested_by?: string;
          confirmed_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_stock_transfers_from_branch_id_fkey";
            columns: ["from_branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_stock_transfers_from_warehouse_id_fkey";
            columns: ["from_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "re_warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_stock_transfers_to_branch_id_fkey";
            columns: ["to_branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_stock_transfers_to_warehouse_id_fkey";
            columns: ["to_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "re_warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_stock_transfers_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_adjustment_records: {
        Row: {
          id: string;
          branch_id: string;
          warehouse_id: string;
          product_id: string;
          adjustment_type: string;
          quantity: number;
          unit_cost: number | null;
          notes: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          warehouse_id: string;
          product_id: string;
          adjustment_type: string;
          quantity: number;
          unit_cost?: number | null;
          notes: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          warehouse_id?: string;
          product_id?: string;
          adjustment_type?: string;
          quantity?: number;
          unit_cost?: number | null;
          notes?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_adjustment_records_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_adjustment_records_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "re_warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_adjustment_records_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_price_lists: {
        Row: {
          id: string;
          branch_id: string;
          name: string;
          valid_from: string;
          valid_until: string | null;
          is_default: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          name: string;
          valid_from: string;
          valid_until?: string | null;
          is_default?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          name?: string;
          valid_from?: string;
          valid_until?: string | null;
          is_default?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_price_lists_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          }
        ];
      };
      re_price_list_items: {
        Row: {
          id: string;
          price_list_id: string;
          product_id: string;
          unit_price: number;
          currency: string;
          discount_pct: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          price_list_id: string;
          product_id: string;
          unit_price: number;
          currency?: string;
          discount_pct?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          price_list_id?: string;
          product_id?: string;
          unit_price?: number;
          currency?: string;
          discount_pct?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_price_list_items_price_list_id_fkey";
            columns: ["price_list_id"];
            isOneToOne: false;
            referencedRelation: "re_price_lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_price_list_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_customers: {
        Row: {
          id: string;
          branch_id: string;
          ruc_or_dni: string;
          legal_name: string;
          trade_name: string | null;
          phone: string | null;
          credit_limit: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          ruc_or_dni: string;
          legal_name: string;
          trade_name?: string | null;
          phone?: string | null;
          credit_limit?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          ruc_or_dni?: string;
          legal_name?: string;
          trade_name?: string | null;
          phone?: string | null;
          credit_limit?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_customers_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          }
        ];
      };
      re_customer_addresses: {
        Row: {
          id: string;
          customer_id: string;
          address_line: string;
          district: string;
          province: string;
          department: string;
          coordinates: unknown | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          address_line: string;
          district: string;
          province: string;
          department: string;
          coordinates?: unknown | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          address_line?: string;
          district?: string;
          province?: string;
          department?: string;
          coordinates?: unknown | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_customer_addresses_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "re_customers";
            referencedColumns: ["id"];
          }
        ];
      };
      re_customer_price_assignments: {
        Row: {
          id: string;
          customer_id: string;
          branch_id: string;
          price_list_id: string;
          assigned_from: string;
          assigned_until: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          branch_id: string;
          price_list_id: string;
          assigned_from: string;
          assigned_until?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          branch_id?: string;
          price_list_id?: string;
          assigned_from?: string;
          assigned_until?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_customer_price_assignments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "re_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_customer_price_assignments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_customer_price_assignments_price_list_id_fkey";
            columns: ["price_list_id"];
            isOneToOne: false;
            referencedRelation: "re_price_lists";
            referencedColumns: ["id"];
          }
        ];
      };
      re_discount_rules: {
        Row: {
          id: string;
          price_list_id: string;
          product_id: string;
          min_quantity: number;
          discount_pct: number;
          valid_from: string;
          valid_until: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          price_list_id: string;
          product_id: string;
          min_quantity: number;
          discount_pct: number;
          valid_from: string;
          valid_until?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          price_list_id?: string;
          product_id?: string;
          min_quantity?: number;
          discount_pct?: number;
          valid_from?: string;
          valid_until?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_discount_rules_price_list_id_fkey";
            columns: ["price_list_id"];
            isOneToOne: false;
            referencedRelation: "re_price_lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_discount_rules_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_promotion_rules: {
        Row: {
          id: string;
          branch_id: string;
          name: string;
          min_quantity: number;
          bonus_product_id: string | null;
          bonus_quantity: number;
          valid_from: string;
          valid_until: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          name: string;
          min_quantity: number;
          bonus_product_id?: string | null;
          bonus_quantity?: number;
          valid_from: string;
          valid_until?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          name?: string;
          min_quantity?: number;
          bonus_product_id?: string | null;
          bonus_quantity?: number;
          valid_from?: string;
          valid_until?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_promotion_rules_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_promotion_rules_bonus_product_id_fkey";
            columns: ["bonus_product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_orders: {
        Row: {
          id: string;
          branch_id: string;
          customer_id: string;
          seller_id: string;
          sales_route_id: string | null;
          delivery_address_id: string;
          status: Database["public"]["Enums"]["re_order_state"];
          payment_status: Database["public"]["Enums"]["re_payment_status"];
          total: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          customer_id: string;
          seller_id: string;
          sales_route_id?: string | null;
          delivery_address_id: string;
          status?: Database["public"]["Enums"]["re_order_state"];
          payment_status?: Database["public"]["Enums"]["re_payment_status"];
          total?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          customer_id?: string;
          seller_id?: string;
          sales_route_id?: string | null;
          delivery_address_id?: string;
          status?: Database["public"]["Enums"]["re_order_state"];
          payment_status?: Database["public"]["Enums"]["re_payment_status"];
          total?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "re_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_orders_sales_route_id_fkey";
            columns: ["sales_route_id"];
            isOneToOne: false;
            referencedRelation: "re_sales_routes";
            referencedColumns: ["id"];
          }
        ];
      };
      re_order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_pct: number;
          discount_amount: number;
          line_total: number;
          is_bonus: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_pct?: number;
          discount_amount?: number;
          line_total?: number;
          is_bonus?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          discount_pct?: number;
          discount_amount?: number;
          line_total?: number;
          is_bonus?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "re_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_invoices: {
        Row: {
          id: string;
          order_id: string;
          branch_id: string;
          customer_id: string;
          doc_type: Database["public"]["Enums"]["re_doc_type"];
          serie: string;
          correlativo: string;
          subtotal: number;
          igv_amount: number;
          total: number;
          issue_date: string;
          sunat_status: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url: string | null;
          pdf_url: string | null;
          ose_response_code: string | null;
          ose_response_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          branch_id: string;
          customer_id: string;
          doc_type: Database["public"]["Enums"]["re_doc_type"];
          serie: string;
          correlativo: string;
          subtotal?: number;
          igv_amount?: number;
          total?: number;
          issue_date: string;
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url?: string | null;
          pdf_url?: string | null;
          ose_response_code?: string | null;
          ose_response_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          branch_id?: string;
          customer_id?: string;
          doc_type?: Database["public"]["Enums"]["re_doc_type"];
          serie?: string;
          correlativo?: string;
          subtotal?: number;
          igv_amount?: number;
          total?: number;
          issue_date?: string;
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url?: string | null;
          pdf_url?: string | null;
          ose_response_code?: string | null;
          ose_response_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_invoices_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "re_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_invoices_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "re_customers";
            referencedColumns: ["id"];
          }
        ];
      };
      re_invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_pct: number;
          discount_amount: number;
          line_total: number;
          is_bonus: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_pct?: number;
          discount_amount?: number;
          line_total?: number;
          is_bonus?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          discount_pct?: number;
          discount_amount?: number;
          line_total?: number;
          is_bonus?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "re_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_invoice_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_credit_notes: {
        Row: {
          id: string;
          invoice_id: string;
          order_id: string;
          branch_id: string;
          serie: string;
          correlativo: string;
          reason: string;
          subtotal: number;
          igv_amount: number;
          total: number;
          issue_date: string;
          sunat_status: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url: string | null;
          pdf_url: string | null;
          ose_response_code: string | null;
          ose_response_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          order_id: string;
          branch_id: string;
          serie: string;
          correlativo: string;
          reason: string;
          subtotal?: number;
          igv_amount?: number;
          total?: number;
          issue_date: string;
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url?: string | null;
          pdf_url?: string | null;
          ose_response_code?: string | null;
          ose_response_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          order_id?: string;
          branch_id?: string;
          serie?: string;
          correlativo?: string;
          reason?: string;
          subtotal?: number;
          igv_amount?: number;
          total?: number;
          issue_date?: string;
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url?: string | null;
          pdf_url?: string | null;
          ose_response_code?: string | null;
          ose_response_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_credit_notes_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "re_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_credit_notes_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "re_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_credit_notes_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          }
        ];
      };
      re_credit_note_items: {
        Row: {
          id: string;
          credit_note_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          credit_note_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          line_total?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          credit_note_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          line_total?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_credit_note_items_credit_note_id_fkey";
            columns: ["credit_note_id"];
            isOneToOne: false;
            referencedRelation: "re_credit_notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_credit_note_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "re_products";
            referencedColumns: ["id"];
          }
        ];
      };
      re_collections: {
        Row: {
          id: string;
          branch_id: string;
          seller_id: string;
          customer_id: string;
          payment_method: Database["public"]["Enums"]["re_payment_method"];
          reference_number: string | null;
          total_collected: number;
          collected_at: string;
          parent_collection_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          seller_id: string;
          customer_id: string;
          payment_method: Database["public"]["Enums"]["re_payment_method"];
          reference_number?: string | null;
          total_collected?: number;
          collected_at?: string;
          parent_collection_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          seller_id?: string;
          customer_id?: string;
          payment_method?: Database["public"]["Enums"]["re_payment_method"];
          reference_number?: string | null;
          total_collected?: number;
          collected_at?: string;
          parent_collection_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_collections_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_collections_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "re_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_collections_parent_collection_id_fkey";
            columns: ["parent_collection_id"];
            isOneToOne: false;
            referencedRelation: "re_collections";
            referencedColumns: ["id"];
          }
        ];
      };
      re_collection_items: {
        Row: {
          id: string;
          collection_id: string;
          order_id: string;
          invoice_id: string | null;
          amount_applied: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          order_id: string;
          invoice_id?: string | null;
          amount_applied: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          order_id?: string;
          invoice_id?: string | null;
          amount_applied?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_collection_items_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "re_collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_collection_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "re_orders";
            referencedColumns: ["id"];
          }
        ];
      };
      re_daily_settlements: {
        Row: {
          id: string;
          branch_id: string;
          seller_id: string;
          settlement_date: string;
          total_expected: number;
          total_collected_physical: number | null;
          difference: number;
          status: Database["public"]["Enums"]["re_settlement_status"];
          supervisor_notes: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          seller_id: string;
          settlement_date: string;
          total_expected?: number;
          total_collected_physical?: number | null;
          status?: Database["public"]["Enums"]["re_settlement_status"];
          supervisor_notes?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          seller_id?: string;
          settlement_date?: string;
          total_expected?: number;
          total_collected_physical?: number | null;
          status?: Database["public"]["Enums"]["re_settlement_status"];
          supervisor_notes?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_daily_settlements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          }
        ];
      };
      re_vehicles: {
        Row: {
          id: string;
          branch_id: string;
          plate_number: string;
          capacity_kg: number | null;
          capacity_m3: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          plate_number: string;
          capacity_kg?: number | null;
          capacity_m3?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          plate_number?: string;
          capacity_kg?: number | null;
          capacity_m3?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_vehicles_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          }
        ];
      };
      re_dispatch_manifests: {
        Row: {
          id: string;
          branch_id: string;
          warehouse_id: string;
          vehicle_id: string | null;
          status: Database["public"]["Enums"]["re_manifest_status"];
          manifest_date: string;
          total_weight_kg: number;
          total_volume_m3: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          warehouse_id: string;
          vehicle_id?: string | null;
          status?: Database["public"]["Enums"]["re_manifest_status"];
          manifest_date: string;
          total_weight_kg?: number;
          total_volume_m3?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          warehouse_id?: string;
          vehicle_id?: string | null;
          status?: Database["public"]["Enums"]["re_manifest_status"];
          manifest_date?: string;
          total_weight_kg?: number;
          total_volume_m3?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_dispatch_manifests_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_dispatch_manifests_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "re_warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_dispatch_manifests_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "re_vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      re_manifest_orders: {
        Row: {
          manifest_id: string;
          order_id: string;
          delivery_sequence: number;
          delivery_status: Database["public"]["Enums"]["re_manifest_delivery_status"];
          arrival_time: string | null;
          departure_time: string | null;
        };
        Insert: {
          manifest_id: string;
          order_id: string;
          delivery_sequence?: number;
          delivery_status?: Database["public"]["Enums"]["re_manifest_delivery_status"];
          arrival_time?: string | null;
          departure_time?: string | null;
        };
        Update: {
          manifest_id?: string;
          order_id?: string;
          delivery_sequence?: number;
          delivery_status?: Database["public"]["Enums"]["re_manifest_delivery_status"];
          arrival_time?: string | null;
          departure_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "re_manifest_orders_manifest_id_fkey";
            columns: ["manifest_id"];
            isOneToOne: false;
            referencedRelation: "re_dispatch_manifests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_manifest_orders_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "re_orders";
            referencedColumns: ["id"];
          }
        ];
      };
      re_manifest_personnel: {
        Row: {
          manifest_id: string;
          person_id: string;
          role: Database["public"]["Enums"]["re_personnel_role"];
        };
        Insert: {
          manifest_id: string;
          person_id: string;
          role: Database["public"]["Enums"]["re_personnel_role"];
        };
        Update: {
          manifest_id?: string;
          person_id?: string;
          role?: Database["public"]["Enums"]["re_personnel_role"];
        };
        Relationships: [
          {
            foreignKeyName: "re_manifest_personnel_manifest_id_fkey";
            columns: ["manifest_id"];
            isOneToOne: false;
            referencedRelation: "re_dispatch_manifests";
            referencedColumns: ["id"];
          }
        ];
      };
      re_remission_guides: {
        Row: {
          id: string;
          manifest_id: string;
          branch_id: string;
          serie: string;
          correlativo: string;
          sunat_status: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url: string | null;
          pdf_url: string | null;
          ose_response_code: string | null;
          ose_response_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          manifest_id: string;
          branch_id: string;
          serie: string;
          correlativo: string;
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url?: string | null;
          pdf_url?: string | null;
          ose_response_code?: string | null;
          ose_response_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          manifest_id?: string;
          branch_id?: string;
          serie?: string;
          correlativo?: string;
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"];
          xml_content_url?: string | null;
          pdf_url?: string | null;
          ose_response_code?: string | null;
          ose_response_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "re_remission_guides_manifest_id_fkey";
            columns: ["manifest_id"];
            isOneToOne: false;
            referencedRelation: "re_dispatch_manifests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "re_remission_guides_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "re_branches";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      re_transition_manifest_status: {
        Args: {
          p_manifest_id: string;
          p_to_state: Database["public"]["Enums"]["re_manifest_status"];
          p_user_id: string;
        };
        Returns: string;
      };
      re_manifest_add_order: {
        Args: {
          p_manifest_id: string;
          p_order_id: string;
        };
        Returns: string;
      };
      re_manifest_remove_order: {
        Args: {
          p_manifest_id: string;
          p_order_id: string;
        };
        Returns: string;
      };
      re_generate_gre_for_manifest: {
        Args: {
          p_manifest_id: string;
        };
        Returns: string;
      };
      re_recompute_manifest_totals: {
        Args: {
          p_manifest_id: string;
        };
        Returns: undefined;
      };
      re_transition_order_state: {
        Args: {
          p_order_id: string;
          p_to_state: Database["public"]["Enums"]["re_order_state"];
          p_user_id: string;
          p_returned_items?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      re_movement_type: "IN" | "OUT";
      re_movement_reason:
        | "PURCHASE"
        | "TRANSFER_IN"
        | "SALES_RETURN"
        | "ADJUSTMENT_IN"
        | "INITIAL_STOCK"
        | "SALE"
        | "TRANSFER_OUT"
        | "DAMAGE_EXPIRED"
        | "DAMAGE_BROKEN"
        | "DAMAGE_LOST"
        | "ADJUSTMENT_OUT";
      re_transfer_status: "PENDING" | "IN_TRANSIT" | "CONFIRMED" | "CANCELLED";
      re_order_state: "DRAFT" | "PENDING" | "APPROVED" | "PROGRAMMED" | "EN_ROUTE" | "DELIVERED" | "PARTIAL" | "REJECTED" | "CANCELLED";
      re_payment_status: "PENDING" | "PARTIAL" | "PAID";
      re_doc_type: "FACTURA" | "BOLETA";
      re_sunat_status: "PENDIENTE" | "ENVIADO" | "ACEPTADO" | "RECHAZADO" | "FAILED";
      re_payment_method: "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA";
      re_settlement_status: "PENDING" | "APPROVED" | "DISCREPANCY";
      re_manifest_status: "DRAFT" | "CONFIRMED" | "EN_ROUTE" | "CLOSED";
      re_manifest_delivery_status: "PENDING" | "DELIVERED" | "PARTIAL" | "REJECTED";
      re_personnel_role: "DRIVER" | "ASSISTANT";
    };
  };
}
