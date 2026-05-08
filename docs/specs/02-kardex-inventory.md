# Specification: Kardex / Inventory Movement Module — Sistema de Reparto

**Version**: 1.0  
**Date**: 2026-05-06  
**Status**: DRAFT  
**RFC Keywords**: MUST, SHALL, SHOULD, MAY (per RFC 2119)  
**Extends**: `01-core-domain-model.md` (Module 2 — Inventory)  
**Engram**: sdd/reparto/core-domain-model/spec-kardex (#198)  
**Supersedes**: BR-INV-004, BR-INV-005, BR-INV-006 (movement type taxonomy replaced by type + reason_code model below)

---

## Scope

This specification covers the `inventory_movements` table (Kardex), the `stock_transfers` table, the Weighted Average (Promedio Ponderado) valuation method, all movement trigger rules, and all Kardex-specific scenarios. It does NOT re-specify `inventory_stock`, stock_available generation, or stock reservation rules already defined in the core-domain-model spec.

---

## 1. Structural Rules

**BR-KAR-001**: The `inventory_movements` table MUST be append-only. DELETE and UPDATE operations are PROHIBITED for all database roles, including `service_role` and any admin application role. Enforcement MUST be implemented at the PostgreSQL level via a trigger that raises an exception on any DELETE or UPDATE attempt against `inventory_movements`.

**BR-KAR-002**: Every row in `inventory_movements` MUST carry the following non-nullable fields:
- `id` (UUID, PK, generated)
- `branch_id` (UUID, FK → branches.id, NOT NULL, indexed)
- `warehouse_id` (UUID, FK → warehouses.id, NOT NULL)
- `product_id` (UUID, FK → products.id, NOT NULL)
- `type` (ENUM: `IN` | `OUT`, NOT NULL)
- `reason_code` (ENUM — see catalog in Section 2, NOT NULL)
- `quantity` (DECIMAL(12,4), NOT NULL, CHECK quantity > 0)
- `unit_cost` (DECIMAL(12,4), NOT NULL — captured at moment of movement)
- `reference_id` (UUID, NOT NULL — FK to the originating entity)
- `reference_type` (TEXT, NOT NULL — `'order'`, `'transfer'`, `'adjustment'`, `'purchase'`)
- `user_id` (UUID, FK → auth.users.id, NOT NULL — who executed the movement)
- `movement_date` (DATE, NOT NULL — physical date, MAY differ from created_at)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())

