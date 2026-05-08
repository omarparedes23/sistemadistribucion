-- ============================================================
-- MIGRATION: 002_rls_policies.sql
-- Project: Sistema de Reparto (prefix: re_)
-- RLS policies for all re_* tables
-- ============================================================
-- Role model (stored in auth.users.raw_user_meta_data):
--   role       : 'admin' | 'supervisor' | 'seller'
--   branch_id  : UUID of the user's branch
--   company_id : UUID of the user's company
--
-- Helper functions are defined first so policies can reuse them.
-- ============================================================

-- --------------------------------------------------------
-- 0. HELPER FUNCTIONS
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_auth_role()
RETURNS TEXT STABLE LANGUAGE sql AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    (auth.jwt() -> 'app_metadata' ->> 'role')
  );
$$;

CREATE OR REPLACE FUNCTION public.re_auth_branch_id()
RETURNS UUID STABLE LANGUAGE sql AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'branch_id'),
    (auth.jwt() -> 'app_metadata' ->> 'branch_id')
  )::UUID;
$$;

CREATE OR REPLACE FUNCTION public.re_auth_company_id()
RETURNS UUID STABLE LANGUAGE sql AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'company_id'),
    (auth.jwt() -> 'app_metadata' ->> 'company_id')
  )::UUID;
$$;

CREATE OR REPLACE FUNCTION public.re_is_admin()
RETURNS BOOLEAN STABLE LANGUAGE sql AS $$
  SELECT public.re_auth_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.re_is_supervisor_or_above()
RETURNS BOOLEAN STABLE LANGUAGE sql AS $$
  SELECT public.re_auth_role() IN ('admin', 'supervisor');
$$;

-- --------------------------------------------------------
-- 1. re_companies
-- All users of the same company can read.
-- Only admin can write.
-- --------------------------------------------------------

CREATE POLICY re_companies_select ON public.re_companies
  FOR SELECT USING (id = public.re_auth_company_id());

CREATE POLICY re_companies_insert ON public.re_companies
  FOR INSERT WITH CHECK (public.re_is_admin());

CREATE POLICY re_companies_update ON public.re_companies
  FOR UPDATE USING (id = public.re_auth_company_id() AND public.re_is_admin());

CREATE POLICY re_companies_delete ON public.re_companies
  FOR DELETE USING (false); -- never delete companies

-- --------------------------------------------------------
-- 2. re_branches
-- Users see branches of their company.
-- Only admin can write.
-- --------------------------------------------------------

CREATE POLICY re_branches_select ON public.re_branches
  FOR SELECT USING (company_id = public.re_auth_company_id());

CREATE POLICY re_branches_insert ON public.re_branches
  FOR INSERT WITH CHECK (
    company_id = public.re_auth_company_id() AND public.re_is_admin()
  );

CREATE POLICY re_branches_update ON public.re_branches
  FOR UPDATE USING (
    company_id = public.re_auth_company_id() AND public.re_is_admin()
  );

CREATE POLICY re_branches_delete ON public.re_branches
  FOR DELETE USING (false); -- never delete branches

-- --------------------------------------------------------
-- 3. re_warehouses
-- Users see warehouses of their branch.
-- Admin can write.
-- --------------------------------------------------------

CREATE POLICY re_warehouses_select ON public.re_warehouses
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_warehouses_insert ON public.re_warehouses
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id() AND public.re_is_admin()
  );

CREATE POLICY re_warehouses_update ON public.re_warehouses
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id() AND public.re_is_admin()
  );

CREATE POLICY re_warehouses_delete ON public.re_warehouses
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 4. re_categories / re_brands / re_products
-- Read: all authenticated users.
-- Write: admin only (catalog is company-wide).
-- --------------------------------------------------------

CREATE POLICY re_categories_select ON public.re_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY re_categories_insert ON public.re_categories
  FOR INSERT WITH CHECK (public.re_is_admin());

CREATE POLICY re_categories_update ON public.re_categories
  FOR UPDATE USING (public.re_is_admin());

CREATE POLICY re_categories_delete ON public.re_categories
  FOR DELETE USING (false);

--

CREATE POLICY re_brands_select ON public.re_brands
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY re_brands_insert ON public.re_brands
  FOR INSERT WITH CHECK (public.re_is_admin());

