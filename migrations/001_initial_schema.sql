-- ============================================================
-- MIGRATION: 001_initial_schema.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Stack: Supabase (PostgreSQL 15+) + PostGIS
-- Generated from SDD specs: 01-core-domain-model, 02-kardex-inventory,
-- 03-manifest, 04-sunat-fiscal, 05-collections, 06-pricing
-- NOTE: All tables prefixed with re_ (shared DB, multi-project)
-- ============================================================

-- --------------------------------------------------------
-- 0. EXTENSIONS
-- --------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "postgis";       -- geometry(Point) for addresses

-- --------------------------------------------------------
-- 1. CUSTOM TYPES (ENUMs)
-- --------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE re_order_state AS ENUM (
    'DRAFT','PENDING','APPROVED','PROGRAMMED','EN_ROUTE','DELIVERED','PARTIAL','REJECTED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_payment_status AS ENUM ('PENDING','PARTIAL','PAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_movement_type AS ENUM ('IN','OUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_movement_reason AS ENUM (
    'PURCHASE','TRANSFER_IN','SALES_RETURN','ADJUSTMENT_IN','INITIAL_STOCK',
    'SALE','TRANSFER_OUT','DAMAGE_EXPIRED','DAMAGE_BROKEN','DAMAGE_LOST','ADJUSTMENT_OUT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_transfer_status AS ENUM ('PENDING','IN_TRANSIT','CONFIRMED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_manifest_status AS ENUM ('DRAFT','CONFIRMED','EN_ROUTE','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_manifest_delivery_status AS ENUM ('PENDING','DELIVERED','PARTIAL','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_sunat_status AS ENUM ('PENDIENTE','ENVIADO','ACEPTADO','RECHAZADO','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_payment_method AS ENUM ('EFECTIVO','YAPE','PLIN','TRANSFERENCIA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_settlement_status AS ENUM ('PENDING','APPROVED','DISCREPANCY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_personnel_role AS ENUM ('DRIVER','ASSISTANT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_doc_type AS ENUM ('FACTURA','BOLETA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------
-- 2. TRIGGER FUNCTIONS
-- --------------------------------------------------------

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.re_handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Block UPDATE/DELETE on re_inventory_movements (append-only)
CREATE OR REPLACE FUNCTION public.re_prevent_inventory_movements_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 're_inventory_movements is append-only: UPDATE is prohibited';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 're_inventory_movements is append-only: DELETE is prohibited';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Auto-update re_orders.payment_status from re_collection_items
CREATE OR REPLACE FUNCTION public.re_update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total     NUMERIC(12,2);
  v_collected NUMERIC(12,2);
BEGIN
  SELECT COALESCE(o.total, 0), COALESCE(SUM(ci.amount_applied), 0)
  INTO v_total, v_collected
  FROM public.re_orders o
  LEFT JOIN public.re_collection_items ci ON ci.order_id = o.id
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id)
  GROUP BY o.id, o.total;

  UPDATE public.re_orders
  SET payment_status = CASE
    WHEN v_collected <= 0    THEN 'PENDING'::re_payment_status
    WHEN v_collected >= v_total THEN 'PAID'::re_payment_status
    ELSE                          'PARTIAL'::re_payment_status
  END
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 3. CORE MASTERS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  ruc        TEXT NOT NULL UNIQUE,
  address    TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.re_companies(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  region        TEXT NOT NULL,
  address       TEXT,
  gre_serie     TEXT,
  factura_serie TEXT DEFAULT 'F001',
  boleta_serie  TEXT DEFAULT 'B001',
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_warehouses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.re_categories(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS public.re_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  brand_id        UUID NOT NULL REFERENCES public.re_brands(id) ON DELETE RESTRICT,
  unit_of_measure TEXT NOT NULL,
  weight_kg       DECIMAL(12,4) DEFAULT 0,
  volume_m3       DECIMAL(12,4) DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_sales_routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 4. INVENTORY
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_inventory_stock (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  warehouse_id      UUID NOT NULL REFERENCES public.re_warehouses(id) ON DELETE RESTRICT,
  product_id        UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  stock_actual      DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_reserved    DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  stock_available   DECIMAL(12,4) GENERATED ALWAYS AS (stock_actual - stock_reserved) STORED,
  weighted_avg_cost DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (weighted_avg_cost >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_re_inventory_stock_branch_product
  ON public.re_inventory_stock(branch_id, product_id);

CREATE TABLE IF NOT EXISTS public.re_inventory_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  warehouse_id   UUID NOT NULL REFERENCES public.re_warehouses(id) ON DELETE RESTRICT,
  product_id     UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  type           re_movement_type NOT NULL,
  reason_code    re_movement_reason NOT NULL,
  quantity       DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
  unit_cost      DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  reference_id   UUID NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('order','transfer','adjustment','purchase')),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  movement_date  DATE NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_re_reason_notes CHECK (
    reason_code NOT IN ('DAMAGE_EXPIRED','DAMAGE_BROKEN','DAMAGE_LOST','ADJUSTMENT_IN','ADJUSTMENT_OUT')
    OR (notes IS NOT NULL AND notes <> '')
  ),
  CONSTRAINT chk_re_type_reason CHECK (
    (type = 'IN'  AND reason_code IN ('PURCHASE','TRANSFER_IN','SALES_RETURN','ADJUSTMENT_IN','INITIAL_STOCK'))
    OR
    (type = 'OUT' AND reason_code IN ('SALE','TRANSFER_OUT','DAMAGE_EXPIRED','DAMAGE_BROKEN','DAMAGE_LOST','ADJUSTMENT_OUT'))
  )
);

CREATE INDEX IF NOT EXISTS idx_re_inventory_movements_branch_product_date
  ON public.re_inventory_movements(branch_id, product_id, movement_date);
CREATE INDEX IF NOT EXISTS idx_re_inventory_movements_reference
  ON public.re_inventory_movements(reference_id, reference_type);

-- Append-only trigger
CREATE TRIGGER trg_re_inventory_movements_append_only
  BEFORE UPDATE OR DELETE ON public.re_inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.re_prevent_inventory_movements_mutation();

CREATE TABLE IF NOT EXISTS public.re_stock_transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id    UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  from_warehouse_id UUID NOT NULL REFERENCES public.re_warehouses(id) ON DELETE RESTRICT,
  to_branch_id      UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  to_warehouse_id   UUID NOT NULL REFERENCES public.re_warehouses(id) ON DELETE RESTRICT,
  product_id        UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  quantity          DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
  unit_cost         DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  status            re_transfer_status NOT NULL DEFAULT 'PENDING',
  requested_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  confirmed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_re_transfer_different_warehouse CHECK (
    from_branch_id <> to_branch_id OR from_warehouse_id <> to_warehouse_id
  )
);

CREATE TABLE IF NOT EXISTS public.re_adjustment_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  warehouse_id    UUID NOT NULL REFERENCES public.re_warehouses(id) ON DELETE RESTRICT,
  product_id      UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('IN','OUT')),
  quantity        DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
  unit_cost       DECIMAL(12,4),
  notes           TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 5. CRM
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  ruc_or_dni   TEXT NOT NULL,
  legal_name   TEXT NOT NULL,
  trade_name   TEXT,
  phone        TEXT,
  credit_limit DECIMAL(12,2),
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, ruc_or_dni)
);

CREATE TABLE IF NOT EXISTS public.re_customer_addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES public.re_customers(id) ON DELETE CASCADE,
  address_line TEXT NOT NULL,
  district     TEXT NOT NULL,
  province     TEXT NOT NULL,
  department   TEXT NOT NULL,
  coordinates  GEOMETRY(Point, 4326),
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 6. PRICING
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_price_lists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_price_list_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES public.re_price_lists(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  unit_price    DECIMAL(12,2) NOT NULL CHECK (unit_price > 0),
  currency      TEXT NOT NULL DEFAULT 'PEN',
  discount_pct  DECIMAL(5,2) DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(price_list_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.re_customer_price_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES public.re_customers(id) ON DELETE CASCADE,
  branch_id      UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  price_list_id  UUID NOT NULL REFERENCES public.re_price_lists(id) ON DELETE RESTRICT,
  assigned_from  DATE NOT NULL,
  assigned_until DATE,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_discount_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES public.re_price_lists(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  min_quantity  DECIMAL(12,4) NOT NULL CHECK (min_quantity > 0),
  discount_pct  DECIMAL(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 100),
  valid_from    DATE NOT NULL,
  valid_until   DATE,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_promotion_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  min_quantity     DECIMAL(12,4) NOT NULL CHECK (min_quantity > 0),
  bonus_product_id UUID REFERENCES public.re_products(id) ON DELETE RESTRICT,
  bonus_quantity   DECIMAL(12,4) NOT NULL DEFAULT 1 CHECK (bonus_quantity > 0),
  valid_from       DATE NOT NULL,
  valid_until      DATE,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 7. ORDERS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  customer_id         UUID NOT NULL REFERENCES public.re_customers(id) ON DELETE RESTRICT,
  seller_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sales_route_id      UUID REFERENCES public.re_sales_routes(id) ON DELETE SET NULL,
  delivery_address_id UUID NOT NULL REFERENCES public.re_customer_addresses(id) ON DELETE RESTRICT,
  status              re_order_state NOT NULL DEFAULT 'DRAFT',
  payment_status      re_payment_status NOT NULL DEFAULT 'PENDING',
  total               DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_orders_branch_status ON public.re_orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_re_orders_seller        ON public.re_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_re_orders_customer      ON public.re_orders(customer_id);

CREATE TABLE IF NOT EXISTS public.re_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.re_orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  quantity        DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
  unit_price      DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_pct    DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  discount_amount DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price * discount_pct / 100, 2)) STORED,
  line_total      DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price - quantity * unit_price * discount_pct / 100, 2)) STORED,
  is_bonus        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 8. COLLECTIONS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_collections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id            UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  seller_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_id          UUID NOT NULL REFERENCES public.re_customers(id) ON DELETE RESTRICT,
  payment_method       re_payment_method NOT NULL,
  reference_number     TEXT,
  total_collected      DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_collected >= 0),
  collected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  parent_collection_id UUID REFERENCES public.re_collections(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_collection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.re_collections(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES public.re_orders(id) ON DELETE RESTRICT,
  invoice_id    UUID,  -- soft ref to re_invoices (FIFO fallback per spec)
  amount_applied DECIMAL(12,2) NOT NULL CHECK (amount_applied > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_re_collection_items_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.re_collection_items
  FOR EACH ROW
  EXECUTE FUNCTION public.re_update_order_payment_status();

CREATE TABLE IF NOT EXISTS public.re_daily_settlements (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  seller_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  settlement_date          DATE NOT NULL,
  total_expected           DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_collected_physical DECIMAL(12,2) NOT NULL DEFAULT 0,
  difference               DECIMAL(12,2) GENERATED ALWAYS AS (total_collected_physical - total_expected) STORED,
  status                   re_settlement_status NOT NULL DEFAULT 'PENDING',
  supervisor_notes         TEXT,
  approved_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 9. MANIFESTS & VEHICLES
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_vehicles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  plate_number TEXT NOT NULL,
  capacity_kg  DECIMAL(12,2),
  capacity_m3  DECIMAL(12,4),
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, plate_number)
);

CREATE TABLE IF NOT EXISTS public.re_dispatch_manifests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  warehouse_id     UUID NOT NULL REFERENCES public.re_warehouses(id) ON DELETE RESTRICT,
  vehicle_id       UUID NOT NULL REFERENCES public.re_vehicles(id) ON DELETE RESTRICT,
  status           re_manifest_status NOT NULL DEFAULT 'DRAFT',
  manifest_date    DATE NOT NULL,
  total_weight_kg  DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_volume_m3  DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_manifest_orders (
  manifest_id      UUID NOT NULL REFERENCES public.re_dispatch_manifests(id) ON DELETE CASCADE,
  order_id         UUID NOT NULL REFERENCES public.re_orders(id) ON DELETE RESTRICT,
  delivery_sequence INT NOT NULL DEFAULT 0,
  delivery_status  re_manifest_delivery_status NOT NULL DEFAULT 'PENDING',
  arrival_time     TIMESTAMPTZ,
  departure_time   TIMESTAMPTZ,
  PRIMARY KEY (manifest_id, order_id)
);

CREATE TABLE IF NOT EXISTS public.re_manifest_personnel (
  manifest_id UUID NOT NULL REFERENCES public.re_dispatch_manifests(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role        re_personnel_role NOT NULL,
  PRIMARY KEY (manifest_id, person_id)
);

-- --------------------------------------------------------
-- 10. SUNAT / FISCAL
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_remission_guides (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id         UUID NOT NULL REFERENCES public.re_dispatch_manifests(id) ON DELETE RESTRICT,
  branch_id           UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  serie               TEXT NOT NULL,
  correlativo         TEXT NOT NULL,
  sunat_status        re_sunat_status NOT NULL DEFAULT 'PENDIENTE',
  xml_content_url     TEXT,
  pdf_url             TEXT,
  ose_response_code   TEXT,
  ose_response_message TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, serie, correlativo)
);

CREATE TABLE IF NOT EXISTS public.re_invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES public.re_orders(id) ON DELETE RESTRICT,
  branch_id            UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  customer_id          UUID NOT NULL REFERENCES public.re_customers(id) ON DELETE RESTRICT,
  doc_type             re_doc_type NOT NULL,
  serie                TEXT NOT NULL,
  correlativo          TEXT NOT NULL,
  subtotal             DECIMAL(12,2) NOT NULL DEFAULT 0,
  igv_amount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  total                DECIMAL(12,2) NOT NULL DEFAULT 0,
  issue_date           DATE NOT NULL,
  sunat_status         re_sunat_status NOT NULL DEFAULT 'PENDIENTE',
  xml_content_url      TEXT,
  pdf_url              TEXT,
  ose_response_code    TEXT,
  ose_response_message TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, doc_type, serie, correlativo)
);

CREATE TABLE IF NOT EXISTS public.re_invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.re_invoices(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  quantity        DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
  unit_price      DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_pct    DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total      DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_bonus        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_credit_notes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id           UUID NOT NULL REFERENCES public.re_invoices(id) ON DELETE RESTRICT,
  order_id             UUID NOT NULL REFERENCES public.re_orders(id) ON DELETE RESTRICT,
  branch_id            UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  serie                TEXT NOT NULL,
  correlativo          TEXT NOT NULL,
  reason               TEXT NOT NULL,
  subtotal             DECIMAL(12,2) NOT NULL DEFAULT 0,
  igv_amount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  total                DECIMAL(12,2) NOT NULL DEFAULT 0,
  issue_date           DATE NOT NULL,
  sunat_status         re_sunat_status NOT NULL DEFAULT 'PENDIENTE',
  xml_content_url      TEXT,
  pdf_url              TEXT,
  ose_response_code    TEXT,
  ose_response_message TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, serie, correlativo)
);

