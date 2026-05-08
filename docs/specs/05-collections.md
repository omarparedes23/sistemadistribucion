# Specification: Collections and Daily Settlement — Sistema de Reparto

**Version**: 1.1 (updated with confirmed risk decisions)  
**Date**: 2026-05-06  
**Status**: DRAFT  
**RFC Keywords**: MUST, SHALL, SHOULD, MAY (per RFC 2119)  
**Extends**: `01-core-domain-model.md` (Module 6 — Collections)  
**Engram**: sdd/reparto/core-domain-model/spec-collections (#222)  
**Supersedes**: BR-COL-001 through BR-COL-008 in core-domain-model spec

---

## Tables Reference

### collections
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| branch_id | UUID FK | |
| seller_id | UUID FK | |
| customer_id | UUID FK | |
| payment_method | ENUM | EFECTIVO, YAPE, PLIN, TRANSFERENCIA |
| reference_number | TEXT | mandatory for YAPE, PLIN, TRANSFERENCIA |
| total_collected | DECIMAL(12,2) | = SUM of collection_items.amount_applied |
| collected_at | TIMESTAMPTZ | stored UTC |
| parent_collection_id | UUID nullable | for reversals only |
| created_at | TIMESTAMPTZ | |

### collection_items
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| collection_id | UUID FK | |
| order_id | UUID FK | |
| invoice_id | UUID FK | mandatory at registration; FIFO fallback if unselected |
| amount_applied | DECIMAL(12,2) | |

### daily_settlements
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| branch_id | UUID FK | |
| seller_id | UUID FK | |
| settlement_date | DATE | in America/Lima timezone |
| total_expected | DECIMAL | maintained by Postgres trigger |
| total_collected_physical | DECIMAL | supervisor-entered |
| difference | DECIMAL GENERATED | total_collected_physical - total_expected |
| status | ENUM | PENDING, APPROVED, DISCREPANCY |
| supervisor_notes | TEXT | mandatory if DISCREPANCY |
| approved_by | UUID nullable | |
| approved_at | TIMESTAMPTZ nullable | |
| created_at | TIMESTAMPTZ | |

---

## 1. Collection Registration Rules

**BR-COL-001**: Collections MUST only be registered for orders with status DELIVERED or PARTIAL. Any attempt on other order states MUST be rejected with `COLLECTION_INVALID_ORDER_STATE`.

**BR-COL-002**: A seller MUST only register collections for orders where seller_id = auth.uid(). RLS enforces this at the database level.

**BR-COL-003**: If payment_method is YAPE, PLIN, or TRANSFERENCIA, reference_number MUST be non-null and non-empty. Missing reference_number MUST be rejected with `REFERENCE_NUMBER_REQUIRED`.

**BR-COL-004**: `total_collected` on a collections row MUST equal the SUM of all `collection_items.amount_applied` for that collection. This invariant MUST be enforced atomically on insert.

**BR-COL-005**: All timestamps (collected_at, created_at) are stored in UTC. Business-day logic (settlement grouping) uses America/Lima (UTC-5) timezone via Postgres `AT TIME ZONE` conversion.

**BR-COL-006**: Collections registered after a seller has submitted their daily settlement ("Enviar Liquidación") for that calendar day (America/Lima) MUST be assigned to the next open settlement period. The current PENDING settlement MUST NOT accept new entries once submitted.

**BR-COL-007**: Collections are append-only. UPDATE and DELETE are prohibited for all roles including admin.

---

## 2. Collection Item Rules

**BR-COL-008**: Each collection_item MUST reference exactly one order_id.

**BR-COL-009**: `invoice_id` on collection_items is MANDATORY at registration time. The app MUST present the seller with a list of DELIVERED/PARTIAL orders with outstanding balances for the customer. If the seller does not manually select an invoice, the system MUST apply FIFO (oldest invoice first by issue_date).

**BR-COL-010**: `amount_applied` MUST NOT exceed the outstanding balance of the referenced order. Outstanding balance = `orders.total - SUM(prior collection_items.amount_applied for that order_id)`. Violation MUST be rejected with `OVERPAYMENT_NOT_ALLOWED`. No credit balance ("crédito a favor") is supported in MVP.

**BR-COL-011**: A single collection MAY have multiple collection_items, each referencing a different order. This supports one payment covering multiple invoices.

**BR-COL-012**: `SUM(collection_items.amount_applied)` for a collection MUST equal `collections.total_collected`. Any mismatch MUST be rejected.

---

## 3. payment_status Derivation Rules

**BR-COL-013**: `orders.payment_status` is derived exclusively from collection_items. It MUST be recomputed whenever a collection_item is inserted or reversed for that order_id.

**BR-COL-014**: Derivation logic:
- `SUM(amount_applied WHERE order_id = X) = 0` → `PENDING`
- `0 < SUM < orders.total` → `PARTIAL`
- `SUM >= orders.total` → `PAID`

**BR-COL-015**: `orders.payment_status` MUST be updated atomically within the same transaction as the collection_item insert. No eventual-consistency update is permitted.

**BR-COL-016**: payment_status is orthogonal to orders.status. An order can be DELIVERED with payment_status PENDING (e.g., credit client). An order MUST NOT have payment_status PAID if it is not in a terminal status.

---

## 4. Daily Settlement Rules

**BR-COL-017**: Each seller MAY have at most one `daily_settlement` per `(branch_id, seller_id, settlement_date)` where settlement_date is expressed in America/Lima timezone. Duplicate creation MUST be rejected with `SETTLEMENT_ALREADY_EXISTS`.

**BR-COL-018**: `daily_settlement` is created by the seller via "Enviar Liquidación" action. No cron job or automatic creation. This is a conscious end-of-shift action.

**BR-COL-019**: `total_expected` on `daily_settlements` MUST be maintained by a Postgres trigger. The trigger fires on INSERT of a collections row and on INSERT of a reversal collection row. The trigger groups by `(branch_id, seller_id, settlement_date at America/Lima)` and sets `total_expected = SUM(total_collected)` for all non-reversed collections in that group. The frontend MUST NOT compute or submit this value.

**BR-COL-020**: `settlement_date` MUST be stored as the calendar date in America/Lima timezone, not UTC. Formula: `settlement_date = CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima'::date` at the time of "Enviar Liquidación".

**BR-COL-021**: Daily settlement lifecycle:
- `PENDING`: created by seller; supervisor has not yet validated
- `APPROVED`: supervisor has verified physical cash and digital receipts match total_expected; collections for that day frozen
- `DISCREPANCY`: physical count (`total_collected_physical`) ≠ `total_expected`; `supervisor_notes` MANDATORY; collections frozen regardless

**BR-COL-022**: The transition to APPROVED requires supervisor or admin role within the same branch_id.

**BR-COL-023**: If `difference ≠ 0`, status MUST be `DISCREPANCY`. Supervisor MUST enter `supervisor_notes` (minimum 20 characters) explaining the discrepancy. The settlement closes (collections frozen) even with a discrepancy. Resolution (HR/admin action) is out of scope for MVP.

**BR-COL-024**: Once status is APPROVED or DISCREPANCY, all collection and collection_items rows for that `seller_id + settlement_date` MUST be immutable for the seller. Only supervisor or admin role can create reversals against frozen-period collections.

**BR-COL-025**: `total_collected_physical` is entered by the supervisor. It represents the physical cash counted plus verified digital receipts. It is nullable until the settlement is evaluated.

---

## 5. Immutability and Reversal Rules

**BR-COL-026**: `collections` and `collection_items` are append-only tables. UPDATE and DELETE are prohibited at the database level for all roles.

**BR-COL-027**: Corrections are handled exclusively via Full Void reversal. No partial reversals in MVP.

**BR-COL-028**: A reversal collection MUST:
- Have `total_collected` as a negative value equal in magnitude to the original collection's total_collected
- Have `parent_collection_id` pointing to the original `collections.id`
- Have matching `payment_method` as the original
- Be created only by supervisor or admin role
- Include a non-empty `reference_number` field used as the reversal reason note

**BR-COL-029**: A reversal automatically generates reversal collection_items with negative `amount_applied` for each item in the original collection. These MUST be inserted atomically with the reversal header.

**BR-COL-030**: After a Full Void, the net amount for the affected order_ids is zero (original positive + reversal negative = 0). `orders.payment_status` MUST be recomputed accordingly.

**BR-COL-031**: A reversal against a collection in a PENDING settlement (current day) is permitted for supervisor and admin roles. A reversal against a collection in an APPROVED or DISCREPANCY settlement requires admin role only and MUST be logged in `cancellation_audit_log`.

---

## 6. RLS and Role Rules

**BR-COL-032**: `seller` role: INSERT collections and collection_items for their own orders (seller_id = auth.uid()); SELECT their own collections; cannot UPDATE, DELETE, or see other sellers' data.

**BR-COL-033**: `supervisor` role: SELECT all collections and settlements for their branch; INSERT daily_settlements approval (APPROVED/DISCREPANCY); INSERT reversals for PENDING-period collections; cannot create reversals on APPROVED/DISCREPANCY periods (admin only).

**BR-COL-034**: `admin` role: full access within branch_id; only role that can reverse collections in closed (APPROVED/DISCREPANCY) settlement periods.

**BR-COL-035**: RLS MUST filter all collection tables by branch_id. No cross-branch data access for any role below system admin.

---

## 7. Scenarios

**SC-COL-001: Register full payment for one order (cash)**
- Given order #50 DELIVERED, total=200.00, payment_status=PENDING
- When seller registers EFECTIVO collection 200.00, collection_item for order #50 amount_applied=200.00
- Then collection row created; collection_item created
- And orders.payment_status → PAID
- And settlement trigger updates total_expected

**SC-COL-002: Register partial payment**
- Given order #50 DELIVERED, total=200.00, payment_status=PENDING
- When seller registers EFECTIVO collection 100.00, amount_applied=100.00 for order #50
- Then payment_status → PARTIAL (100 < 200)

**SC-COL-003: One payment covers three orders (FIFO)**
- Given orders #51 (outstanding 150.00), #52 (outstanding 200.00), #53 (outstanding 100.00) — all DELIVERED, all from same customer
- And seller does not manually assign invoices
- When seller registers YAPE collection 450.00 with reference_number="OP123456"
- Then system applies FIFO: collection_items created for #51 (150.00), #52 (200.00), #53 (100.00)
- And all three orders → payment_status = PAID

**SC-COL-004: Block payment on non-terminal order**
- Given order #55 in APPROVED state
- When seller attempts to register a collection for order #55
- Then system MUST reject with COLLECTION_INVALID_ORDER_STATE

**SC-COL-005: Block Yape without reference_number**
- Given order #50 DELIVERED
- When seller registers YAPE collection with empty reference_number
- Then system MUST reject with REFERENCE_NUMBER_REQUIRED; no collection row created

**SC-COL-006: Block overpayment**
- Given order #50 DELIVERED, total=200.00, already collected=150.00 (outstanding=50.00)
- When seller attempts collection_item amount_applied=100.00 for order #50
- Then system MUST reject with OVERPAYMENT_NOT_ALLOWED

**SC-COL-007: payment_status progression PENDING → PARTIAL → PAID**
- Given order #50 DELIVERED, total=300.00, payment_status=PENDING
- When seller registers 100.00 → payment_status=PARTIAL
- When seller registers another 100.00 → payment_status=PARTIAL (200 < 300)
- When seller registers another 100.00 → payment_status=PAID (300 >= 300)

**SC-COL-008: Seller submits daily settlement**
- Given seller "S-001" has 5 collections totaling 1,250.00 for 2026-05-06 (Lima time)
- When seller presses "Enviar Liquidación" at 6:30 PM Lima time
- Then daily_settlements row created: settlement_date=2026-05-06, status=PENDING, total_expected=1250.00
- And collections after 6:30 PM for 2026-05-06 Lima-date go to next settlement period

**SC-COL-009: Supervisor approves settlement with matching totals**
- Given daily_settlement for seller "S-001" on 2026-05-06, total_expected=1250.00, status=PENDING
- And supervisor physically counts 1250.00 (cash + Yape receipts)
- When supervisor enters total_collected_physical=1250.00 and approves
- Then status → APPROVED; difference=0.00; approved_by and approved_at set
- And all collections for S-001 on 2026-05-06 become immutable for seller

**SC-COL-010: Supervisor finds discrepancy**
- Given daily_settlement total_expected=1250.00, supervisor counts 1200.00
- When supervisor enters total_collected_physical=1200.00
- Then difference=-50.00; status → DISCREPANCY; supervisor_notes MANDATORY (≥20 chars)
- And collections still frozen; discrepancy resolution is out-of-scope for MVP

**SC-COL-011: Full void reversal by supervisor**
- Given collection #C-101 (EFECTIVO, 200.00) in PENDING settlement
- And seller entered wrong amount
- When supervisor creates reversal with parent_collection_id=#C-101, total_collected=-200.00
- Then reversal collection_items created with negative amounts
- And order payment_status recomputed to PENDING
- And seller registers corrected collection with correct amount

**SC-COL-012: Block edit after settlement approved**
- Given daily_settlement for 2026-05-06 is APPROVED
- When seller attempts to modify collection #C-100 from that date
- Then system MUST reject (append-only + settlement frozen)
- And only admin role can create reversal; requires cancellation_audit_log entry

---

## Amendments to Core Spec Rules

The following BR-COL rules from `01-core-domain-model.md` are superseded by this spec:

| Core Spec Rule | Superseded By | Notes |
|---|---|---|
| BR-COL-001 through BR-COL-008 | BR-COL-001 through BR-COL-035 | Full replacement |
| invoice_id: optional | BR-COL-009 | Now MANDATORY, with FIFO fallback |
| payment_method: no PLIN | BR-COL-001 table | PLIN added to enum |
| daily_settlement: not specified | BR-COL-017 through BR-COL-025 | Manual "Enviar Liquidación" model, no cron |

---

## Risk Decisions (Resolved Before Spec Authoring)

1. **Timezone** → America/Lima for settlement_date, Postgres `AT TIME ZONE` conversion
2. **total_expected recomputation** → Postgres trigger (not frontend calculation)
3. **invoice_id backfill** → mandatory at registration time, FIFO fallback if unselected
4. **Reversals** → Full Void only (no partial corrections in MVP)
5. **Settlement creation** → manual "Enviar Liquidación" by seller (no cron)