CREATE POLICY re_brands_update ON public.re_brands
  FOR UPDATE USING (public.re_is_admin());

CREATE POLICY re_brands_delete ON public.re_brands
  FOR DELETE USING (false);

--

CREATE POLICY re_products_select ON public.re_products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY re_products_insert ON public.re_products
  FOR INSERT WITH CHECK (public.re_is_admin());

CREATE POLICY re_products_update ON public.re_products
  FOR UPDATE USING (public.re_is_admin());

CREATE POLICY re_products_delete ON public.re_products
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 5. re_sales_routes
-- Scoped to branch. Admin writes.
-- --------------------------------------------------------

CREATE POLICY re_sales_routes_select ON public.re_sales_routes
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_sales_routes_insert ON public.re_sales_routes
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id() AND public.re_is_admin()
  );

CREATE POLICY re_sales_routes_update ON public.re_sales_routes
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id() AND public.re_is_admin()
  );

CREATE POLICY re_sales_routes_delete ON public.re_sales_routes
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 6. re_inventory_stock
-- Read: all users of the branch.
-- Write: admin/supervisor (stock adjustments go through movements).
-- --------------------------------------------------------

CREATE POLICY re_inventory_stock_select ON public.re_inventory_stock
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_inventory_stock_insert ON public.re_inventory_stock
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id() AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_inventory_stock_update ON public.re_inventory_stock
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id() AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_inventory_stock_delete ON public.re_inventory_stock
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 7. re_inventory_movements (append-only — no UPDATE/DELETE)
-- Read: supervisor+ sees all branch movements; seller sees own.
-- Insert: any authenticated user of the branch (system-driven).
-- --------------------------------------------------------

CREATE POLICY re_inventory_movements_select ON public.re_inventory_movements
  FOR SELECT USING (
    branch_id = public.re_auth_branch_id()
    AND (
      public.re_is_supervisor_or_above()
      OR user_id = auth.uid()
    )
  );

CREATE POLICY re_inventory_movements_insert ON public.re_inventory_movements
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
  );

-- UPDATE and DELETE are blocked at trigger level (append-only).
-- No policies needed for those operations.

-- --------------------------------------------------------
-- 8. re_stock_transfers
-- Scoped to branch (from or to). Supervisor+ writes.
-- --------------------------------------------------------

CREATE POLICY re_stock_transfers_select ON public.re_stock_transfers
  FOR SELECT USING (
    from_branch_id = public.re_auth_branch_id()
    OR to_branch_id = public.re_auth_branch_id()
  );

CREATE POLICY re_stock_transfers_insert ON public.re_stock_transfers
  FOR INSERT WITH CHECK (
    from_branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_stock_transfers_update ON public.re_stock_transfers
  FOR UPDATE USING (
    (from_branch_id = public.re_auth_branch_id() OR to_branch_id = public.re_auth_branch_id())
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_stock_transfers_delete ON public.re_stock_transfers
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 9. re_adjustment_records
-- Supervisor+ of the branch.
-- --------------------------------------------------------

CREATE POLICY re_adjustment_records_select ON public.re_adjustment_records
  FOR SELECT USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_adjustment_records_insert ON public.re_adjustment_records
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_adjustment_records_update ON public.re_adjustment_records
  FOR UPDATE USING (false); -- adjustments are immutable after creation

CREATE POLICY re_adjustment_records_delete ON public.re_adjustment_records
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 10. re_customers / re_customer_addresses
-- Read: all users of the branch. Write: admin/supervisor.
-- --------------------------------------------------------

CREATE POLICY re_customers_select ON public.re_customers
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_customers_insert ON public.re_customers
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_customers_update ON public.re_customers
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_customers_delete ON public.re_customers
  FOR DELETE USING (false);

--

CREATE POLICY re_customer_addresses_select ON public.re_customer_addresses
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM public.re_customers WHERE branch_id = public.re_auth_branch_id()
    )
  );

