# Specification: Dispatch Manifest Module (Módulo Manifiesto de Carga) — Sistema de Reparto

**Version**: 1.0  
**Date**: 2026-05-06  
**Status**: DRAFT  
**RFC Keywords**: MUST, SHALL, SHOULD, MAY (per RFC 2119)  
**Extends**: `01-core-domain-model.md` (Module 7 — Distribution)  
**Engram**: sdd/reparto/core-domain-model/spec-manifest (#200)  
**Supersedes**: BR-DIS-001 through BR-DIS-011 and Scenarios DIS-01 through DIS-05 in the core-domain-model spec

---

## Scope

This specification covers the full lifecycle of a `dispatch_manifest` (Manifiesto de Carga), including state machine transitions, guard conditions, side effects on orders, capacity advisory logic, personnel assignment, GRE integration at the manifest level, picking document derivation, and closure rules. It does NOT re-specify order states, inventory movements, the Kardex, pricing, CRM, collections, or the SUNAT async infrastructure — those are defined in the other specs.

---

## Tables Reference (Structural Enumeration Only)

**dispatch_manifests** (header):
- `id`, `branch_id`, `warehouse_id`, `vehicle_id` (FK — plate_number is NOT denormalized)
- `status` ENUM: `DRAFT` | `CONFIRMED` | `EN_ROUTE` | `CLOSED`
- `manifest_date` DATE — scheduled departure date
- `total_weight_kg` DECIMAL — computed from order items × product weight_kg
- `total_volume_m3` DECIMAL — computed from order items × product volume_m3
- `created_by`, `created_at`, `updated_at`

**manifest_orders** (junction):
- `manifest_id`, `order_id` — composite PK
- `delivery_sequence` INT — stop order for the driver
- `delivery_status` ENUM: `PENDING` | `DELIVERED` | `PARTIAL` | `REJECTED`
- `arrival_time` TIMESTAMPTZ — when driver arrives at the customer
- `departure_time` TIMESTAMPTZ — when driver leaves the customer

**manifest_personnel** (crew):
- `manifest_id`, `person_id` — composite PK
- `role` ENUM: `DRIVER` | `ASSISTANT`

**vehicles** (existing):
- `id`, `plate_number`, `capacity_kg`, `capacity_m3`, `branch_id`, `active`

**products** (existing — extended):
- `weight_kg` DECIMAL (nullable, default 0)
- `volume_m3` DECIMAL (nullable, default 0)

**remission_guides** (existing — referenced):
- `manifest_id` (FK — one GRE per manifest)
- `sunat_status` ENUM: `PENDIENTE` | `ENVIADO` | `ACEPTADO` | `RECHAZADO`

---

## 1. Manifest Lifecycle Rules

**BR-MAN-001**: The valid manifest statuses are: `DRAFT`, `CONFIRMED`, `EN_ROUTE`, `CLOSED`. The only permitted transitions are:
- `DRAFT` → `CONFIRMED`
- `CONFIRMED` → `EN_ROUTE`
- `EN_ROUTE` → `CLOSED`

No other transitions are permitted. Backward transitions MUST be rejected.

**BR-MAN-002**: `CLOSED` is a terminal state. No transition out of `CLOSED` is permitted under any circumstance.

**BR-MAN-003**: A manifest is created in `DRAFT` status. All manifest mutations (adding/removing orders, assigning personnel, changing vehicle) MUST be performed while the manifest is in `DRAFT` status.

**BR-MAN-004**: The `DRAFT` → `CONFIRMED` transition MUST be restricted to users with `logistics` or `admin` role. Guard conditions that MUST ALL be satisfied before the transition proceeds:
  1. At least one `manifest_personnel` row with `role = 'DRIVER'` exists for the manifest.
  2. The manifest contains at least one order in `manifest_orders`.
  3. The manifest has a `vehicle_id` assigned.

If any guard fails, the transition MUST be rejected with the appropriate error code (see Section 1.1).

**BR-MAN-005**: The `DRAFT` → `CONFIRMED` transition side effect: a GRE (Guía de Remisión Electrónica) MUST be generated asynchronously for the manifest. The GRE covers ALL goods across ALL orders in the manifest. The transition to `CONFIRMED` MUST NOT be blocked waiting for the GRE to be accepted — GRE generation is fire-and-forget at this point.

**BR-MAN-006**: The `CONFIRMED` → `EN_ROUTE` transition MUST be restricted to users with `driver` role, and ONLY for manifests where the authenticated driver is listed in `manifest_personnel`. Guard condition: the manifest's associated `remission_guide.sunat_status` MUST equal `'ACEPTADO'`. If `sunat_status` is not `'ACEPTADO'`, the transition MUST be rejected with error code `GRE_NOT_ACCEPTED`. This is a hard block — no role override exists.

**BR-MAN-007**: The `CONFIRMED` → `EN_ROUTE` transition side effect: ALL orders in `manifest_orders` with `delivery_status = 'PENDING'` MUST simultaneously transition their corresponding `orders.status` from `PROGRAMMED` to `EN_ROUTE`. This batch transition MUST be atomic — either all orders transition or none do.

**BR-MAN-008**: The `EN_ROUTE` → `CLOSED` transition MUST be system-triggered only. No user role MAY manually trigger the `CLOSED` transition. The system MUST evaluate manifest closure whenever any `manifest_orders.delivery_status` is updated (see Section 7).

**BR-MAN-009**: `dispatch_manifests.total_weight_kg` and `total_volume_m3` MUST be recomputed each time an order is added to or removed from the manifest (while in `DRAFT`). The formula is:
- `total_weight_kg` = SUM of (`order_items.quantity` × `products.weight_kg`) across all order_items of all orders in the manifest
- `total_volume_m3` = SUM of (`order_items.quantity` × `products.volume_m3`) across all order_items
- Products with `weight_kg IS NULL` or `volume_m3 IS NULL` MUST be treated as 0 for this computation.

### 1.1 Error Codes for Manifest Transitions

| Error Code | Condition |
|---|---|
| `NO_DRIVER_ASSIGNED` | DRAFT→CONFIRMED attempted with no DRIVER in manifest_personnel |
| `MANIFEST_EMPTY` | DRAFT→CONFIRMED attempted with no orders in manifest_orders |
| `MANIFEST_NO_VEHICLE` | DRAFT→CONFIRMED attempted with no vehicle_id |
| `GRE_NOT_ACCEPTED` | CONFIRMED→EN_ROUTE attempted and remission_guide.sunat_status ≠ 'ACEPTADO' |
| `MANIFEST_NOT_DRAFT` | Any mutating operation on a non-DRAFT manifest |
| `VEHICLE_ALREADY_SCHEDULED` | Vehicle assigned to another active manifest on same date and branch |
| `ORDER_ALREADY_IN_MANIFEST` | Order already assigned to an active manifest |
| `ORDER_NOT_APPROVED` | Attempt to add an order not in APPROVED status |

---

## 2. Capacity Rules

**BR-MAN-012**: The `vehicles` table MUST carry `capacity_kg` (DECIMAL) and `capacity_m3` (DECIMAL) for each vehicle.

**BR-MAN-013**: Whenever an order is added to or removed from a manifest (DRAFT), the system MUST recompute `dispatch_manifests.total_weight_kg` and `total_volume_m3` and compare them against `vehicles.capacity_kg` and `vehicles.capacity_m3`.

**BR-MAN-014**: If `total_weight_kg > vehicles.capacity_kg` OR `total_volume_m3 > vehicles.capacity_m3`, the system SHOULD emit an advisory warning to the logistics user. The warning MUST include:
  - Which limit is exceeded (weight, volume, or both)
  - The excess amount (computed value − capacity)
  - The vehicle's limits for reference

**BR-MAN-015**: Exceeding `capacity_kg` or `capacity_m3` MUST NOT hard-block any manifest operation for MVP. The advisory warning is the only enforcement mechanism. Hard capacity blocking MAY be introduced in a future version.

**BR-MAN-016**: Products with `weight_kg = 0` or `weight_kg IS NULL` (and equivalently for `volume_m3`) contribute zero to the manifest totals. This is intentional — physical dimensions are populated incrementally and may be incomplete at dispatch time.

---

## 3. Order Assignment Rules

**BR-MAN-017**: Only orders in `APPROVED` status MAY be added to a manifest. Attempting to add an order in any other status MUST be rejected with error code `ORDER_NOT_APPROVED`.

**BR-MAN-018**: An `APPROVED` order MUST belong to at most one active manifest at any given time. "Active" means manifest status is `DRAFT`, `CONFIRMED`, or `EN_ROUTE`. Attempting to add an order that already appears in an active manifest MUST be rejected with error code `ORDER_ALREADY_IN_MANIFEST`.

**BR-MAN-019**: When an order is added to a manifest (in `DRAFT`), the order's status MUST immediately transition from `APPROVED` to `PROGRAMMED`. This transition is atomic with the insertion of the `manifest_orders` row.

**BR-MAN-020**: When an order is removed from a `DRAFT` manifest, the order's status MUST immediately revert from `PROGRAMMED` back to `APPROVED`. This allows the order to be reassigned to another manifest.

**BR-MAN-021**: Orders MAY NOT be added to or removed from a manifest in `CONFIRMED`, `EN_ROUTE`, or `CLOSED` status. Any such attempt MUST be rejected with error code `MANIFEST_NOT_DRAFT`.

**BR-MAN-022**: The `delivery_sequence` field in `manifest_orders` represents the planned stop order for the driver and MUST be a positive integer. Sequence values within a manifest MUST be unique. The sequence is assignable and re-orderable by logistics while the manifest is in `DRAFT`.

**BR-MAN-023**: `delivery_sequence` is advisory for MVP — the driver app MAY display stops in sequence order but the system MUST NOT enforce that deliveries occur in sequence order.

**BR-MAN-024**: All orders in a manifest MUST belong to the same branch (the manifest's `branch_id`). Attempting to add an order from a different branch MUST be rejected.

---

## 4. Personnel Rules

**BR-MAN-025**: `manifest_personnel` links people (drivers, assistants) to a manifest.

**BR-MAN-026**: The `role` field in `manifest_personnel` MUST be one of: `DRIVER` | `ASSISTANT`.

**BR-MAN-027**: A manifest MUST have at least one `manifest_personnel` row with `role = 'DRIVER'` before the `DRAFT` → `CONFIRMED` transition is allowed. Error code: `NO_DRIVER_ASSIGNED`.

**BR-MAN-028**: A manifest MAY have at most one `DRIVER`. Multiple `ASSISTANT` entries are permitted. Attempting to add a second `DRIVER` MUST be rejected with error code `MANIFEST_DRIVER_ALREADY_ASSIGNED`.

**BR-MAN-029**: Personnel MUST be assigned and removed only while the manifest is in `DRAFT` status. Modifying personnel after `CONFIRMED` MUST be rejected with error code `MANIFEST_NOT_DRAFT`.

**BR-MAN-030**: Personnel assignment is restricted to users with `logistics` or `admin` role.

**BR-MAN-031**: A driver MAY only initiate the `CONFIRMED` → `EN_ROUTE` transition for manifests where their `person_id` appears in `manifest_personnel` with `role = 'DRIVER'`. RLS MUST enforce this.

---

## 5. GRE Integration Rules

**BR-MAN-032**: Exactly ONE GRE (Guía de Remisión Electrónica) is generated per dispatch manifest. GREs are NOT generated per order in the manifest context. This supersedes the per-order GRE model in the core-domain-model spec (BR-SUN-010).

**BR-MAN-033**: The manifest-level GRE is generated asynchronously when the manifest transitions `DRAFT` → `CONFIRMED`. The `CONFIRMED` status change MUST NOT be blocked waiting for the OSE response.

**BR-MAN-034**: The manifest GRE MUST contain:
  - Shipper: the company entity (empresa emisora)
  - Carrier: the vehicle plate number (from `vehicles.plate_number`, NOT denormalized) and the driver's full name and document number
  - All goods: a consolidated line per product listing total quantity across all orders in the manifest
  - All delivery points: one destination per order, listing the customer's delivery address and `delivery_sequence` as the stop order reference
  - Origin: the branch warehouse address

**BR-MAN-035**: The `remission_guide` record for a manifest MUST reference `manifest_id` (FK). The `sunat_status` progresses through: `PENDIENTE` → `ENVIADO` → `ACEPTADO` | `RECHAZADO`.

**BR-MAN-036**: The `CONFIRMED` → `EN_ROUTE` transition is hard-blocked until `remission_guide.sunat_status = 'ACEPTADO'`. No role override exists. Error code: `GRE_NOT_ACCEPTED`.

**BR-MAN-037**: If the manifest GRE receives status `RECHAZADO` from OSE, the system MUST:
  1. Update `remission_guide.sunat_status` to `RECHAZADO`
  2. Emit a real-time notification to logistics users for the manifest's branch via Supabase Realtime
  3. Block the manifest from transitioning to `EN_ROUTE` until a corrected GRE is submitted and accepted

**BR-MAN-038**: Correcting a rejected GRE requires logistics to update the relevant data and resubmit. Resubmission creates a new `remission_guide` row (the prior rejected row is retained for audit). The manifest's effective GRE for the `EN_ROUTE` guard is the most recent `remission_guide` row for the manifest.

**BR-MAN-039**: The GRE serie for a manifest follows the branch-level serie convention (e.g., T001 for Lima, T002 for Cajamarca). The `correlativo` is a sequential counter per branch GRE serie with no gaps, consistent with SUNAT compliance requirements.

**BR-MAN-040**: The vehicle's `plate_number` used in the GRE MUST be read from `vehicles.plate_number` at the time of GRE generation. It MUST NOT be cached or denormalized into `dispatch_manifests`.

---

## 6. Picking Document Rules

**BR-MAN-041**: The **Picking Consolidado** (consolidated picking list) is a derived read-only document. It MUST NOT be stored as a table or materialized view. It is generated on demand as a query result.

**BR-MAN-042**: The Picking Consolidado query MUST produce, for a given manifest: one row per product, with `SUM(order_items.quantity)` aggregated across all orders in the manifest.

**BR-MAN-043**: The **Picking por Pedido** (per-order picking list) is also a derived read-only document. It MUST NOT be stored.

**BR-MAN-044**: The Picking por Pedido query MUST produce, for a given manifest: rows grouped by order (and therefore by customer), listing each `order_item` with its product name, SKU, quantity, and `delivery_sequence`.

**BR-MAN-045**: Both picking documents MUST be available only for manifests in `CONFIRMED`, `EN_ROUTE`, or `CLOSED` status. A `DRAFT` manifest has mutable order composition and the picking list would be unstable.

**BR-MAN-046**: Both picking documents are accessible to: `logistics`, `admin`, and the assigned `driver` for their own manifest. `seller` role MUST NOT access picking documents.

---

## 7. Closure Rules

**BR-MAN-047**: The `CLOSED` transition is exclusively system-triggered. No user, regardless of role, MAY manually close a manifest.

**BR-MAN-048**: The system MUST evaluate manifest closure whenever a `manifest_orders.delivery_status` is updated. The evaluation rule: if ALL rows in `manifest_orders` for a given manifest have `delivery_status` in `{ DELIVERED, PARTIAL, REJECTED }`, the manifest `status` MUST be automatically updated to `CLOSED`.

**BR-MAN-049**: `CLOSED` does NOT require any order to have `payment_status = PAID`. Payment collection is orthogonal to manifest closure. A manifest closes as soon as all delivery outcomes are terminal, regardless of whether the driver collected payment.

**BR-MAN-050**: A manifest with zero orders in `manifest_orders` MUST NOT be auto-closeable. This state is only possible in `DRAFT` and is prevented from reaching `CONFIRMED` by BR-MAN-004.

**BR-MAN-051**: If some but not all `manifest_orders` rows are in terminal delivery_status, the manifest MUST remain in `EN_ROUTE`. Partial closure is not permitted.

**BR-MAN-052**: Once `CLOSED`, the manifest's `total_weight_kg`, `total_volume_m3`, `vehicle_id`, and `manifest_date` are immutable historical data. No fields on a `CLOSED` manifest MUST be updatable.

---

## 8. Scenarios

**Scenario MAN-01: Create a manifest and add orders**
- Given branch "Lima" has vehicle "V-001" (plate "ABC-123", capacity_kg=1000, capacity_m3=10) active and unassigned for 2026-05-07
- And orders #101, #102, #103 are in `APPROVED` status for branch "Lima"
- When logistics creates a manifest for 2026-05-07, vehicle "V-001", warehouse "WH-Lima-01"
- Then `dispatch_manifests` SHALL be created with status=`DRAFT`, vehicle_id=V-001
- When logistics adds orders #101, #102, #103 to the manifest
- Then three `manifest_orders` rows SHALL be created with delivery_status=`PENDING`
- And orders #101, #102, #103 `status` SHALL each transition to `PROGRAMMED` atomically
- And total_weight_kg and total_volume_m3 SHALL be recomputed from the order items

**Scenario MAN-02: Add order already in active manifest — blocked**
- Given manifest #M-01 is in `DRAFT` with order #101 (status=PROGRAMMED)
- And manifest #M-02 is in `DRAFT` for the same branch and date
- When logistics attempts to add order #101 to manifest #M-02
- Then the system MUST reject with error code `ORDER_ALREADY_IN_MANIFEST`
- And order #101 SHALL remain in manifest #M-01 with status `PROGRAMMED`

**Scenario MAN-03: Capacity warning on order addition**
- Given manifest #M-01 has vehicle "V-001" with capacity_kg=500
- And current total_weight_kg = 480
- When logistics adds order #104 whose items total 30 kg
- Then the order SHALL be added successfully (no hard block)
- And total_weight_kg SHALL be recomputed to 510
- And the system SHOULD emit advisory warning: "Peso excede capacidad del vehículo: 510 kg > 500 kg (exceso: 10 kg)"

**Scenario MAN-04: Confirm manifest without driver — blocked**
- Given manifest #M-01 is in `DRAFT` with orders #101, #102 and vehicle "V-001"
- And `manifest_personnel` has zero rows for manifest #M-01
- When logistics attempts to confirm manifest #M-01
- Then the system MUST reject with error code `NO_DRIVER_ASSIGNED`
- And manifest #M-01 SHALL remain in `DRAFT`
- And the GRE MUST NOT be generated

**Scenario MAN-05: Confirm manifest with driver — GRE generated**
- Given manifest #M-01 is in `DRAFT` with orders #101, #102, vehicle "V-001"
- And `manifest_personnel` has one row: person_id="P-DRV-01", role=`DRIVER`
- When logistics confirms manifest #M-01
- Then manifest #M-01 status SHALL become `CONFIRMED`
- And a `remission_guide` row SHALL be created with manifest_id=#M-01, sunat_status=`PENDIENTE`
- And an Edge Function SHALL be triggered asynchronously to send the GRE to OSE
- And the transition MUST NOT block waiting for the OSE response

**Scenario MAN-06: EN_ROUTE blocked — GRE not yet accepted**
- Given manifest #M-01 is in `CONFIRMED` and remission_guide.sunat_status = `ENVIADO`
- And driver "P-DRV-01" is the assigned driver
- When driver "P-DRV-01" attempts to transition manifest #M-01 to `EN_ROUTE`
- Then the system MUST reject with error code `GRE_NOT_ACCEPTED`
- And manifest #M-01 SHALL remain in `CONFIRMED`
- And orders #101, #102 SHALL remain in `PROGRAMMED` status

**Scenario MAN-07: EN_ROUTE allowed — GRE accepted**
- Given manifest #M-01 is in `CONFIRMED` and remission_guide.sunat_status = `ACEPTADO`
- And driver "P-DRV-01" is the assigned driver
- When driver "P-DRV-01" transitions manifest #M-01 to `EN_ROUTE`
- Then manifest #M-01 status SHALL become `EN_ROUTE`
- And orders #101, #102 (delivery_status=`PENDING`) SHALL simultaneously transition from `PROGRAMMED` to `EN_ROUTE`
- And this batch transition MUST be atomic

**Scenario MAN-08: Delivery sequence assignment and reordering**
- Given manifest #M-01 is in `DRAFT` with orders #101, #102, #103
- And logistics assigns: #101→sequence 1, #102→sequence 2, #103→sequence 3
- When logistics reorders: #102→sequence 1, #101→sequence 2, #103→sequence 3
- Then `manifest_orders.delivery_sequence` SHALL be updated for all three rows
- And the system MUST ensure no two rows share the same sequence number within manifest #M-01

**Scenario MAN-09: Partial closure — not all orders terminal**
- Given manifest #M-01 is in `EN_ROUTE` with orders #101, #102, #103
- And order #101 delivery_status is updated to `DELIVERED`
- And orders #102, #103 delivery_status remain `PENDING`
- When the system evaluates manifest closure
- Then manifest #M-01 MUST remain in `EN_ROUTE`

**Scenario MAN-10: Auto-close when all orders terminal**
- Given manifest #M-01 is in `EN_ROUTE` with orders #101 (DELIVERED), #102 (PARTIAL), #103 (PENDING)
- When driver updates order #103 delivery_status to `REJECTED`
- Then all manifest_orders delivery_statuses are terminal: {DELIVERED, PARTIAL, REJECTED}
- And the system MUST automatically update manifest #M-01 status to `CLOSED`
- And no user action is required for closure
- And manifest #M-01 SHALL NOT require payment_status = PAID to close

**Scenario MAN-11: Vehicle conflict — same date and branch**
- Given vehicle "V-001" is assigned to manifest #M-01 for branch "Lima", date 2026-05-07 (status=CONFIRMED)
- When logistics creates a new manifest for branch "Lima", date 2026-05-07 and attempts to assign vehicle "V-001"
- Then the system MUST reject the vehicle assignment with error code `VEHICLE_ALREADY_SCHEDULED`
- And the new manifest SHALL be saved in `DRAFT` status without a vehicle_id

**Scenario MAN-12: Order already in active manifest — add attempt to confirmed manifest**
- Given order #105 is in `APPROVED` status
- And manifest #M-03 is in `CONFIRMED`
- When logistics attempts to add order #105 to manifest #M-03
- Then the system MUST reject with error code `MANIFEST_NOT_DRAFT`
- And order #105 SHALL remain in `APPROVED` status

---

## Superseded Rules from core-domain-model spec (Module 7)

| Core Spec Rule | Superseded By | Notes |
|---|---|---|
| BR-DIS-001 | BR-MAN-003, BR-MAN-004 | Status enum now DRAFT/CONFIRMED/EN_ROUTE/CLOSED |
| BR-DIS-002 | BR-MAN-003 | vehicle_id FK, not plate_number denormalization |
| BR-DIS-003 | BR-MAN-017, BR-MAN-019 | Only APPROVED orders added; APPROVED→PROGRAMMED on add |
| BR-DIS-004 | BR-MAN-019 | Confirmed as side effect of adding to DRAFT manifest |
| BR-DIS-005 | BR-MAN-027, BR-MAN-028 | At least one DRIVER required; at most one DRIVER |
| BR-DIS-006 | BR-MAN-012 | vehicles table fields confirmed |
| BR-DIS-007 | BR-MAN-025, BR-MAN-026 | Personnel role enum: DRIVER, ASSISTANT only |
| BR-DIS-008 | BR-MAN-021 | CONFIRMED+ manifests locked |
| BR-DIS-009 | BR-MAN-007 | EN_ROUTE triggers batch PROGRAMMED→EN_ROUTE |
| BR-DIS-010 | BR-MAN-048 | COMPLETED renamed CLOSED; terminal = {DELIVERED, PARTIAL, REJECTED} |
| BR-DIS-011 | BR-MAN-011 | Same date + branch vehicle conflict |

Scenarios DIS-01 through DIS-05 are superseded by Scenarios MAN-01 through MAN-12 in this spec.

---

## Open Questions

None. All design decisions confirmed by the product owner prior to spec authoring. Capacity hard-blocking is explicitly deferred to a post-MVP version.