CREATE TABLE IF NOT EXISTS public.re_credit_note_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.re_credit_notes(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.re_products(id) ON DELETE RESTRICT,
  quantity       DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
  unit_price     DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total     DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 11. updated_at TRIGGERS
-- Tables without updated_at are explicitly excluded:
--   re_inventory_movements (append-only, no updates)
--   re_collections         (no updated_at column)
--   re_collection_items    (no updated_at column)
--   re_manifest_orders     (no updated_at column)
--   re_manifest_personnel  (no updated_at column)
--   re_invoice_items       (no updated_at column)
--   re_credit_note_items   (no updated_at column)
-- Filter: tablename ~ '^re_' to avoid touching other projects' tables
-- --------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename ~ '^re_'
      AND tablename NOT IN (
        're_inventory_movements',
        're_collections',
        're_collection_items',
        're_manifest_orders',
        're_manifest_personnel',
        're_invoice_items',
        're_credit_note_items'
      )
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.re_handle_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- --------------------------------------------------------
-- 12. RLS ENABLEMENT (policies in a separate migration)
-- --------------------------------------------------------

ALTER TABLE public.re_companies                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_branches                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_warehouses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_categories                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_brands                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_products                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_sales_routes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_inventory_stock            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_inventory_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_stock_transfers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_adjustment_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_customers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_customer_addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_price_lists                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_price_list_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_customer_price_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_discount_rules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_promotion_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_orders                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_order_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_collections                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_collection_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_daily_settlements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_vehicles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_dispatch_manifests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_manifest_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_manifest_personnel         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_remission_guides           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_invoices                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_invoice_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_credit_notes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_credit_note_items          ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