CREATE POLICY re_customer_addresses_insert ON public.re_customer_addresses
  FOR INSERT WITH CHECK (
    customer_id IN (
      SELECT id FROM public.re_customers WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_customer_addresses_update ON public.re_customer_addresses
  FOR UPDATE USING (
    customer_id IN (
      SELECT id FROM public.re_customers WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_customer_addresses_delete ON public.re_customer_addresses
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 11. re_price_lists / re_price_list_items /
--     re_customer_price_assignments / re_discount_rules /
--     re_promotion_rules
-- Read: all users of the branch. Write: admin only.
-- --------------------------------------------------------

CREATE POLICY re_price_lists_select ON public.re_price_lists
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_price_lists_insert ON public.re_price_lists
  FOR INSERT WITH CHECK (branch_id = public.re_auth_branch_id() AND public.re_is_admin());

CREATE POLICY re_price_lists_update ON public.re_price_lists
  FOR UPDATE USING (branch_id = public.re_auth_branch_id() AND public.re_is_admin());

CREATE POLICY re_price_lists_delete ON public.re_price_lists
  FOR DELETE USING (false);

--

CREATE POLICY re_price_list_items_select ON public.re_price_list_items
  FOR SELECT USING (
    price_list_id IN (
      SELECT id FROM public.re_price_lists WHERE branch_id = public.re_auth_branch_id()
    )
  );

CREATE POLICY re_price_list_items_insert ON public.re_price_list_items
  FOR INSERT WITH CHECK (
    price_list_id IN (
      SELECT id FROM public.re_price_lists WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_admin()
  );

CREATE POLICY re_price_list_items_update ON public.re_price_list_items
  FOR UPDATE USING (
    price_list_id IN (
      SELECT id FROM public.re_price_lists WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_admin()
  );

CREATE POLICY re_price_list_items_delete ON public.re_price_list_items
  FOR DELETE USING (false);

--

CREATE POLICY re_customer_price_assignments_select ON public.re_customer_price_assignments
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_customer_price_assignments_insert ON public.re_customer_price_assignments
  FOR INSERT WITH CHECK (branch_id = public.re_auth_branch_id() AND public.re_is_admin());

CREATE POLICY re_customer_price_assignments_update ON public.re_customer_price_assignments
  FOR UPDATE USING (branch_id = public.re_auth_branch_id() AND public.re_is_admin());

CREATE POLICY re_customer_price_assignments_delete ON public.re_customer_price_assignments
  FOR DELETE USING (false);

--

CREATE POLICY re_discount_rules_select ON public.re_discount_rules
  FOR SELECT USING (
    price_list_id IN (
      SELECT id FROM public.re_price_lists WHERE branch_id = public.re_auth_branch_id()
    )
  );

CREATE POLICY re_discount_rules_insert ON public.re_discount_rules
  FOR INSERT WITH CHECK (
    price_list_id IN (
      SELECT id FROM public.re_price_lists WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_admin()
  );

CREATE POLICY re_discount_rules_update ON public.re_discount_rules
  FOR UPDATE USING (
    price_list_id IN (
      SELECT id FROM public.re_price_lists WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_admin()
  );

CREATE POLICY re_discount_rules_delete ON public.re_discount_rules
  FOR DELETE USING (false);

--

CREATE POLICY re_promotion_rules_select ON public.re_promotion_rules
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_promotion_rules_insert ON public.re_promotion_rules
  FOR INSERT WITH CHECK (branch_id = public.re_auth_branch_id() AND public.re_is_admin());

CREATE POLICY re_promotion_rules_update ON public.re_promotion_rules
  FOR UPDATE USING (branch_id = public.re_auth_branch_id() AND public.re_is_admin());

CREATE POLICY re_promotion_rules_delete ON public.re_promotion_rules
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 12. re_orders / re_order_items
-- Read: seller sees own orders; supervisor+ sees all branch orders.
-- Insert: any seller of the branch.
-- Update: seller can update own DRAFT orders; supervisor+ can update any.
-- --------------------------------------------------------

CREATE POLICY re_orders_select ON public.re_orders
  FOR SELECT USING (
    branch_id = public.re_auth_branch_id()
    AND (
      public.re_is_supervisor_or_above()
      OR seller_id = auth.uid()
    )
  );

CREATE POLICY re_orders_insert ON public.re_orders
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND seller_id = auth.uid()
  );

CREATE POLICY re_orders_update ON public.re_orders
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND (
      public.re_is_supervisor_or_above()
      OR (seller_id = auth.uid() AND status = 'DRAFT')
    )
  );

CREATE POLICY re_orders_delete ON public.re_orders
  FOR DELETE USING (false); -- orders are never deleted; use CANCELLED state

--

CREATE POLICY re_order_items_select ON public.re_order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.re_orders
      WHERE branch_id = public.re_auth_branch_id()
        AND (public.re_is_supervisor_or_above() OR seller_id = auth.uid())
    )
  );

CREATE POLICY re_order_items_insert ON public.re_order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM public.re_orders
      WHERE branch_id = public.re_auth_branch_id()
        AND seller_id = auth.uid()
        AND status = 'DRAFT'
    )
  );

CREATE POLICY re_order_items_update ON public.re_order_items
  FOR UPDATE USING (
    order_id IN (
      SELECT id FROM public.re_orders
      WHERE branch_id = public.re_auth_branch_id()
        AND (
          public.re_is_supervisor_or_above()
          OR (seller_id = auth.uid() AND status = 'DRAFT')
        )
    )
  );

CREATE POLICY re_order_items_delete ON public.re_order_items
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 13. re_collections / re_collection_items
-- Seller inserts own collections. Supervisor+ sees all.
-- --------------------------------------------------------

CREATE POLICY re_collections_select ON public.re_collections
  FOR SELECT USING (
    branch_id = public.re_auth_branch_id()
    AND (
      public.re_is_supervisor_or_above()
      OR seller_id = auth.uid()
    )
  );

CREATE POLICY re_collections_insert ON public.re_collections
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND (
      seller_id = auth.uid()
      OR public.re_is_supervisor_or_above()
    )
  );

CREATE POLICY re_collections_update ON public.re_collections
  FOR UPDATE USING (false); -- collections are immutable; void via new collection

CREATE POLICY re_collections_delete ON public.re_collections
  FOR DELETE USING (false);

--

CREATE POLICY re_collection_items_select ON public.re_collection_items
  FOR SELECT USING (
    collection_id IN (
      SELECT id FROM public.re_collections
      WHERE branch_id = public.re_auth_branch_id()
        AND (public.re_is_supervisor_or_above() OR seller_id = auth.uid())
    )
  );

CREATE POLICY re_collection_items_insert ON public.re_collection_items
  FOR INSERT WITH CHECK (
    collection_id IN (
      SELECT id FROM public.re_collections
      WHERE branch_id = public.re_auth_branch_id()
        AND (seller_id = auth.uid() OR public.re_is_supervisor_or_above())
    )
  );

CREATE POLICY re_collection_items_update ON public.re_collection_items
  FOR UPDATE USING (false);

CREATE POLICY re_collection_items_delete ON public.re_collection_items
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 14. re_daily_settlements
-- Read: seller sees own; supervisor+ sees all branch.
-- Insert: supervisor+ creates settlements.
-- Update: supervisor+ approves.
-- --------------------------------------------------------

CREATE POLICY re_daily_settlements_select ON public.re_daily_settlements
  FOR SELECT USING (
    branch_id = public.re_auth_branch_id()
    AND (
      public.re_is_supervisor_or_above()
      OR seller_id = auth.uid()
    )
  );

CREATE POLICY re_daily_settlements_insert ON public.re_daily_settlements
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND (
      seller_id = auth.uid()
      OR public.re_is_supervisor_or_above()
    )
  );

