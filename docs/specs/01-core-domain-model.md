# Specification: core-domain-model — Sistema de Reparto

**Version**: 1.0  
**Date**: 2026-05-06  
**Status**: DRAFT  
**RFC Keywords**: MUST, SHALL, SHOULD, MAY (per RFC 2119)  
**Engram**: sdd/reparto/core-domain-model/spec (#195)

> **Note**: Module 2 (Inventory/Kardex) is extended by `02-kardex-inventory.md`.  
> Module 6 (Collections) is extended by `05-collections.md`.  
> Module 7 (Distribution/Manifests) is superseded by `03-manifest.md`.  
> Module 8 (SUNAT) is superseded by `04-sunat-fiscal.md`.  
> Module 3 (Pricing) is extended by `06-pricing.md`.

---

## Module 1: Core Masters

### 1.1 Business Rules

**BR-CM-001**: The system SHALL support a single legal company entity with multiple operational branches.

**BR-CM-002**: A branch SHALL represent an independent operational unit (e.g., Lima, Cajamarca) scoped to a geographic region.

**BR-CM-003**: The product catalog (products, brands, categories) is global. Products MUST NOT carry a branch_id. All branches share the same catalog.

**BR-CM-004**: A product MUST belong to exactly one brand. A brand MUST belong to exactly one category.

**BR-CM-005**: Every product MUST have: SKU (unique, immutable after first transaction), name, unit_of_measure, and active status flag.

**BR-CM-006**: A branch MUST be associated with exactly one company. A branch MUST have: name, region, and at least one warehouse.

**BR-CM-007**: A warehouse MUST be associated with exactly one branch. A branch MAY have multiple warehouses.

**BR-CM-008**: Deactivating a product SHOULD prevent it from appearing in new orders but MUST NOT delete historical records.

**BR-CM-009**: SKUs MUST be globally unique across the entire catalog regardless of branch.

### 1.2 Scenarios

**Scenario CM-01: Create a new product**
- Given the catalog has no product with SKU "PROD-001"
- When an admin creates a product with SKU "PROD-001", name "Arroz Extra", brand "Costeño", category "Abarrotes", UOM "kg"
- Then the product SHALL be created with active = true
- And the product SHALL be visible to all branches immediately

**Scenario CM-02: Prevent duplicate SKU**
- Given a product with SKU "PROD-001" already exists
- When any user attempts to create another product with SKU "PROD-001"
- Then the system MUST reject the operation with error code DUPLICATE_SKU
- And no product SHALL be created

**Scenario CM-03: Deactivate a product with open orders**
- Given product "PROD-001" exists in APPROVED orders for branch Lima
- When an admin deactivates product "PROD-001"
- Then the product active flag SHALL be set to false
- And all existing orders referencing "PROD-001" MUST remain intact
- And "PROD-001" MUST NOT appear in new order item selections

**Scenario CM-04: Add a second warehouse to a branch**
- Given branch "Lima" has warehouse "Almacén Central Lima"
- When a logistics admin creates warehouse "Almacén Secundario Lima" assigned to branch "Lima"
- Then both warehouses SHALL be active and independently tracked for inventory

---

## Module 2: Inventory

> Extended and refined by `02-kardex-inventory.md`. The Kardex spec supersedes BR-INV-004, BR-INV-005, BR-INV-006.

### 2.1 Business Rules

**BR-INV-001**: Inventory SHALL be tracked per (branch, warehouse, product) tuple. No global inventory aggregation is exposed to business operations.

**BR-INV-002**: The `inventory_stock` table MUST maintain three fields per (branch_id, warehouse_id, product_id):
  - `stock_actual`: physical count of units present in the warehouse
  - `stock_reserved`: units committed by APPROVED orders not yet delivered
  - `stock_available`: computed as `stock_actual - stock_reserved` (PostgreSQL GENERATED ALWAYS AS STORED)

**BR-INV-003**: `stock_available` MUST be a PostgreSQL generated column. Application code MUST NOT compute or write this field directly.

**BR-INV-004**: All inventory mutations MUST be recorded as rows in `inventory_movements` (the Kardex). Direct updates to `inventory_stock` without a corresponding movement record are PROHIBITED. *(Superseded by BR-KAR-001 — see spec-kardex)*

**BR-INV-005**: An `inventory_movement` MUST carry: branch_id, warehouse_id, product_id, movement_type, quantity (positive integer), reference_id, reference_type, and created_by. *(Superseded by BR-KAR-002 — see spec-kardex)*

**BR-INV-006**: Valid movement_type values: ENTRY, EXIT, RETURN, ADJUSTMENT_POSITIVE, ADJUSTMENT_NEGATIVE, TRANSFER_OUT, TRANSFER_IN. *(Superseded by BR-KAR-005 — type+reason_code model — see spec-kardex)*

**BR-INV-007**: `stock_available` MUST NOT go below zero at any point. Any operation that would cause a negative `stock_available` MUST be rejected before the movement is recorded.

**BR-INV-008**: An inventory ADJUSTMENT MUST require admin or supervisor role and MUST include a justification note.

**BR-INV-009**: RETURN movements (from partial deliveries) MUST reference the originating order_id and MUST increase `stock_actual` for the destination warehouse. *(Extended by BR-KAR-011)*

**BR-INV-010**: Stock reservation (incrementing `stock_reserved`) MUST happen atomically when an order transitions to APPROVED. If the reservation would violate BR-INV-007, the APPROVED transition MUST be blocked.

### 2.2 Scenarios

**Scenario INV-01: Reserve stock on order approval**
- Given product "PROD-001" has stock_actual=100, stock_reserved=20, stock_available=80 in warehouse "WH-Lima-01"
- And order #42 has 30 units of "PROD-001" in state PENDING
- When a supervisor approves order #42
- Then an inventory_movement of type ENTRY to reserved SHALL be recorded with quantity=30, reference_id=42
- And stock_reserved SHALL become 50
- And stock_available SHALL become 50 (generated: 100 - 50)
- And stock_actual SHALL remain 100

**Scenario INV-02: Block approval when stock insufficient**
- Given product "PROD-001" has stock_actual=100, stock_reserved=80, stock_available=20 in warehouse "WH-Lima-01"
- And order #43 has 30 units of "PROD-001" in state PENDING
- When a supervisor attempts to approve order #43
- Then the system MUST reject the transition with error code INSUFFICIENT_STOCK
- And order #43 SHALL remain in PENDING state
- And no inventory_movement SHALL be created

**Scenario INV-03: Deliver order — update stock_actual and release reservation**
- Given order #42 is in state EN_ROUTE with 30 units of "PROD-001" reserved
- And stock_actual=100, stock_reserved=50
- When the driver marks order #42 as DELIVERED
- Then an inventory_movement of type EXIT with quantity=30 SHALL be recorded
- And stock_actual SHALL become 70
- And stock_reserved SHALL become 20
- And stock_available SHALL become 50 (generated: 70 - 20)

**Scenario INV-04: Partial delivery — return undelivered items**
- Given order #44 is EN_ROUTE with 10 units of "PROD-001" and 5 units of "PROD-002"
- And the driver delivers 7 units of "PROD-001" and 0 units of "PROD-002"
- When the driver submits a PARTIAL delivery result
- Then an EXIT movement for 7 units of "PROD-001" SHALL be recorded
- And a RETURN movement for 3 units of "PROD-001" and 5 units of "PROD-002" SHALL be recorded
- And the RETURN movements MUST reference order #44 as reference_id
- And stock_actual for both products SHALL reflect the returned quantities
- And stock_reserved SHALL be fully released for all items in order #44

**Scenario INV-05: Inventory adjustment with justification**
- Given warehouse "WH-Lima-01" shows stock_actual=100 for "PROD-001"
- And a physical count reveals only 95 units exist
- When an admin records an ADJUSTMENT_NEGATIVE of 5 units with note "Conteo físico semana 18"
- Then an inventory_movement of type ADJUSTMENT_NEGATIVE with quantity=5 SHALL be recorded
- And stock_actual SHALL become 95
- And the movement SHALL store the justification note and the admin's user ID

---

## Module 3: Pricing

> Extended by `06-pricing.md` (BR-PRC-010 through BR-PRC-044). The pricing spec supersedes BR-PRC-001 through BR-PRC-008.

### 3.1 Business Rules

**BR-PRC-001**: Price lists SHALL be scoped to a branch. A price list MUST carry: branch_id, name, valid_from date, valid_until date (nullable = indefinite), and active flag.

**BR-PRC-002**: A `price_list_item` MUST reference exactly one price_list and one product. The combination (price_list_id, product_id) MUST be unique within a price list.

**BR-PRC-003**: A customer MAY be assigned to exactly one active price list per branch. This assignment is stored in a `customer_price_assignments` table.

**BR-PRC-004**: When creating an order, the system MUST resolve the unit price for each order item using the following priority:
  1. Active price list assigned to the customer for the order's branch
  2. Default price list for the branch (if no customer-specific assignment)
  3. System MUST reject the order item if no price can be resolved

**BR-PRC-005**: Price list items MUST carry: unit_price (positive decimal), currency (default PEN), and optional discount_pct.

**BR-PRC-006**: Two price lists for the same branch MAY overlap in date range, but a customer MUST NOT have two active simultaneous assignments for the same branch.

**BR-PRC-007**: Historical price on delivered orders MUST be preserved as-captured. Updating a price list MUST NOT retroactively alter delivered order prices.

**BR-PRC-008**: A branch SHOULD have exactly one price list flagged as `is_default = true` at any given time.

### 3.2 Scenarios

**Scenario PRC-01: Resolve customer-specific price**
- Given branch "Lima" has price list "Lista General Lima" (default) with PROD-001 at 10.00 PEN
- And price list "Lista VIP Lima" has PROD-001 at 8.50 PEN
- And customer "C-001" is assigned to "Lista VIP Lima" for branch "Lima"
- When an order is created for customer "C-001" in branch "Lima" with 5 units of "PROD-001"
- Then the order item unit_price SHALL be 8.50 PEN
- And the line total SHALL be 42.50 PEN

**Scenario PRC-02: Fallback to default price list**
- Given branch "Lima" has price list "Lista General Lima" (default) with PROD-001 at 10.00 PEN
- And customer "C-002" has no price list assignment for branch "Lima"
- When an order is created for customer "C-002" in branch "Lima" with 5 units of "PROD-001"
- Then the order item unit_price SHALL be 10.00 PEN

**Scenario PRC-03: Reject order item with no resolvable price**
- Given product "PROD-NEW" exists but has no entry in any price list for branch "Lima"
- When a seller attempts to add "PROD-NEW" to an order for branch "Lima"
- Then the system MUST reject the item with error code NO_PRICE_FOUND
- And the order SHALL not include the item

**Scenario PRC-04: Price list update does not affect past orders**
- Given order #10 was DELIVERED with PROD-001 at unit_price 10.00 PEN
- When the admin updates "Lista General Lima" setting PROD-001 price to 12.00 PEN
- Then order #10 order_items.unit_price SHALL remain 10.00 PEN
- And future orders SHALL resolve PROD-001 at 12.00 PEN

---

## Module 4: Customers & CRM

### 4.1 Business Rules

**BR-CRM-001**: A customer entity represents a business buyer (bodega, minimarket, restaurante) in the Peruvian distribution context.

**BR-CRM-002**: A customer MUST have: ruc_or_dni (unique document number), legal_name, trade_name (optional), phone, and branch_id (primary branch of the customer).

**BR-CRM-003**: A customer MAY have multiple addresses stored in `customer_addresses`. Each address is an independent delivery point.

**BR-CRM-004**: Each `customer_address` MUST have: customer_id, address_line, district, province, department, and PostGIS coordinates (latitude/longitude stored as geometry point).

**BR-CRM-005**: A customer_address MAY be flagged as `is_primary = true`. A customer SHOULD have exactly one primary address.

**BR-CRM-006**: A customer MAY have a `credit_limit` (decimal, nullable). If set, the system SHOULD warn (but MUST NOT block by default) when total outstanding orders exceed the credit limit.

**BR-CRM-007**: A customer MAY be deactivated. A deactivated customer MUST NOT appear in new order creation flows.

**BR-CRM-008**: The `ruc_or_dni` field MUST be validated for format: RUC (11 digits) or DNI (8 digits) per Peruvian SUNAT/RENIEC standards.

**BR-CRM-009**: Customer data SHALL be scoped to a branch for operational purposes, but the same legal entity (same RUC/DNI) MAY appear in multiple branches as separate records.

### 4.2 Scenarios

**Scenario CRM-01: Register a new customer with primary address**
- Given no customer with RUC "20601234567" exists in branch "Lima"
- When an admin registers customer with RUC "20601234567", legal_name "Bodega Los Olivos S.A.C.", and primary address at coordinates (-12.0464, -77.0428)
- Then a customer record SHALL be created with active = true
- And a customer_address record SHALL be created with is_primary = true and PostGIS point geometry
- And the customer SHALL be visible to sellers in branch "Lima"

**Scenario CRM-02: Add secondary delivery address**
- Given customer "C-001" has one primary address
- When an admin adds a second address for customer "C-001"
- Then a second customer_address SHALL be created with is_primary = false
- And the customer SHALL have 2 active addresses
- And the primary address SHALL remain unchanged

**Scenario CRM-03: Validate RUC format**
- Given a registration attempt with document "1234" (4 digits, invalid)
- When the system validates the ruc_or_dni field
- Then the system MUST reject with error code INVALID_DOCUMENT_FORMAT
- And no customer record SHALL be created

**Scenario CRM-04: Credit limit warning**
- Given customer "C-001" has credit_limit = 5000.00 PEN
- And customer "C-001" has APPROVED orders totaling 4800.00 PEN
- When a new order of 400.00 PEN is created for "C-001"
- Then the order SHALL be created successfully
- And the system SHOULD emit a credit_limit_warning notification to the supervisor
- And the order MUST NOT be automatically blocked

---

## Module 5: Orders

### 5.1 Business Rules — Order Creation

**BR-ORD-001**: An order MUST be associated with: branch_id, customer_id, seller_id, sales_route_id, and delivery_address_id (from customer_addresses).

**BR-ORD-002**: An order MUST have at least one order_item at the time it transitions from DRAFT to PENDING.

**BR-ORD-003**: Each order_item MUST carry: product_id, quantity (positive integer), unit_price (captured at order creation time), and line_total (quantity * unit_price).

**BR-ORD-004**: The order total SHALL be the sum of all order_item line_totals.

**BR-ORD-005**: A seller MUST only create and view orders where seller_id = their own user ID (enforced by RLS).

### 5.2 Business Rules — State Machine

**BR-ORD-010**: The valid order states are: DRAFT, PENDING, APPROVED, PROGRAMMED, EN_ROUTE, DELIVERED, PARTIAL, REJECTED, CANCELLED.

**BR-ORD-011**: Valid transitions:
  - DRAFT → PENDING: seller (own orders only)
  - PENDING → APPROVED: admin or supervisor
  - APPROVED → PROGRAMMED: logistics role
  - PROGRAMMED → EN_ROUTE: driver role
  - EN_ROUTE → DELIVERED: driver role
  - EN_ROUTE → PARTIAL: driver role
  - EN_ROUTE → REJECTED: driver role
  - ANY non-terminal state → CANCELLED: admin only

**BR-ORD-012**: Terminal states are: DELIVERED, PARTIAL, REJECTED, CANCELLED. No transitions out of a terminal state are permitted.

**BR-ORD-013**: APPROVED transition guard: `stock_available >= order quantity` for ALL items in the order. This check MUST be atomic.

**BR-ORD-014**: PROGRAMMED transition guard: a valid remission_guide (GRE) in DRAFT or higher status MUST exist for the order.

**BR-ORD-015**: EN_ROUTE transition guard: the associated remission_guide.sunat_status MUST equal 'ACEPTADO'. If sunat_status is not 'ACEPTADO', the EN_ROUTE transition MUST be blocked.

**BR-ORD-016**: DELIVERED transition effects: stock_actual decreases by delivered quantities; stock_reserved decreases by all reserved quantities; an Invoice or Boleta MUST be generated.

**BR-ORD-017**: PARTIAL transition effects (Opción A — confirmed):
  - Undelivered items are CANCELLED — not carried to the next day
  - stock_actual decreases by actually delivered quantities only
  - stock_reserved decreases for ALL items in the order (releases full reservation)
  - RETURN inventory_movements are created for all undelivered quantities
  - An Invoice is generated for the original full order amount
  - A Credit Note (Nota de Crédito) is generated for the undelivered/returned items
  - The customer must create a new order for any undelivered items

**BR-ORD-018**: REJECTED transition effects: stock_reserved decreases for all items (full release); no invoice generated.

**BR-ORD-019**: CANCELLED transition effects: if order was in APPROVED or later state, stock_reserved MUST be released; if comprobantes were issued, they MUST be annulled via SUNAT.

### 5.3 Business Rules — Payment Status

**BR-ORD-020**: Payment status is ORTHOGONAL to order status. It tracks collection progress independently.

**BR-ORD-021**: Payment status enum: PENDING, PARTIAL, PAID.

**BR-ORD-022**: Default payment_status on order creation SHALL be PENDING.

**BR-ORD-023**: Payment status transitions are driven by entries in the `collections` table, not by order state transitions.

**BR-ORD-024**: Valid payment_method values: EFECTIVO, YAPE, TRANSFERENCIA.

### 5.4 Scenarios

**Scenario ORD-01: Create and submit a draft order**
- Given seller "S-001" is logged in for branch "Lima"
- And customer "C-001" exists and is active
- And product "PROD-001" has a resolved price of 10.00 PEN
- When seller "S-001" creates a draft order with 20 units of "PROD-001" and submits to PENDING
- Then order SHALL be created with state = PENDING
- And seller_id SHALL equal "S-001"
- And order total SHALL equal 200.00 PEN
- And payment_status SHALL equal PENDING

**Scenario ORD-02: Approve an order with sufficient stock**
- Given order #50 is in PENDING with 20 units of "PROD-001"
- And stock_available for "PROD-001" in "WH-Lima-01" is 100
- When supervisor approves order #50
- Then order #50 state SHALL become APPROVED
- And stock_reserved SHALL increase by 20
- And an inventory_movement of reservation SHALL be recorded

**Scenario ORD-03: Block EN_ROUTE transition without accepted GRE**
- Given order #50 is in PROGRAMMED state
- And remission_guide for order #50 has sunat_status = 'ENVIADO' (not yet ACEPTADO)
- When a driver attempts to transition order #50 to EN_ROUTE
- Then the system MUST reject the transition with error code GRE_NOT_ACCEPTED
- And order #50 SHALL remain in PROGRAMMED state

**Scenario ORD-04: Full delivery**
- Given order #50 is in EN_ROUTE with 20 units of "PROD-001"
- And remission_guide sunat_status = 'ACEPTADO'
- And stock_actual = 80, stock_reserved = 20
- When driver marks order #50 as DELIVERED
- Then order #50 state SHALL become DELIVERED
- And stock_actual SHALL become 60
- And stock_reserved SHALL become 0
- And an Invoice or Boleta SHALL be generated
- And payment_status SHALL remain PENDING (collection is separate)

**Scenario ORD-05: Partial delivery**
- Given order #51 is EN_ROUTE with 10 units of PROD-001 and 5 units of PROD-002
- And stock_actual: PROD-001=80, PROD-002=30; stock_reserved: PROD-001=10, PROD-002=5
- When driver marks order #51 as PARTIAL with 7 delivered for PROD-001 and 0 for PROD-002
- Then order #51 state SHALL become PARTIAL
- And EXIT movement for 7 units of PROD-001 SHALL be recorded
- And RETURN movement for 3 units of PROD-001 SHALL be recorded
- And RETURN movement for 5 units of PROD-002 SHALL be recorded
- And stock_actual for PROD-001 SHALL decrease by 7, stock_actual for PROD-002 SHALL be unchanged
- And stock_reserved for PROD-001 SHALL decrease by 10 (full release), for PROD-002 by 5
- And an Invoice for the original full order amount SHALL be generated
- And a Credit Note for the undelivered items SHALL be generated

**Scenario ORD-06: Cancel an approved order**
- Given order #52 is in APPROVED state with stock_reserved = 15 units of PROD-001
- When an admin cancels order #52
- Then order #52 state SHALL become CANCELLED
- And stock_reserved SHALL decrease by 15
- And an inventory_movement releasing the reservation SHALL be recorded

**Scenario ORD-07: Seller cannot view another seller's order**
- Given seller "S-002" is logged in
- And order #50 belongs to seller "S-001"
- When "S-002" attempts to read order #50
- Then the system MUST return a not-found or permission-denied response (RLS enforcement)

---

## Module 6: Collections

> Extended and superseded by `05-collections.md` (BR-COL-001 through BR-COL-035).

### 6.1 Business Rules (summary — see spec-collections for full detail)

**BR-COL-001**: A collection (cobro) represents a payment registered by a vendedor-cobrador for one or more orders.

**BR-COL-002**: A `collection` record MUST carry: branch_id, seller_id, customer_id, order_id, amount, payment_method, payment_date, and optional reference_number (for YAPE/TRANSFERENCIA).

**BR-COL-003**: A seller MUST only register collections for orders where seller_id = their own user ID.

**BR-COL-004**: A single order MAY have multiple collection records (installment or partial payments).

**BR-COL-005**: The sum of all collection amounts for an order determines the payment_status on that order: sum=0→PENDING, 0<sum<total→PARTIAL, sum>=total→PAID.

**BR-COL-006**: Collection records are append-only. A registered collection MUST NOT be deleted.

**BR-COL-007**: A collection MAY only be registered for orders in states: DELIVERED or PARTIAL.

**BR-COL-008**: TRANSFERENCIA and YAPE payments SHOULD include a reference_number for audit purposes.

---

## Module 7: Distribution

> Superseded by `03-manifest.md`. The manifest spec replaces BR-DIS-001 through BR-DIS-011 and all DIS scenarios.

*(See `03-manifest.md` for the full manifest lifecycle specification.)*

---

## Module 8: SUNAT/Legal

> Superseded by `04-sunat-fiscal.md`. The SUNAT spec replaces BR-SUN-001 through BR-SUN-042 and all SUN scenarios.

*(See `04-sunat-fiscal.md` for the full fiscal compliance specification.)*

---

## Cross-Cutting Rules

**BR-CC-001**: All operational tables (inventory, orders, price_lists, manifests, collections) MUST include branch_id and it MUST be indexed.

**BR-CC-002**: Row Level Security (RLS) MUST be enabled on all tables containing operational data. Policies MUST enforce branch_id scoping and role-based access.

**BR-CC-003**: RLS roles and their access:
  - `seller`: SELECT/INSERT/UPDATE on own orders (seller_id = auth.uid()), own collections
  - `driver`: SELECT on manifests assigned to them, UPDATE on delivery status
  - `logistics`: SELECT on all APPROVED orders, INSERT/UPDATE on manifests
  - `supervisor`/`admin`: full access within their branch_id

**BR-CC-004**: Timestamps (created_at, updated_at) MUST be present on all tables. updated_at MUST be auto-updated via a PostgreSQL trigger.

**BR-CC-005**: All state machine transitions MUST be validated server-side (PostgreSQL function or Edge Function). Client-submitted state values MUST NOT be trusted directly.

**BR-CC-006**: Supabase Realtime subscriptions SHALL be used for live updates on: order status changes, sunat_status changes, manifest status changes.

**BR-CC-007**: All monetary amounts SHALL be stored as NUMERIC(12,2) in PEN (Peruvian Sol) unless explicitly marked as multi-currency.
