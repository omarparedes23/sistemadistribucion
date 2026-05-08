# Specification: Pricing Module (Módulo de Precios, Descuentos y Bonificaciones)

**Version**: 1.0.0  
**Date**: 2026-05-06  
**Status**: DRAFT  
**RFC Keywords**: MUST, SHALL, SHOULD, MAY (per RFC 2119)  
**Project**: Sistema de Reparto — Peruvian FMCG Distribution  
**Engram**: sdd/reparto/core-domain-model/spec-pricing (#227)  
**Currency**: All prices in PEN (Peruvian Sol). All prices exclude IGV unless stated otherwise.  
**Compliance**: SUNAT electronic invoicing (UBL 2.1 / PE extension)

---

## 1. Price List Management Rules

### BR-PRC-010 — Price List Belongs to One Branch
A `price_lists` record MUST be associated with exactly one `branch_id`. A price list SHALL NOT be shared across branches.

### BR-PRC-011 — At Most One Default Price List Per Branch
At any point in time, at most one `price_lists` record per branch MAY have `is_default = true`. The system MUST enforce this invariant. If a second price list is set as default for the same branch, the system MUST atomically set `is_default = false` on the previously-default price list within the same database transaction before setting `is_default = true` on the new one. Non-atomic updates to `is_default` are NOT permitted.

### BR-PRC-012 — Default Price List Must Be Active
A `price_lists` record with `is_default = true` MUST also have `active = true`. Setting `is_default = true` on an inactive price list is NOT allowed and MUST be rejected with error `PRICE_LIST_INACTIVE`.

### BR-PRC-013 — Price List Validity Window
A `price_lists` record with a non-null `valid_until` is valid only when: `valid_from <= today <= valid_until`. A null `valid_until` means the list is indefinitely valid from `valid_from` onward. The system MUST NOT use a price list whose `valid_from` is in the future or whose `valid_until` is in the past, even if `active = true`.

### BR-PRC-014 — Price List Deactivation
When `active` is set to `false` on a price list that is currently `is_default = true`, the system MUST simultaneously set `is_default = false` in the same transaction. The branch is left without a default price list until a new one is explicitly designated; orders that cannot resolve a price MUST be rejected with `NO_PRICE_FOUND`.

### BR-PRC-015 — price_list_items Uniqueness
A product MUST appear at most once within a given price list. The `(price_list_id, product_id)` pair MUST be unique. Attempts to insert a duplicate SHALL be rejected.

### BR-PRC-016 — Customer Price Assignment Validity
A `customer_price_assignments` record is active when: `assigned_from <= today AND (assigned_until IS NULL OR assigned_until >= today)`. A customer assignment MUST reference a `price_list_id` whose associated `price_lists` record is `active = true` at the time of assignment creation. Assigning a customer to an inactive price list MUST be rejected with error `PRICE_LIST_INACTIVE`.

### BR-PRC-017 — One Active Assignment Per Customer-Branch
At any point in time, a given `(customer_id, branch_id)` pair SHOULD have at most one active `customer_price_assignments` record. If overlapping assignments exist, the system MUST use the one with the latest `assigned_from` date. The system SHOULD warn operators when a new assignment would overlap an existing active assignment.

---

## 2. Price Resolution Rules

### BR-PRC-018 — Price Resolution Hierarchy
When resolving the unit price for a product on an order item, the system MUST apply the following hierarchy in order:

1. **Customer Assignment**: Find an active `customer_price_assignments` record for `(customer_id, branch_id)` of the order. Use the `price_list_id` from that assignment to look up `price_list_items` for the product.
2. **Branch Default**: If no active customer assignment exists, or if the product is not found in the assigned price list, find the branch's default price list (`price_lists WHERE branch_id = X AND is_default = true AND active = true`) and look up `price_list_items` for the product.
3. **Rejection**: If the product is not found in the default price list either, the system MUST reject the order item with error code `NO_PRICE_FOUND`. The order MUST NOT be saved in a state with unresolved prices.

### BR-PRC-019 — Price Resolution Considers Validity Window
During price resolution, the system MUST verify that the resolved `price_lists` record satisfies the validity window defined in BR-PRC-013. A price list that is outside its validity window MUST be skipped as if it were inactive.

### BR-PRC-020 — Resolved Price Stored at Item Level
Once a price is resolved, the resulting `unit_price` (excluding IGV) MUST be written to `order_items.unit_price` and locked at that point in time. Future changes to the price list MUST NOT retroactively alter `order_items.unit_price`.

### BR-PRC-021 — NO_PRICE_FOUND Error Contract
When `NO_PRICE_FOUND` is raised, the system MUST return:
- Error code: `NO_PRICE_FOUND`
- Context: `{ product_id, customer_id, branch_id, order_id }`
- The order item MUST NOT be persisted. The operator MUST be informed to assign a price list covering this product before proceeding.

---

## 3. Discount Rules

### BR-PRC-022 — Volume Discounts Only in MVP
The only discount type supported in MVP is volume discount (scale by quantity). Financial discounts (e.g., early payment / cash payment percentage) are out of scope for MVP and SHALL be handled in the Collections module.

### BR-PRC-023 — Discount Rule Applicability
A `discount_rules` record applies to an order item when ALL of the following conditions are true:
- `discount_rules.price_list_id` matches the price list used to resolve the item's unit price
- `discount_rules.product_id` matches `order_items.product_id`
- `order_items.quantity >= discount_rules.min_quantity`
- `discount_rules.active = true`
- Current date satisfies: `valid_from <= today AND (valid_until IS NULL OR valid_until >= today)`

### BR-PRC-024 — Multi-Tier Discount Resolution (Best Rate)
If multiple `discount_rules` records match an order item (different `min_quantity` thresholds), the system MUST apply the rule with the HIGHEST `min_quantity` that is still less than or equal to `order_items.quantity`. This represents the most favorable discount for the customer. Ties in `min_quantity` MUST NOT exist; if detected, the system SHOULD log a warning and apply the highest `discount_pct` among tied records.

### BR-PRC-025 — No Discount When Below All Thresholds
If no `discount_rules` record matches (quantity is below all thresholds, or no rules are defined for this product/price list), `order_items.discount_pct` MUST be set to `0` and `order_items.discount_amount` MUST be `0`.

### BR-PRC-026 — SUNAT Discount Declaration (Non-Negotiable)
Discounts MUST be declared explicitly on every invoice line where a discount applies. The SUNAT UBL invoice XML MUST include:
- `ValorUnitario`: the original `unit_price` (excluding IGV), NOT a post-discount price
- `DescuentoLinea`: equal to `order_items.discount_amount` (quantity × unit_price × discount_pct / 100)
- `ValorVenta`: equal to `order_items.line_total` (quantity × unit_price − discount_amount)

Declaring only a reduced price without an explicit `DescuentoLinea` element constitutes subvaluation under SUNAT criteria and MUST NOT be done under any circumstances.

### BR-PRC-027 — Discount Fields Are Computed, Not Manually Set
`order_items.discount_amount` and `order_items.line_total` are database-generated columns (GENERATED ALWAYS AS expressions). Operators MUST NOT directly write to these columns. `discount_pct` is the only discount input written by the application.

---

## 4. Bonification / Promotion Rules

### BR-PRC-028 — Promotion Rules Are Advisory
`promotion_rules` records define eligibility conditions for bonifications. The system MUST evaluate applicable promotions at order creation time and MUST present each triggered promotion as a suggestion to the seller. The seller MUST explicitly confirm or reject each suggestion. The system MUST NOT automatically add bonus items without seller confirmation.

### BR-PRC-029 — QUANTITY_BONUS Trigger
A `promotion_rules` record of type `QUANTITY_BONUS` is triggered when an order item's `product_id` matches `trigger_product_id` AND `order_items.quantity >= trigger_quantity`. The trigger is evaluated per order item.

### BR-PRC-030 — AMOUNT_BONUS Trigger
A `promotion_rules` record of type `AMOUNT_BONUS` is triggered when the order-level subtotal (sum of `line_total` across all non-bonus order items for the order) is greater than or equal to `trigger_amount`. The trigger is evaluated after all non-bonus line items have been added or modified.

### BR-PRC-031 — Promotion Rule Validity Window
A `promotion_rules` record is active only when `active = true` AND current date satisfies: `valid_from <= today AND (valid_until IS NULL OR valid_until >= today)`. Expired or inactive promotion rules MUST NOT be evaluated or suggested.

### BR-PRC-032 — Bonus Item Structure
When a seller confirms a bonus suggestion, the system MUST insert a new `order_items` row with:
- `product_id`: `promotion_rules.bonus_product_id`
- `quantity`: `promotion_rules.bonus_quantity`
- `unit_price`: `0.00`
- `discount_pct`: `0`
- `is_bonus`: `true`

No other `unit_price` value is permitted for a bonus item. Setting `is_bonus = true` with a non-zero `unit_price` MUST be rejected.

### BR-PRC-033 — Bonus Items in Stock Reservation
Bonus items (`is_bonus = true`) MUST consume reserved stock. When an order is APPROVED, `stock_reserved` MUST be incremented by the bonus item's quantity for the corresponding product and branch, identical to the treatment of regular (non-bonus) items.

### BR-PRC-034 — Bonus Items in Kardex
When an order transitions to DELIVERED status, a Kardex movement of type `OUT / SALE` MUST be generated for each bonus item. The movement value MUST use `weighted_avg_cost` for the product (not the invoice price of 0). This ensures inventory valuation integrity: the goods have real cost even though the customer pays nothing.

### BR-PRC-035 — Bonus Items in Manifest
Bonus items MUST appear in the physical delivery manifest. They represent real goods leaving the warehouse and MUST be counted and verified at dispatch.

### BR-PRC-036 — Bonus Items in SUNAT Invoice (Transferencia Gratuita)
Bonus items MUST appear as separate line items on the SUNAT electronic invoice with:
- `PrecioUnitario`: `0.00`
- `ValorVenta`: `0.00`
- `indicadorTransferenciaGratuita`: `true`

Omitting bonus items from the invoice or including them as a note rather than a line item is NOT compliant with SUNAT regulations for transferencias gratuitas.

---

## 5. Order Item Price Rules

### BR-PRC-037 — unit_price Set at Item Creation
`order_items.unit_price` MUST be set by the price resolution process (Section 2) at the moment the item is created or a quantity modification triggers re-evaluation. The price MUST NOT be manually overridden by operators in the standard order flow.

### BR-PRC-038 — discount_pct Set at Item Creation/Modification
`order_items.discount_pct` MUST be resolved from `discount_rules` (Section 3) at the moment the item is created, and MUST be re-evaluated whenever `order_items.quantity` changes. If a quantity change moves the item into a different discount tier, `discount_pct` MUST be updated accordingly.

### BR-PRC-039 — Generated Columns Are Immutable to Application Logic
`order_items.discount_amount` (GENERATED AS `quantity * unit_price * discount_pct / 100`) and `order_items.line_total` (GENERATED AS `quantity * unit_price - discount_amount`) are database-managed. Application code MUST NOT attempt to write these columns directly.

### BR-PRC-040 — IGV Not Stored in unit_price
`order_items.unit_price` stores the price EXCLUDING IGV (18%). IGV MUST be computed at invoice generation time and MUST NOT be embedded in stored unit prices. This maintains a clean separation between net price and tax.

---

## 6. Historical Price Protection Rules

### BR-PRC-041 — Delivered Order Items Are Immutable
Once an order reaches DELIVERED status, no field of any of its `order_items` rows (including `unit_price`, `discount_pct`, `quantity`) MAY be modified. Any system component that would cause such a modification MUST be blocked by a database-level constraint or trigger.

### BR-PRC-042 — Price List Changes Do Not Affect Past Orders
Updating `price_list_items.unit_price` MUST NOT retroactively update `order_items.unit_price` on any existing order. The price stored in `order_items` at creation time is the contract price for that transaction.

### BR-PRC-043 — Price List Deactivation Does Not Affect Past Orders
Deactivating or deleting a price list MUST NOT alter `order_items` records that were created using that price list. The historical data remains intact for accounting, auditing, and SUNAT compliance purposes.

### BR-PRC-044 — Discount Rule Changes Do Not Affect Past Orders
Modifying or deactivating a `discount_rules` record MUST NOT retroactively alter `order_items.discount_pct` on any order that was already approved or delivered. Only orders in DRAFT or PENDING status where an item is re-evaluated (due to quantity change) are subject to re-applying current discount rules.

---

## 7. Scenarios

### SCN-PRC-001 — Price Resolution via Customer-Assigned Price List

**Given** customer C is assigned price list PL-A for branch B (active, within validity window)
**And** PL-A contains product P at unit_price = 15.00 PEN
**And** branch B also has a default price list PL-DEFAULT with product P at unit_price = 18.00 PEN
**When** a new order item is created for product P on an order belonging to customer C at branch B
**Then** `order_items.unit_price` MUST be set to 15.00 (customer-assigned list takes precedence)
**And** the default price list MUST NOT be consulted

---

### SCN-PRC-002 — Fallback to Branch Default Price List

**Given** customer C has no active `customer_price_assignments` for branch B
**And** branch B has a default price list PL-DEFAULT (active, within validity window)
**And** PL-DEFAULT contains product P at unit_price = 18.00 PEN
**When** a new order item is created for product P on an order belonging to customer C at branch B
**Then** `order_items.unit_price` MUST be set to 18.00 (branch default)

---

### SCN-PRC-003 — Fallback When Product Not in Assigned List

**Given** customer C is assigned price list PL-A for branch B
**And** PL-A does NOT contain product P
**And** branch B's default price list PL-DEFAULT contains product P at unit_price = 20.00 PEN
**When** a new order item is created for product P
**Then** the system MUST fall back to PL-DEFAULT
**And** `order_items.unit_price` MUST be set to 20.00

---

### SCN-PRC-004 — NO_PRICE_FOUND Error

**Given** customer C is assigned price list PL-A for branch B
**And** PL-A does NOT contain product P
**And** branch B's default price list PL-DEFAULT does NOT contain product P
**When** a new order item is attempted for product P
**Then** the system MUST reject the operation with error code `NO_PRICE_FOUND`
**And** `{ product_id: P, customer_id: C, branch_id: B }` MUST be included in the error context
**And** no `order_items` row SHALL be persisted

---

### SCN-PRC-005 — Volume Discount Single Tier Applied

**Given** a discount rule DR-1: price_list_id = PL-A, product = P, min_quantity = 6, discount_pct = 10, active = true, valid today
**And** product P is in PL-A at unit_price = 100.00
**When** an order item is created with quantity = 10 for product P on an order using PL-A
**Then** `order_items.discount_pct` MUST be 10
**And** `order_items.discount_amount` MUST be 10 × 100 × 10 / 100 = 100.00
**And** `order_items.line_total` MUST be 10 × 100 − 100 = 900.00

---

### SCN-PRC-006 — Multi-Tier Discount: Best Rate Applied

**Given** two discount rules exist for product P on price list PL-A:
  - DR-1: min_quantity = 6, discount_pct = 5
  - DR-2: min_quantity = 12, discount_pct = 10
**When** an order item is created with quantity = 15
**Then** both DR-1 and DR-2 match (15 >= 6 and 15 >= 12)
**And** the system MUST select DR-2 (highest eligible min_quantity)
**And** `order_items.discount_pct` MUST be 10

---

### SCN-PRC-007 — No Discount When Below All Thresholds

**Given** a discount rule DR-1: product P, min_quantity = 6, discount_pct = 5
**When** an order item is created with quantity = 4 (below threshold)
**Then** no discount rule matches
**And** `order_items.discount_pct` MUST be 0
**And** `order_items.discount_amount` MUST be 0
**And** `order_items.line_total` MUST equal quantity × unit_price

---

### SCN-PRC-008 — SUNAT Discount Line Declaration

**Given** an order item with unit_price = 100.00, quantity = 10, discount_pct = 10
**And** discount_amount = 100.00 (generated), line_total = 900.00 (generated)
**When** the SUNAT electronic invoice XML is generated for this order
**Then** the invoice line MUST include:
  - `ValorUnitario` = 100.00
  - `DescuentoLinea` = 100.00
  - `ValorVenta` = 900.00
**And** the XML MUST NOT declare only 90.00 as ValorUnitario with no DescuentoLinea

---

### SCN-PRC-009 — QUANTITY_BONUS Promotion Suggested and Confirmed

**Given** a promotion rule PR-1: type = QUANTITY_BONUS, trigger_product_id = PROD-A, trigger_quantity = 12, bonus_product_id = PROD-B, bonus_quantity = 1, active = true, valid today
**When** an order item is added with product = PROD-A, quantity = 12
**Then** the system MUST evaluate PR-1 and find it triggered
**And** the system MUST present the seller with a suggestion: "Add 1 unit of PROD-B as bonus?"
**When** the seller confirms the suggestion
**Then** a new `order_items` row MUST be inserted: product_id = PROD-B, quantity = 1, unit_price = 0.00, discount_pct = 0, is_bonus = true

---

### SCN-PRC-010 — AMOUNT_BONUS Promotion Triggered at Order Level

**Given** a promotion rule PR-2: type = AMOUNT_BONUS, trigger_amount = 500.00, bonus_product_id = PROD-C, bonus_quantity = 2, active = true, valid today
**When** all non-bonus order items sum of line_totals reaches 520.00
**Then** the system MUST evaluate PR-2 and find it triggered
**And** the system MUST suggest adding 2 units of PROD-C as bonus to the seller
**When** the seller confirms
**Then** a new `order_items` row is inserted: product_id = PROD-C, quantity = 2, unit_price = 0.00, is_bonus = true

---

### SCN-PRC-011 — Bonus Item Generates Kardex Movement at Cost

**Given** an order contains a bonus item: product = PROD-B, quantity = 1, unit_price = 0.00, is_bonus = true
**And** PROD-B has a current weighted_avg_cost = 8.50 PEN
**When** the order transitions to DELIVERED status
**Then** the system MUST generate a Kardex movement: type = OUT/SALE, product = PROD-B, quantity = 1, unit_cost = 8.50, total_value = 8.50
**And** the Kardex movement value MUST NOT be 0.00 (the invoice price is irrelevant to cost accounting)

---

### SCN-PRC-012 — Bonus Item on Invoice at Price Zero with Transferencia Gratuita Flag

**Given** an order contains a bonus item: product = PROD-B, quantity = 1, unit_price = 0.00, is_bonus = true
**When** the SUNAT electronic invoice XML is generated
**Then** the invoice MUST include a line item for PROD-B with:
  - `PrecioUnitario` = 0.00
  - `ValorVenta` = 0.00
  - `indicadorTransferenciaGratuita` = true
**And** the bonus item MUST NOT be omitted from the XML or represented only as a free-text note

---

### SCN-PRC-013 — Historical Price Protected After Price List Update

**Given** order O was DELIVERED with order_items.unit_price = 15.00 for product P (resolved from PL-A)
**When** the operator updates PL-A's price for product P to 20.00
**Then** order O's `order_items.unit_price` MUST remain 15.00
**And** the price change MUST only affect future order items created after the update

---

### SCN-PRC-014 — Default Price List Swap Is Atomic

**Given** branch B has PL-CURRENT as its default price list (is_default = true)
**When** the operator sets PL-NEW as the new default for branch B
**Then** the system MUST atomically:
  1. Set PL-CURRENT.is_default = false
  2. Set PL-NEW.is_default = true
  within the same database transaction
**And** at no point in time MUST both lists have is_default = true simultaneously
**And** at no point in time MUST neither list have is_default = true during the transition

---

## Appendix A: Error Codes

| Code | Trigger |
|---|---|
| `NO_PRICE_FOUND` | Product not in any reachable price list for the order's branch/customer |
| `PRICE_LIST_INACTIVE` | Attempt to assign customer or set default on an inactive price list |
| `DUPLICATE_PRICE_LIST_ITEM` | Attempt to insert a product already present in a price list |
| `BONUS_NONZERO_PRICE` | Attempt to set unit_price != 0 on a bonus item (is_bonus = true) |
| `DELIVERED_ORDER_IMMUTABLE` | Attempt to modify order_items on a DELIVERED order |

---

## Appendix B: Tables Reference (Normative)

### price_lists
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| branch_id | UUID FK | One branch per list |
| name | TEXT NOT NULL | |
| description | TEXT | |
| is_default | BOOLEAN NOT NULL | At most one true per branch |
| valid_from | DATE NOT NULL | |
| valid_until | DATE | NULL = indefinite |
| active | BOOLEAN NOT NULL DEFAULT true | |
| created_at | TIMESTAMPTZ | |

### price_list_items
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| price_list_id | UUID FK | |
| product_id | UUID FK | |
| unit_price | DECIMAL(12,2) | Excluding IGV |
| currency | CHAR(3) DEFAULT 'PEN' | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| UNIQUE | (price_list_id, product_id) | |

### customer_price_assignments
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| customer_id | UUID FK | |
| branch_id | UUID FK | |
| price_list_id | UUID FK | Must be active |
| assigned_from | DATE NOT NULL | |
| assigned_until | DATE | NULL = indefinite |
| created_at | TIMESTAMPTZ | |

### discount_rules
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| price_list_id | UUID FK | |
| product_id | UUID FK | |
| min_quantity | DECIMAL NOT NULL | Inclusive threshold |
| discount_pct | DECIMAL(5,2) | 0–100 |
| valid_from | DATE NOT NULL | |
| valid_until | DATE | NULL = indefinite |
| active | BOOLEAN NOT NULL DEFAULT true | |

### promotion_rules
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| branch_id | UUID FK | |
| name | TEXT NOT NULL | |
| type | ENUM | QUANTITY_BONUS, AMOUNT_BONUS |
| trigger_product_id | UUID FK | Required for QUANTITY_BONUS |
| trigger_quantity | DECIMAL | Required for QUANTITY_BONUS |
| trigger_amount | DECIMAL | Required for AMOUNT_BONUS |
| bonus_product_id | UUID FK | |
| bonus_quantity | DECIMAL NOT NULL | |
| valid_from | DATE NOT NULL | |
| valid_until | DATE | NULL = indefinite |
| active | BOOLEAN NOT NULL DEFAULT true | |
| created_at | TIMESTAMPTZ | |

### order_items (pricing fields)
| Column | Type | Notes |
|---|---|---|
| unit_price | DECIMAL(12,2) | Resolved at creation, locked |
| discount_pct | DECIMAL(5,2) | From discount_rules, 0 if none |
| discount_amount | DECIMAL GENERATED | quantity × unit_price × discount_pct / 100 |
| is_bonus | BOOLEAN DEFAULT false | Bonus item flag |
| line_total | DECIMAL GENERATED | quantity × unit_price − discount_amount |
