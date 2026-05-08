# Specification: SUNAT / Fiscal Module — Sistema de Reparto

**Version**: 1.0  
**Date**: 2026-05-06  
**Status**: DRAFT  
**RFC Keywords**: MUST, SHALL, SHOULD, MAY (per RFC 2119)  
**Extends**: `01-core-domain-model.md` (Module 8 — SUNAT/Legal)  
**Engram**: sdd/reparto/core-domain-model/spec-sunat (#220)  
**Supersedes**: BR-SUN-001 through BR-SUN-041 (all), BR-SUN-010 per-order GRE model

---

## 0. Scope and Purpose

This specification defines the fiscal compliance layer for the Sistema de Reparto, covering all electronic document generation and submission to SUNAT via an OSE (Operador de Servicios Electrónicos). It supersedes all Module 8 rules in the core-domain-model spec and replaces the per-order GRE model with the canonical per-manifest GRE model (established in `03-manifest.md`).

All business rules are numbered BR-SNAT-NNN. All scenarios are numbered SC-SNAT-NNN.

---

## 1. OSE Communication Rules

**BR-SNAT-001** — The system SHALL communicate with SUNAT exclusively through a registered OSE (Operador de Servicios Electrónicos). Direct SUNAT API calls are NOT permitted.

**BR-SNAT-002** — All OSE communication MUST be asynchronous. The frontend MUST NOT block or wait for an OSE response at any point. Edge Functions handle submission; status updates propagate via Realtime.

**BR-SNAT-003** — All OSE submissions SHALL be executed by Supabase Edge Functions (Deno runtime). No other runtime or mechanism is permitted for OSE communication.

**BR-SNAT-004** — Each Edge Function responsible for OSE submission MUST implement a retry strategy: up to 3 attempts with exponential backoff (1s, 2s, 4s) before marking the document with sunat_status = 'FAILED'.

**BR-SNAT-005** — The sunat_status value `'FAILED'` is reserved exclusively for infrastructure failures (OSE unreachable, network timeout, Edge Function crash). It MUST NOT be used for SUNAT-level rejections, which use `'RECHAZADO'`.

**BR-SNAT-006** — After exhausting all retries and setting sunat_status = 'FAILED', the system SHOULD alert operations staff via an internal notification channel (Supabase Realtime event on a dedicated admin channel or a logging sink). Automatic re-queuing is NOT required but MAY be implemented.

**BR-SNAT-007** — Supabase Realtime MUST broadcast any change to sunat_status on the following tables: `remission_guides`, `invoices`, `credit_notes`. Connected clients subscribe to their relevant rows and update UI state reactively.

**BR-SNAT-008** — All XML documents sent to the OSE MUST be stored. The URL of the stored XML MUST be written to the corresponding table row's `xml_content_url` column before or at the time of OSE submission.

**BR-SNAT-009** — All PDF representations of fiscal documents (generated after OSE acceptance) MUST be stored. The URL MUST be written to `pdf_url` upon receipt. PDFs are NOT required before OSE acceptance.

**BR-SNAT-010** — The OSE response code and message MUST be persisted to `ose_response_code` and `ose_response_message` on every OSE response, whether the document is accepted, rejected, or results in an error.

---

## 2. GRE (Guía de Remisión Electrónica) Rules

**BR-SNAT-011** — ONE GRE SHALL be generated per dispatch manifest. The GRE is manifest-scoped, not order-scoped. A manifest MUST have exactly one active GRE at any given time (the latest non-cancelled row).

**BR-SNAT-012** — A GRE MUST contain the following information derived from its parent manifest:
  - Vehicle plate (from manifest.vehicle_id → vehicles.plate_number)
  - Driver name and document number (from manifest_personnel → drivers table)
  - All goods consolidated across all orders (line items: product code, description, quantity, unit of measure)
  - All delivery points listed (destination address per order, in the manifest's order sequence)
  - Branch origin address (from branches table, branch_id = manifest.branch_id)
  - Issue date (date of generation)
  - GRE serie and correlativo (per Section 6)

**BR-SNAT-013** — GRE generation MUST be triggered asynchronously when the manifest transitions from DRAFT to CONFIRMED. The trigger is fire-and-forget: the manifest state change completes immediately without waiting for GRE submission to complete.

**BR-SNAT-014** — The manifest transition from CONFIRMED to EN_ROUTE SHALL be hard-blocked until the associated `remission_guides` row has `sunat_status = 'ACEPTADO'`. No EN_ROUTE transition is permitted if the latest remission_guides row for the manifest is in any other state (PENDIENTE, ENVIADO, RECHAZADO, FAILED).

**BR-SNAT-015** — If a GRE is rejected by SUNAT (sunat_status = 'RECHAZADO'), the logistics team MUST be notified via Supabase Realtime. A new `remission_guides` row MUST be inserted for the corrected resubmission. The rejected row MUST NOT be deleted or modified (retained for audit). The EN_ROUTE block (BR-SNAT-014) remains in effect until the newest remission_guides row for the manifest reaches 'ACEPTADO'.

**BR-SNAT-016** — Each branch SHALL have exactly one GRE serie, stored in `branches.gre_serie` (e.g., "T001" for Lima, "T002" for Cajamarca). New branches MUST have gre_serie populated before any manifest can be confirmed at that branch.

**BR-SNAT-017** — The full sunat_status lifecycle for remission_guides is:
```
PENDIENTE → ENVIADO → ACEPTADO
PENDIENTE → ENVIADO → RECHAZADO
PENDIENTE → FAILED (after retry exhaustion)
```
No transitions from ACEPTADO are permitted (GREs are not cancellable once accepted under current SUNAT regulations).

---

## 3. Invoice and Boleta Rules

**BR-SNAT-018** — Invoice generation SHALL be triggered by the following order state transitions:
  - DELIVERED: generate one comprobante for the full order amount.
  - PARTIAL: generate one comprobante for the ORIGINAL full order amount (not the delivered subset). A credit note is generated simultaneously (see Section 4).

**BR-SNAT-019** — Document type selection MUST follow customer document type:
  - Customer with RUC (legal entity) → FACTURA, using the branch's factura serie (default: F001).
  - Customer with DNI (natural person) → BOLETA, using the branch's boleta serie (default: B001).
  - Additional series MAY be configured per branch in a `branch_document_series` table.

**BR-SNAT-020** — Every invoice and boleta MUST include:
  - Customer document type (RUC or DNI) and number
  - Customer legal name or trade name
  - Line items: product code, description, quantity, unit price (excluding IGV), line total (excluding IGV)
  - Subtotal (sum of line totals, excluding IGV)
  - IGV amount (subtotal × 0.18, rounded to 2 decimal places)
  - Total (subtotal + IGV amount)
  - Issue date
  - Order reference (order_id)
  - Branch identification (branch RUC, address)
  - Serie and correlativo

**BR-SNAT-021** — The IGV rate is 18%. Formula: `igv_amount = ROUND(subtotal * 0.18, 2)`. `Total = subtotal + igv_amount`.

**BR-SNAT-022** — For PARTIAL deliveries, the invoice amount covers the ORIGINAL full order amount (all line items at their original agreed prices), not just the items physically delivered. The undelivered portion is handled exclusively via a credit note (Section 4).

**BR-SNAT-023** — Invoice submission to the OSE MUST be asynchronous. The order state transition (to DELIVERED or PARTIAL) completes immediately; the invoice row is inserted with sunat_status = 'PENDIENTE' and the Edge Function is dispatched.

**BR-SNAT-024** — If an invoice is rejected (sunat_status = 'RECHAZADO'), operations staff MUST be notified via Realtime. A corrected invoice MUST be resubmitted as a new `invoices` row (new correlativo — see BR-SNAT-034). The rejected row is retained for audit.

**BR-SNAT-025** — The full sunat_status lifecycle for invoices is:
```
PENDIENTE → ENVIADO → ACEPTADO
PENDIENTE → ENVIADO → RECHAZADO
PENDIENTE → FAILED
ACEPTADO → ANULACION_PENDIENTE → ANULADO
```
No other transitions are valid.

---

## 4. Credit Note Rules

**BR-SNAT-026** — A credit note SHALL be generated whenever an order transitions to PARTIAL, simultaneously with the invoice. The credit note MUST reference the original invoice via `original_invoice_id` (FK to invoices.id).

**BR-SNAT-027** — The amount of the credit note SHALL equal the sum of the undelivered or returned line items, each valued at their invoice unit price. Formula: `credit_note.amount = Σ (undelivered_quantity × invoice_unit_price)` for each undelivered line.

**BR-SNAT-028** — Credit notes MUST use SUNAT Catálogo N° 9 reason codes. The default reason code for partial deliveries and returns is `"07 - Devolución de bienes"`. The code MUST be stored in `credit_notes.reason_code`.

**BR-SNAT-029** — A credit note MUST NOT be submitted to the OSE until its referenced invoice has `sunat_status = 'ACEPTADO'`. If the invoice is not yet ACEPTADO at the time of credit note creation, the credit note row SHALL be inserted with `sunat_status = 'WAITING_FOR_INVOICE'`.

**BR-SNAT-030** — The `sunat_status = 'WAITING_FOR_INVOICE'` is exclusive to credit_notes. It signifies that the credit note is ready for submission but is blocked pending invoice acceptance. No OSE submission is attempted while in this state.

**BR-SNAT-031** — A database trigger or worker MUST monitor `invoice.sunat_status` transitions. When `invoice.sunat_status` changes to `'ACEPTADO'`, the system MUST automatically locate all `credit_notes` rows with `sunat_status = 'WAITING_FOR_INVOICE'` that reference that invoice, and dispatch Edge Function submissions for each. This is the auto-submit mechanism.

**BR-SNAT-032** — The full sunat_status lifecycle for credit_notes is:
```
WAITING_FOR_INVOICE → PENDIENTE (on invoice ACEPTADO trigger) → ENVIADO → ACEPTADO
PENDIENTE → ENVIADO → RECHAZADO
PENDIENTE → FAILED
ACEPTADO → ANULACION_PENDIENTE → ANULADO (if annulled)
```

---

## 5. Cancellation / Annulment Rules

**BR-SNAT-033** — The annulment flow applies to invoices, boletas, and credit notes that have reached `sunat_status = 'ACEPTADO'`. Annulment is communicated to SUNAT via a "Comunicación de Baja" submitted through the OSE.

**BR-SNAT-034** — An admin user MAY initiate annulment for any ACEPTADO document. The system MUST require a `motivo` (reason text) with a minimum of 15 characters. If the motivo is absent or shorter than 15 characters, the system MUST reject the annulment request. No ANULACION_PENDIENTE transition occurs without a valid motivo.

**BR-SNAT-035** — Upon successful motivo validation, the system MUST:
  1. Insert a row into `cancellation_audit_log` with: document_id, document_type, user_id (the admin), motivo, requested_at (UTC timestamp).
  2. Update the document's sunat_status to `'ANULACION_PENDIENTE'`.
  3. Dispatch an Edge Function to submit the Comunicación de Baja to the OSE asynchronously.
  
  Steps 1 and 2 MUST succeed atomically (same database transaction). Step 3 is fire-and-forget.

**BR-SNAT-036** — The `cancellation_audit_log` table is append-only. UPDATE and DELETE operations on this table are PROHIBITED at the application layer. RLS policies MUST enforce INSERT-only access for the service role.

**BR-SNAT-037** — When the OSE confirms the Comunicación de Baja, the document's sunat_status SHALL transition from `'ANULACION_PENDIENTE'` to `'ANULADO'`. The cancellation_audit_log row SHALL be updated with `ose_status` and `ose_confirmed_at`.

**BR-SNAT-038** — An order SHOULD NOT be cancellable at the application level if any associated comprobante (invoice, boleta, or credit note) is in `sunat_status = 'ACEPTADO'`. An override MAY be provided for admin users only, but it MUST require a logged motivo in `cancellation_audit_log` and MUST be explicitly confirmed by the admin. The system MUST display a warning listing all ACEPTADO documents associated with the order.

**BR-SNAT-039** — Documents in `ANULACION_PENDIENTE` MUST be treated as still-valid by the system until OSE confirms annulment. No inventory, financial, or order state reversals are applied while a document is in ANULACION_PENDIENTE.

---

## 6. Serie and Correlativo Rules

**BR-SNAT-040** — Each `(branch, document_type, serie)` combination SHALL have a dedicated PostgreSQL SEQUENCE object. The sequence name convention is: `seq_{branch_id}_{document_type}_{serie}` (e.g., `seq_1_GRE_T001`, `seq_1_FACTURA_F001`). This guarantees atomicity and avoids gaps from race conditions.

**BR-SNAT-041** — The combination `(document_type, serie, correlativo)` MUST be globally unique across the entire system. A unique constraint MUST be enforced at the database level on `(document_type, serie, correlativo)` for each of: `remission_guides`, `invoices`, `credit_notes`.

**BR-SNAT-042** — Correlativos MUST NOT be reused under any circumstances. If a document is rejected (RECHAZADO) or a submission fails (FAILED), the correlativo used for that document row is permanently consumed. A new submission MUST obtain a new correlativo from the sequence. Consumed correlativos that were never accepted are reported as voided in periodic SUNAT declarations.

**BR-SNAT-043** — GRE serie is stored in `branches.gre_serie`. Invoice and boleta series are configurable per branch. The primary factura serie defaults to `'F001'`; the primary boleta serie defaults to `'B001'`. Branches MAY define additional series in a `branch_document_series` table (columns: branch_id, document_type, serie, is_primary).

**BR-SNAT-044** — Serie codes MUST conform to SUNAT format rules: the first character indicates document type (T for GRE, F for Factura, B for Boleta), followed by exactly 3 digits (e.g., T001, F001, B001). The system MUST validate serie format on insert.

---

## 7. Driver-Facing Status Rules

**BR-SNAT-045** — The driver-facing UI MUST display human-readable status labels for all SUNAT-related document statuses. Raw sunat_status codes MUST NOT be exposed to non-administrative users.

**BR-SNAT-046** — The canonical mapping from sunat_status to driver-facing display label:

| sunat_status | Driver UI Label (ES) |
|---|---|
| PENDIENTE | Pendiente de envío |
| ENVIADO | Enviado al validador |
| ACEPTADO | Aprobado por SUNAT |
| RECHAZADO | Rechazado — en revisión |
| FAILED | Error de comunicación |
| WAITING_FOR_INVOICE | Esperando aprobación de factura |
| ANULACION_PENDIENTE | Anulación en proceso |
| ANULADO | Anulado |

**BR-SNAT-047** — For the dispatch flow specifically, the driver MUST see the GRE status aggregated at the manifest level. If the manifest's GRE is not yet ACEPTADO, the driver's "Iniciar Reparto" action SHALL display the label "Guía pendiente de aprobación" and the action button SHALL be disabled. Once the GRE is ACEPTADO, the button SHALL be enabled with no additional confirmation required.

---

## 8. Scenarios

**SC-SNAT-001 — GRE generation on manifest confirm (happy path)**
- Given a manifest in DRAFT state with 3 orders, a confirmed driver, and a vehicle
- When an authorized user transitions the manifest to CONFIRMED
- Then the manifest.status = CONFIRMED immediately
- And a remission_guides row is inserted with sunat_status = 'PENDIENTE', correct serie/correlativo, and manifest_id
- And an Edge Function is dispatched asynchronously to submit the GRE XML to the OSE
- And when OSE accepts, sunat_status → 'ACEPTADO' via Realtime update

**SC-SNAT-002 — GRE rejected and corrected**
- Given a manifest's GRE has sunat_status = 'RECHAZADO' due to an invalid vehicle plate format
- When logistics corrects the vehicle plate and triggers resubmission
- Then a NEW remission_guides row is inserted (new correlativo from sequence)
- And the old rejected row remains in the table with sunat_status = 'RECHAZADO'
- And when the new row reaches 'ACEPTADO', EN_ROUTE becomes available for the manifest

**SC-SNAT-003 — EN_ROUTE blocked while GRE pending**
- Given a manifest is CONFIRMED and its GRE has sunat_status = 'PENDIENTE'
- When a driver attempts to transition the manifest to EN_ROUTE
- Then the transition is rejected: "Guía de Remisión no aprobada por SUNAT"
- And the manifest remains in CONFIRMED state
- And the driver sees "Guía pendiente de aprobación" in the UI

**SC-SNAT-004 — EN_ROUTE allowed after GRE accepted**
- Given a manifest is CONFIRMED and its GRE has sunat_status = 'ACEPTADO'
- When a driver transitions the manifest to EN_ROUTE
- Then the transition succeeds immediately

**SC-SNAT-005 — Invoice on DELIVERED, customer with RUC (Factura)**
- Given an order in DELIVERED state for a customer with RUC '20100070970'
- When the order transitions to DELIVERED
- Then an invoices row is inserted with document_type = 'FACTURA', serie = branch's factura serie (e.g., 'F001'), next correlativo from sequence, sunat_status = 'PENDIENTE'
- And subtotal, igv_amount (subtotal × 0.18), and total are computed and stored
- And the Edge Function submits the XML to OSE async
- And the order transition completes without waiting for OSE response

**SC-SNAT-006 — Invoice on DELIVERED, customer with DNI (Boleta)**
- Given an order in DELIVERED state for a customer with DNI '43210987'
- When the order transitions to DELIVERED
- Then an invoices row is inserted with document_type = 'BOLETA', serie = branch's boleta serie (e.g., 'B001')
- And IGV and total calculated per BR-SNAT-021
- And submitted async to OSE

**SC-SNAT-007 — Invoice on PARTIAL delivery**
- Given an order with 3 line items (total S/. 500.00) transitions to PARTIAL — only 2 items delivered
- When the PARTIAL transition is applied
- Then an invoices row is inserted for the FULL original amount (S/. 500.00 subtotal)
- And a credit_notes row is inserted simultaneously for the undelivered item's value, with sunat_status = 'WAITING_FOR_INVOICE' and reason_code = '07'
- And Invoice submitted async; credit note NOT submitted (blocked by WAITING_FOR_INVOICE)

**SC-SNAT-008 — Credit note WAITING_FOR_INVOICE → auto-submit**
- Given a credit note in sunat_status = 'WAITING_FOR_INVOICE' references invoice #42
- When invoice #42 transitions to sunat_status = 'ACEPTADO' (OSE response arrives)
- Then the database trigger detects the transition
- And the credit note's sunat_status is updated to 'PENDIENTE'
- And an Edge Function is dispatched to submit the credit note XML to OSE
- And no manual intervention is required

**SC-SNAT-009 — Credit note amount calculation**
- Given an order with 3 lines: Product A (qty 10 × S/. 20.00), Product B (qty 5 × S/. 50.00), Product C (qty 2 × S/. 100.00)
- Order transitions to PARTIAL — Product C undelivered
- When credit note is generated
- Then credit_notes.amount = 2 × S/. 100.00 = S/. 200.00
- And the invoice covers the full order: subtotal = (200 + 250 + 200) = S/. 650.00, igv = S/. 117.00, total = S/. 767.00

**SC-SNAT-010 — OSE unreachable — retry and FAILED**
- Given the OSE endpoint is unreachable (network failure)
- When an Edge Function attempts to submit an invoice
- Then the Edge Function retries 3 times with exponential backoff (1s, 2s, 4s)
- And after the 3rd failure, the invoice's sunat_status is set to 'FAILED'
- And a Realtime event is broadcast on the admin channel
- And the driver UI shows "Error de comunicación" for affected documents

**SC-SNAT-011 — Invoice RECHAZADO and corrected**
- Given an invoice has sunat_status = 'RECHAZADO' (e.g., RUC validation failed at SUNAT)
- When operations corrects the customer's RUC and triggers resubmission
- Then a NEW invoices row is inserted with a NEW correlativo
- And the rejected row is retained with sunat_status = 'RECHAZADO'

**SC-SNAT-012 — Annulment with valid motivo**
- Given an invoice with sunat_status = 'ACEPTADO'
- And an admin provides motivo = "Error en datos del cliente por cambio de razón social registrada." (≥15 chars)
- When the admin clicks "Anular" and confirms
- Then a cancellation_audit_log row is inserted with user_id, document_id, motivo, requested_at
- And invoice.sunat_status → 'ANULACION_PENDIENTE' (same transaction)
- And Edge Function dispatches Comunicación de Baja to OSE async
- And when OSE confirms → invoice.sunat_status → 'ANULADO', cancellation_audit_log.ose_confirmed_at is set

**SC-SNAT-013 — Annulment blocked: no motivo**
- Given an invoice with sunat_status = 'ACEPTADO'
- When admin submits annulment form with empty motivo
- Then the system returns a validation error: "El motivo de anulación es obligatorio y debe tener al menos 15 caracteres."
- And no cancellation_audit_log row is inserted
- And invoice.sunat_status remains 'ACEPTADO'

**SC-SNAT-014 — Correlativo uniqueness — no reuse after rejection**
- Given a GRE was submitted with serie='T001', correlativo=42, and was rejected (sunat_status='RECHAZADO')
- When a corrected GRE is submitted for the same manifest
- Then the PostgreSQL SEQUENCE for (branch_1, GRE, T001) has already advanced past 42
- And the new row receives correlativo = 43
- And correlativo 42 is permanently consumed and never reassigned

**SC-SNAT-015 — Realtime notification on sunat_status change**
- Given a connected browser tab has an active Supabase Realtime subscription on invoices WHERE id = 99
- When the OSE accepts invoice 99 and the Edge Function updates sunat_status → 'ACEPTADO'
- Then Supabase Realtime broadcasts a row-level UPDATE event for invoices id=99
- And the browser tab receives the event and updates the UI without a page refresh
- And the driver sees "Aprobado por SUNAT" without any manual action

---

## 9. Table Schemas (Reference Only)

### remission_guides
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| manifest_id | UUID FK | → manifests.id |
| branch_id | UUID FK | → branches.id |
| serie | TEXT | e.g., "T001" |
| correlativo | INTEGER | From PostgreSQL SEQUENCE |
| issue_date | DATE | |
| sunat_status | ENUM | PENDIENTE, ENVIADO, ACEPTADO, RECHAZADO, FAILED |
| xml_content_url | TEXT | |
| pdf_url | TEXT | nullable until ACEPTADO |
| ose_response_code | TEXT | nullable |
| ose_response_message | TEXT | nullable |
| created_at | TIMESTAMPTZ | |

### invoices
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK | → orders.id |
| branch_id | UUID FK | → branches.id |
| customer_id | UUID FK | → customers.id |
| document_type | ENUM | FACTURA, BOLETA |
| serie | TEXT | |
| correlativo | INTEGER | From PostgreSQL SEQUENCE |
| issue_date | DATE | |
| subtotal | NUMERIC(12,2) | Excluding IGV |
| igv_amount | NUMERIC(12,2) | subtotal × 0.18 |
| total | NUMERIC(12,2) | subtotal + igv_amount |
| sunat_status | ENUM | PENDIENTE, ENVIADO, ACEPTADO, RECHAZADO, FAILED, ANULACION_PENDIENTE, ANULADO |
| xml_content_url | TEXT | |
| pdf_url | TEXT | nullable |
| ose_response_code | TEXT | nullable |
| ose_response_message | TEXT | nullable |
| created_at | TIMESTAMPTZ | |

### credit_notes
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| invoice_id | UUID FK | → invoices.id (original invoice) |
| branch_id | UUID FK | → branches.id |
| reason_code | TEXT | SUNAT Catálogo N° 9, e.g., "07" |
| amount | NUMERIC(12,2) | |
| sunat_status | ENUM | WAITING_FOR_INVOICE, PENDIENTE, ENVIADO, ACEPTADO, RECHAZADO, FAILED, ANULACION_PENDIENTE, ANULADO |
| xml_content_url | TEXT | nullable until submission |
| pdf_url | TEXT | nullable |
| created_at | TIMESTAMPTZ | |

### cancellation_audit_log
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| document_id | UUID | references invoices.id or credit_notes.id |
| document_type | ENUM | FACTURA, BOLETA, NOTA_CREDITO |
| user_id | UUID FK | → auth.users |
| motivo | TEXT | min 15 characters |
| requested_at | TIMESTAMPTZ | |
| ose_status | TEXT | nullable — set when OSE confirms baja |
| ose_confirmed_at | TIMESTAMPTZ | nullable |

---

## 10. Open Questions / Risks

None. All decisions confirmed by the orchestrator before spec authoring. This spec is ready for the design phase.