CREATE POLICY re_daily_settlements_update ON public.re_daily_settlements
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_daily_settlements_delete ON public.re_daily_settlements
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 15. re_vehicles
-- Read: all branch users. Write: admin.
-- --------------------------------------------------------

CREATE POLICY re_vehicles_select ON public.re_vehicles
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_vehicles_insert ON public.re_vehicles
  FOR INSERT WITH CHECK (branch_id = public.re_auth_branch_id() AND public.re_is_admin());

CREATE POLICY re_vehicles_update ON public.re_vehicles
  FOR UPDATE USING (branch_id = public.re_auth_branch_id() AND public.re_is_admin());

CREATE POLICY re_vehicles_delete ON public.re_vehicles
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- 16. re_dispatch_manifests / re_manifest_orders /
--     re_manifest_personnel
-- Read: all branch users. Write: supervisor+.
-- --------------------------------------------------------

CREATE POLICY re_dispatch_manifests_select ON public.re_dispatch_manifests
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_dispatch_manifests_insert ON public.re_dispatch_manifests
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_dispatch_manifests_update ON public.re_dispatch_manifests
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_dispatch_manifests_delete ON public.re_dispatch_manifests
  FOR DELETE USING (false);

--

CREATE POLICY re_manifest_orders_select ON public.re_manifest_orders
  FOR SELECT USING (
    manifest_id IN (
      SELECT id FROM public.re_dispatch_manifests WHERE branch_id = public.re_auth_branch_id()
    )
  );