**BR-KAR-003**: The `notes` field (TEXT, nullable) MUST be populated for reason_codes: `DAMAGE_EXPIRED`, `DAMAGE_BROKEN`, `DAMAGE_LOST`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`. A database CHECK constraint or application-layer guard MUST reject any movement with these reason_codes if `notes` is NULL or empty string.

**BR-KAR-004**: The `quantity` field MUST always be stored as a positive decimal regardless of movement direction. The `type` field (IN or OUT) determines the direction. No negative quantities are permitted.

**BR-KAR-005**: A CHECK constraint MUST enforce the valid (type, reason_code) pairings:
- `type = 'IN'` is valid ONLY with: `PURCHASE`, `TRANSFER_IN`, `SALES_RETURN`, `ADJUSTMENT_IN`, `INITIAL_STOCK`
- `type = 'OUT'` is valid ONLY with: `SALE`, `TRANSFER_OUT`, `DAMAGE_EXPIRED`, `DAMAGE_BROKEN`, `DAMAGE_LOST`, `ADJUSTMENT_OUT`

Any pairing not in this set MUST be rejected at the database level.

**BR-KAR-006**: The `branch_id` column MUST be indexed. A composite index on `(branch_id, product_id, movement_date)` SHOULD be created to support Kardex report queries efficiently.

**BR-KAR-007**: The `reference_id` and `reference_type` pair MUST together uniquely identify the originating business entity. No orphaned references are permitted: `reference_id` MUST correspond to an existing row in the table named by `reference_type` at the time of insertion.

**BR-KAR-008**: `movement_date` represents the physical date of the movement (e.g., the actual delivery date or purchase receipt date). It MAY differ from `created_at` only in cases of manual back-dated adjustments, which require admin role and a mandatory note.

---

## 2. reason_code Rules

The `reason_code` enum covers 11 values divided by movement direction.

### 2.1 IN reason_codes

**BR-KAR-009**: `PURCHASE` — Used when goods are received from a supplier. MUST reference a purchase order or reception record via `reference_id` / `reference_type = 'purchase'`. Allowed roles: `admin`, `logistics`. Triggers weighted average recalculation (see Section 3).

**BR-KAR-010**: `TRANSFER_IN` — Used when goods arrive from another branch/warehouse as part of a confirmed stock transfer. MUST reference `reference_id = stock_transfers.id` and `reference_type = 'transfer'`. Allowed roles: `admin`, `logistics`. A `TRANSFER_IN` MUST NOT be created without a corresponding `TRANSFER_OUT` for the same `stock_transfer` record (see Section 5). Triggers weighted average recalculation.

**BR-KAR-011**: `SALES_RETURN` — Used when undelivered goods from a PARTIAL order are physically returned to the warehouse. MUST reference `reference_id = orders.id` and `reference_type = 'order'`. Allowed roles: `driver`, `admin`. `notes` is optional but SHOULD be populated with the return reason. Does NOT trigger weighted average recalculation — cost is inherited from the most recent weighted average cost of the product in that warehouse.

**BR-KAR-012**: `ADJUSTMENT_IN` — Used for upward inventory corrections (e.g., physical count reveals more units than recorded). MUST reference `reference_id = adjustment_records.id` and `reference_type = 'adjustment'`. Allowed roles: `admin`, `supervisor`. `notes` is MANDATORY (BR-KAR-003). Triggers weighted average recalculation.

**BR-KAR-013**: `INITIAL_STOCK` — Used exclusively for the first-time loading of stock for a (branch, warehouse, product) tuple that has no prior movement history. MUST reference `reference_type = 'adjustment'`. Allowed roles: `admin` only. `notes` is optional. Once any movement exists for the (branch, warehouse, product) tuple, a second `INITIAL_STOCK` movement MUST be rejected. Triggers weighted average recalculation.

### 2.2 OUT reason_codes

**BR-KAR-014**: `SALE` — Used when goods are dispatched upon a DELIVERED or PARTIAL order transition. MUST reference `reference_id = orders.id` and `reference_type = 'order'`. Allowed roles: `driver`, `admin` (only via system trigger — application code MUST NOT allow a manual SALE movement). `unit_cost` MUST be the current weighted average cost at the moment the OUT movement is generated.

**BR-KAR-015**: `TRANSFER_OUT` — Used when goods leave the warehouse to be sent to another branch/warehouse. MUST reference `reference_id = stock_transfers.id` and `reference_type = 'transfer'`. Allowed roles: `admin`, `logistics`. The corresponding `TRANSFER_IN` MUST be created atomically in the same database transaction (see BR-KAR-026).

**BR-KAR-016**: `DAMAGE_EXPIRED` — Used when goods are written off due to expiration. Allowed roles: `admin`, `supervisor`. `notes` MANDATORY. `reference_type = 'adjustment'`.

**BR-KAR-017**: `DAMAGE_BROKEN` — Used when goods are written off due to physical breakage. Allowed roles: `admin`, `supervisor`. `notes` MANDATORY. `reference_type = 'adjustment'`.

**BR-KAR-018**: `DAMAGE_LOST` — Used when goods are written off due to loss (e.g., theft, unexplained shortage). Allowed roles: `admin`, `supervisor`. `notes` MANDATORY. `reference_type = 'adjustment'`. For quantities above a threshold (configurable per branch, default 10 units), an additional supervisor approval flag SHOULD be required.

**BR-KAR-019**: `ADJUSTMENT_OUT` — Used for downward inventory corrections (e.g., physical count reveals fewer units than recorded). MUST reference `reference_id = adjustment_records.id` and `reference_type = 'adjustment'`. Allowed roles: `admin`, `supervisor`. `notes` MANDATORY (BR-KAR-003).

---

## 3. Valuation Rules (Promedio Ponderado — Weighted Average)

**BR-KAR-020**: The valuation method for this MVP is **Weighted Average (Promedio Ponderado)**. FIFO and LIFO are explicitly out of scope for this version.

**BR-KAR-021**: The weighted average unit cost is maintained per `(branch_id, warehouse_id, product_id)` tuple. It is stored in `inventory_stock.weighted_avg_cost` (DECIMAL(12,4)). This field MUST be updated atomically alongside `stock_actual` on every qualifying IN movement.

**BR-KAR-022**: The weighted average formula on IN movements:

```
new_weighted_avg_cost =
  (current_stock_actual × current_weighted_avg_cost + incoming_quantity × incoming_unit_cost)
  ÷
  (current_stock_actual + incoming_quantity)