CREATE POLICY re_manifest_orders_insert ON public.re_manifest_orders
  FOR INSERT WITH CHECK (
    manifest_id IN (
      SELECT id FROM public.re_dispatch_manifests WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_manifest_orders_update ON public.re_manifest_orders
  FOR UPDATE USING (
    manifest_id IN (
      SELECT id FROM public.re_dispatch_manifests WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_manifest_orders_delete ON public.re_manifest_orders
  FOR DELETE USING (false);

--

CREATE POLICY re_manifest_personnel_select ON public.re_manifest_personnel
  FOR SELECT USING (
    manifest_id IN (
      SELECT id FROM public.re_dispatch_manifests WHERE branch_id = public.re_auth_branch_id()
    )
  );

CREATE POLICY re_manifest_personnel_insert ON public.re_manifest_personnel
  FOR INSERT WITH CHECK (
    manifest_id IN (
      SELECT id FROM public.re_dispatch_manifests WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_manifest_personnel_update ON public.re_manifest_personnel
  FOR UPDATE USING (false); -- reassign via delete+insert

CREATE POLICY re_manifest_personnel_delete ON public.re_manifest_personnel
  FOR DELETE USING (
    manifest_id IN (
      SELECT id FROM public.re_dispatch_manifests WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_supervisor_or_above()
  );

-- --------------------------------------------------------
-- 17. re_remission_guides / re_invoices / re_invoice_items /
--     re_credit_notes / re_credit_note_items
-- Read: all branch users. Write: supervisor+ (system-driven).
-- --------------------------------------------------------

CREATE POLICY re_remission_guides_select ON public.re_remission_guides
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_remission_guides_insert ON public.re_remission_guides
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_remission_guides_update ON public.re_remission_guides
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_remission_guides_delete ON public.re_remission_guides
  FOR DELETE USING (false);

--

CREATE POLICY re_invoices_select ON public.re_invoices
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_invoices_insert ON public.re_invoices
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_invoices_update ON public.re_invoices
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_invoices_delete ON public.re_invoices
  FOR DELETE USING (false);

--

CREATE POLICY re_invoice_items_select ON public.re_invoice_items
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM public.re_invoices WHERE branch_id = public.re_auth_branch_id()
    )
  );

CREATE POLICY re_invoice_items_insert ON public.re_invoice_items
  FOR INSERT WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.re_invoices WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_invoice_items_update ON public.re_invoice_items
  FOR UPDATE USING (false); -- invoice items are immutable

CREATE POLICY re_invoice_items_delete ON public.re_invoice_items
  FOR DELETE USING (false);

--

CREATE POLICY re_credit_notes_select ON public.re_credit_notes
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_credit_notes_insert ON public.re_credit_notes
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_credit_notes_update ON public.re_credit_notes
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_credit_notes_delete ON public.re_credit_notes
  FOR DELETE USING (false);

--

CREATE POLICY re_credit_note_items_select ON public.re_credit_note_items
  FOR SELECT USING (
    credit_note_id IN (
      SELECT id FROM public.re_credit_notes WHERE branch_id = public.re_auth_branch_id()
    )
  );

CREATE POLICY re_credit_note_items_insert ON public.re_credit_note_items
  FOR INSERT WITH CHECK (
    credit_note_id IN (
      SELECT id FROM public.re_credit_notes WHERE branch_id = public.re_auth_branch_id()
    )
    AND public.re_is_supervisor_or_above()
  );

CREATE POLICY re_credit_note_items_update ON public.re_credit_note_items
  FOR UPDATE USING (false);

CREATE POLICY re_credit_note_items_delete ON public.re_credit_note_items
  FOR DELETE USING (false);

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