```

Where `current_stock_actual` is the value BEFORE the IN movement is applied.

**BR-KAR-023**: Weighted average recalculation MUST be triggered by the following reason_codes: `PURCHASE`, `TRANSFER_IN`, `ADJUSTMENT_IN`, `INITIAL_STOCK`. It MUST NOT be triggered by: `SALES_RETURN`, or any OUT movement.

**BR-KAR-024**: For OUT movements, `unit_cost` MUST be set to the current `inventory_stock.weighted_avg_cost` for the `(branch_id, warehouse_id, product_id)` tuple at the exact moment the OUT movement is inserted. This value MUST be read and locked within the same transaction to prevent race conditions.

**BR-KAR-025**: For `SALES_RETURN` movements, `unit_cost` MUST be set to the current `inventory_stock.weighted_avg_cost` at the moment of insertion (same cost as an OUT movement would use). The weighted average is NOT recalculated because the returned goods are valued at the current average, not at a potentially stale purchase price.

**BR-KAR-026**: If `current_stock_actual` is 0 and an IN movement arrives, the weighted average MUST be set to the incoming unit_cost directly (division by zero is not possible; formula simplifies to `incoming_unit_cost`).

**BR-KAR-027**: The `unit_cost` field on the `inventory_movements` record is immutable historical data. It records what the cost WAS at the time of the movement. It MUST NOT be updated retroactively even if the weighted average changes in subsequent movements.

---

## 4. Kardex Triggers by Event

This section defines exactly which business events generate `inventory_movements` rows and with what values.

**BR-KAR-028**: Order state transition to **APPROVED**: NO `inventory_movements` record is created. Only `inventory_stock.stock_reserved` is incremented by the ordered quantity for each order item. This is consistent with BR-INV-010 in the core spec.

**BR-KAR-029**: Order state transition to **DELIVERED**: For each order item, ONE `inventory_movements` row MUST be created:
- `type = 'OUT'`, `reason_code = 'SALE'`
- `quantity` = the delivered quantity (equals ordered quantity for DELIVERED)
- `unit_cost` = current `weighted_avg_cost` for the (branch, warehouse, product) tuple
- `reference_id` = order.id, `reference_type = 'order'`
- `stock_actual` decreases by `quantity`; `stock_reserved` decreases by `quantity`

**BR-KAR-030**: Order state transition to **PARTIAL**: For each order item, movements are created based on physically delivered vs. physically returned quantities:
- For each item with `delivered_quantity > 0`: ONE `OUT / SALE` movement, `quantity = delivered_quantity`
- For each item with `returned_quantity > 0` (i.e., `ordered_quantity - delivered_quantity`): ONE `IN / SALES_RETURN` movement, `quantity = returned_quantity`
- `stock_reserved` is FULLY released for ALL items in the order regardless of delivered/returned split
- `stock_actual` decreases only by `delivered_quantity` (OUT); increases by `returned_quantity` (IN/SALES_RETURN)
- An item with `delivered_quantity = 0` generates ONLY an `IN / SALES_RETURN` movement (no OUT)

**BR-KAR-031**: Order state transition to **REJECTED**: NO `inventory_movements` record is created. `stock_reserved` is decremented for all items (reservation released).

**BR-KAR-032**: Order state transition to **CANCELLED** (before dispatch, i.e., from APPROVED or PROGRAMMED): NO `inventory_movements` record is created. `stock_reserved` is decremented for all items if the order was in APPROVED or later state.

**BR-KAR-033**: **Purchase receipt**: ONE `IN / PURCHASE` movement per product line in the purchase receipt. `unit_cost` = the supplier invoice unit price for that line. Triggers weighted average recalculation (BR-KAR-022).

**BR-KAR-034**: **Damage write-off**: ONE OUT movement per product with the appropriate `DAMAGE_*` reason_code. `unit_cost` = current `weighted_avg_cost`. `notes` is mandatory.

**BR-KAR-035**: **Manual adjustment (upward)**: ONE `IN / ADJUSTMENT_IN` movement. `unit_cost` MUST be provided explicitly by the admin and MUST be justified in `notes`. Triggers weighted average recalculation.

**BR-KAR-036**: **Manual adjustment (downward)**: ONE `OUT / ADJUSTMENT_OUT` movement. `unit_cost` = current `weighted_avg_cost`. `notes` mandatory.

**BR-KAR-037**: **Initial stock load**: ONE `IN / INITIAL_STOCK` movement per product. `unit_cost` MUST be provided explicitly by the admin (representing the acquisition cost). Triggers weighted average recalculation. Only valid when no prior movements exist for the (branch, warehouse, product) tuple (BR-KAR-013).

---

## 5. Transfer Rules

**BR-KAR-038**: Inter-branch and inter-warehouse transfers MUST use the `stock_transfers` table. Direct inventory movements with `TRANSFER_OUT` or `TRANSFER_IN` without a `stock_transfers` record are PROHIBITED.

**BR-KAR-039**: The `stock_transfers` table MUST carry:
- `id` (UUID, PK)
- `from_branch_id` (UUID, FK → branches.id, NOT NULL)
- `from_warehouse_id` (UUID, FK → warehouses.id, NOT NULL)
- `to_branch_id` (UUID, FK → branches.id, NOT NULL)
- `to_warehouse_id` (UUID, FK → warehouses.id, NOT NULL)
- `product_id` (UUID, FK → products.id, NOT NULL)
- `quantity` (DECIMAL(12,4), NOT NULL, CHECK quantity > 0)
- `unit_cost` (DECIMAL(12,4), NOT NULL — cost at time of TRANSFER_OUT)
- `status` (ENUM: `PENDING` | `IN_TRANSIT` | `CONFIRMED` | `CANCELLED`, NOT NULL)
- `requested_by` (UUID, FK → auth.users.id, NOT NULL)
- `confirmed_by` (UUID, FK → auth.users.id, nullable)
- `notes` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, NOT NULL)

**BR-KAR-040**: The `stock_transfers` lifecycle:
- `PENDING`: transfer requested, no inventory movement yet. `stock_available` on the source is NOT yet reduced.
- `IN_TRANSIT`: transfer approved and dispatched. The `OUT / TRANSFER_OUT` movement is created on the source warehouse. `stock_actual` on source decreases.
- `CONFIRMED`: goods received at destination. The `IN / TRANSFER_IN` movement is created on the destination warehouse. `stock_actual` on destination increases. `weighted_avg_cost` recalculated at destination using the `unit_cost` from the `stock_transfers` record.
- `CANCELLED`: transfer voided before reaching `IN_TRANSIT`. No inventory movements are created. If already `IN_TRANSIT`, cancellation requires a reversal movement (ADJUSTMENT_IN on source) and MUST NOT use the TRANSFER_IN path.

**BR-KAR-041**: The `TRANSFER_OUT` and `TRANSFER_IN` movements are NOT atomic in real time — they are separated by physical transit time. However: a `TRANSFER_IN` MUST reference the same `stock_transfers.id` as its paired `TRANSFER_OUT`. A `TRANSFER_IN` without a prior `TRANSFER_OUT` on the same `stock_transfers` record MUST be rejected.

**BR-KAR-042**: The `unit_cost` on the `IN / TRANSFER_IN` movement MUST equal the `unit_cost` recorded on the `stock_transfers` record (i.e., the cost at the time of dispatch). It MUST NOT be re-derived from the destination's current weighted average. The destination's weighted average is then recalculated using this arriving cost (BR-KAR-022).

**BR-KAR-043**: A `stock_transfer` where `from_branch_id = to_branch_id` is valid (intra-branch, inter-warehouse transfer). The same rules apply.

**BR-KAR-044**: A `stock_transfer` MUST NOT have `from_warehouse_id = to_warehouse_id` when `from_branch_id = to_branch_id`. Such a transfer would be a no-op and MUST be rejected with error code `TRANSFER_SAME_WAREHOUSE`.

**BR-KAR-045**: Allowed roles for transfer operations:
- Request (`PENDING`): `logistics`, `admin`
- Approve/dispatch (`IN_TRANSIT`): `admin`, `supervisor`
- Confirm receipt (`CONFIRMED`): `admin`, `logistics` at destination branch
- Cancel (`CANCELLED`): `admin` only, with mandatory `notes`

---

## 6. Scenarios

**Scenario KAR-01: Initial stock load for a new product**
- Given product "PROD-001" has no inventory record for branch "Lima", warehouse "WH-Lima-01"
- And admin "U-001" initiates an initial stock load of 200 units at unit_cost = 5.00 PEN
- When the system processes the INITIAL_STOCK movement
- Then an `inventory_movements` row SHALL be inserted: type=IN, reason_code=INITIAL_STOCK, quantity=200, unit_cost=5.00, reference_type='adjustment', user_id=U-001
- And `inventory_stock` for (Lima, WH-Lima-01, PROD-001) SHALL be created with stock_actual=200, stock_reserved=0, weighted_avg_cost=5.00
- And a second INITIAL_STOCK movement for the same (branch, warehouse, product) MUST be rejected with error INITIAL_STOCK_ALREADY_EXISTS

**Scenario KAR-02: Purchase entry and weighted average recalculation**
- Given (Lima, WH-Lima-01, PROD-001) has stock_actual=200, weighted_avg_cost=5.00
- When a purchase of 100 units at unit_cost=6.00 PEN is received and recorded
- Then an `inventory_movements` row SHALL be inserted: type=IN, reason_code=PURCHASE, quantity=100, unit_cost=6.00
- And the new weighted_avg_cost SHALL equal (200×5.00 + 100×6.00) / 300 = 1600/300 ≈ 5.3333 PEN
- And `inventory_stock.stock_actual` SHALL become 300
- And `inventory_stock.weighted_avg_cost` SHALL be updated to 5.3333

**Scenario KAR-03: Full delivery — OUT/SALE movement**
- Given order #50 is EN_ROUTE for branch Lima, warehouse WH-Lima-01
- And order #50 has 30 units of PROD-001 reserved
- And (Lima, WH-Lima-01, PROD-001) has stock_actual=300, stock_reserved=30, weighted_avg_cost=5.3333
- When driver marks order #50 as DELIVERED
- Then one `inventory_movements` row SHALL be inserted: type=OUT, reason_code=SALE, quantity=30, unit_cost=5.3333, reference_id=order#50, reference_type='order'
- And stock_actual SHALL become 270
- And stock_reserved SHALL become 0
- And weighted_avg_cost SHALL remain 5.3333 (OUT movements do not recalculate)
- And stock_available (generated) SHALL equal 270

**Scenario KAR-04: Partial delivery — OUT/SALE + IN/SALES_RETURN**
- Given order #51 is EN_ROUTE for Lima, WH-Lima-01
- And order #51 has 10 units of PROD-001 and 5 units of PROD-002 reserved
- And (Lima, WH-Lima-01, PROD-001) stock_actual=270, stock_reserved=10, weighted_avg_cost=5.3333
- And (Lima, WH-Lima-01, PROD-002) stock_actual=50, stock_reserved=5, weighted_avg_cost=8.00
- When driver submits PARTIAL: 7 units of PROD-001 delivered, 0 units of PROD-002 delivered
- Then the following `inventory_movements` rows SHALL be inserted:
  - type=OUT, reason_code=SALE, product=PROD-001, quantity=7, unit_cost=5.3333, reference_id=order#51
  - type=IN, reason_code=SALES_RETURN, product=PROD-001, quantity=3, unit_cost=5.3333, reference_id=order#51
  - type=IN, reason_code=SALES_RETURN, product=PROD-002, quantity=5, unit_cost=8.00, reference_id=order#51
- And PROD-001: stock_actual after OUT(7)=263, then IN(3)=266; stock_reserved fully released=0
- And PROD-002: stock_actual=50 (no OUT) + 5 (IN SALES_RETURN)=55; stock_reserved=0
- And weighted_avg_cost for PROD-001 SHALL remain 5.3333 (SALES_RETURN does not recalculate)
- And weighted_avg_cost for PROD-002 SHALL remain 8.00 (SALES_RETURN does not recalculate)

**Scenario KAR-05: Order rejection — no Kardex movement**
- Given order #52 is EN_ROUTE with 20 units of PROD-001 reserved
- And (Lima, WH-Lima-01, PROD-001) stock_actual=266, stock_reserved=20
- When driver marks order #52 as REJECTED
- Then NO `inventory_movements` row SHALL be created
- And stock_reserved SHALL decrease by 20 (becomes 0)
- And stock_actual SHALL remain 266

**Scenario KAR-06: Order cancellation before dispatch — no Kardex movement**
- Given order #53 is in APPROVED state with 15 units of PROD-001 reserved
- And (Lima, WH-Lima-01, PROD-001) stock_actual=266, stock_reserved=15
- When admin cancels order #53
- Then NO `inventory_movements` row SHALL be created
- And stock_reserved SHALL decrease by 15
- And stock_actual SHALL remain 266

**Scenario KAR-07: Damage write-off without notes — rejected**
- Given (Lima, WH-Lima-01, PROD-001) has stock_actual=266, weighted_avg_cost=5.3333
- When admin attempts to record DAMAGE_EXPIRED for 10 units WITHOUT providing notes
- Then the system MUST reject the movement with error code NOTES_REQUIRED_FOR_REASON_CODE
- And NO `inventory_movements` row SHALL be created
- And stock_actual SHALL remain 266

**Scenario KAR-08: Damage write-off with mandatory notes**
- Given (Lima, WH-Lima-01, PROD-001) stock_actual=266, weighted_avg_cost=5.3333
- When admin records DAMAGE_EXPIRED for 10 units with notes="Producto vencido lote L-2024-03, conteo físico 2026-05-06"
- Then an `inventory_movements` row SHALL be inserted: type=OUT, reason_code=DAMAGE_EXPIRED, quantity=10, unit_cost=5.3333, notes="Producto vencido...", user_id=admin
- And stock_actual SHALL become 256
- And weighted_avg_cost SHALL remain 5.3333

**Scenario KAR-09: Inter-branch transfer — full lifecycle**
- Given (Lima, WH-Lima-01, PROD-001) stock_actual=256, weighted_avg_cost=5.3333
- And (Cajamarca, WH-Caj-01, PROD-001) stock_actual=0, weighted_avg_cost=0
- When logistics creates a stock_transfer: from Lima/WH-Lima-01 → Cajamarca/WH-Caj-01, quantity=50
- And admin approves dispatch (transition to IN_TRANSIT)
- Then ONE `inventory_movements` row SHALL be inserted on Lima: type=OUT, reason_code=TRANSFER_OUT, quantity=50, unit_cost=5.3333
- And Lima stock_actual SHALL become 206; weighted_avg_cost unchanged
- When destination logistics confirms receipt (transition to CONFIRMED)
- Then ONE `inventory_movements` row SHALL be inserted on Cajamarca: type=IN, reason_code=TRANSFER_IN, quantity=50, unit_cost=5.3333
- And Cajamarca stock_actual SHALL become 50
- And Cajamarca weighted_avg_cost = (0×0 + 50×5.3333) / 50 = 5.3333 (BR-KAR-026 for zero-stock case)

**Scenario KAR-10: Weighted average recalculation after mixed-cost purchase**
- Given (Lima, WH-Lima-01, PROD-001) stock_actual=206, weighted_avg_cost=5.3333
- When a purchase of 50 units arrives with unit_cost=7.00 PEN
- Then new weighted_avg_cost = (206×5.3333 + 50×7.00) / 256 = (1,086.66 + 350.00) / 256 ≈ 5.6120 PEN
- And stock_actual SHALL become 256
- And the unit_cost on the movement (7.00) SHALL differ from weighted_avg_cost (5.6120) — this is correct and expected

**Scenario KAR-11: ADJUSTMENT_IN with mandatory notes and recalculation**
- Given (Lima, WH-Lima-01, PROD-001) stock_actual=256, weighted_avg_cost=5.6120
- And physical count reveals 261 units (5 units over)
- When supervisor records ADJUSTMENT_IN of 5 units at unit_cost=5.6120, notes="Reconteo físico semana 19 — diferencia positiva detectada"
- Then an `inventory_movements` row SHALL be inserted: type=IN, reason_code=ADJUSTMENT_IN, quantity=5, unit_cost=5.6120
- And new weighted_avg_cost = (256×5.6120 + 5×5.6120) / 261 = 5.6120 (unchanged when same cost)
- And stock_actual SHALL become 261

**Scenario KAR-12: ADJUSTMENT_OUT with mandatory notes**
- Given (Lima, WH-Lima-01, PROD-001) stock_actual=261, weighted_avg_cost=5.6120
- And physical count reveals 258 units (3 units under)
- When supervisor records ADJUSTMENT_OUT of 3 units, notes="Reconteo físico semana 19 — diferencia negativa, posible merma"
- Then an `inventory_movements` row SHALL be inserted: type=OUT, reason_code=ADJUSTMENT_OUT, quantity=3, unit_cost=5.6120
- And stock_actual SHALL become 258
- And weighted_avg_cost SHALL remain 5.6120 (OUT movements do not recalculate)

**Scenario KAR-13: Immutability enforcement — UPDATE blocked**
- Given `inventory_movements` row #M-001 exists: type=OUT, reason_code=SALE, quantity=30
- When any database role attempts: UPDATE inventory_movements SET quantity=25 WHERE id='M-001'
- Then the PostgreSQL trigger MUST raise an exception: "inventory_movements is append-only: UPDATE is prohibited"
- And the row SHALL remain unchanged

**Scenario KAR-14: Immutability enforcement — DELETE blocked**
- Given `inventory_movements` row #M-001 exists
- When any database role (including service_role) attempts to DELETE the row
- Then the PostgreSQL trigger MUST raise an exception: "inventory_movements is append-only: DELETE is prohibited"
- And the row SHALL remain in the table

**Scenario KAR-15: Transfer atomicity — TRANSFER_IN without TRANSFER_OUT rejected**
- Given no stock_transfer record exists with id='ST-999'
- When logistics attempts to insert a TRANSFER_IN movement with reference_id='ST-999'
- Then the system MUST reject with error code TRANSFER_REFERENCE_NOT_FOUND
- Given stock_transfer 'ST-888' exists with status=PENDING (no TRANSFER_OUT yet)
- When logistics attempts to insert a TRANSFER_IN for 'ST-888'
- Then the system MUST reject with error code TRANSFER_OUT_NOT_EXECUTED

**Scenario KAR-16: Transfer cancellation in PENDING state**
- Given stock_transfer 'ST-100' is in PENDING status (no movements created)
- When admin cancels 'ST-100' with notes="Cliente destino canceló el pedido"
- Then stock_transfer status SHALL become CANCELLED
- And NO `inventory_movements` row SHALL be created
- And stock_actual on source and destination SHALL remain unchanged

**Scenario KAR-17: Duplicate INITIAL_STOCK rejected**
- Given (Lima, WH-Lima-01, PROD-001) already has an INITIAL_STOCK movement in its history
- When admin attempts a second INITIAL_STOCK movement for the same (branch, warehouse, product)
- Then the system MUST reject with error code INITIAL_STOCK_ALREADY_EXISTS

---

## 7. Relationship to core-domain-model spec

The following rules in the core-domain-model spec (Module 2 — Inventory) are superseded or refined by this Kardex spec:

| Core Spec Rule | Status | Kardex Replacement |
|---|---|---|
| BR-INV-004 | Superseded | BR-KAR-001 (append-only enforced at DB level) |
| BR-INV-005 | Superseded | BR-KAR-002 (full field list with types) |
| BR-INV-006 | Superseded | BR-KAR-005 + Section 2 (type+reason_code model) |
| BR-INV-007 | Extended | Confirmed: stock_available check applies before any OUT movement |
| BR-INV-008 | Extended | BR-KAR-003 (notes mandatory for ADJUSTMENT_* and DAMAGE_*) |
| BR-INV-009 | Extended | BR-KAR-011 (SALES_RETURN rules with cost inheritance) |

All other BR-INV-* rules remain valid as stated in the core-domain-model spec.

---

## 8. Open Questions

None. All design decisions for this module have been confirmed by the product owner prior to spec authoring.
