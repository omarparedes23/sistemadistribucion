# Project Context — Sistema de Reparto

**Project**: reparto  
**Path**: D:\tempo\claudecode\reparto  
**Date**: 2026-05-06  
**SDD Persistence**: engram (topic: sdd-init/reparto, #191)

---

## Tech Stack

- **Framework**: Next.js App Router + TypeScript
- **Database**: Supabase (PostgreSQL + RLS + Realtime + Edge Functions / Deno)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Architecture Patterns

- All business logic in server components or Edge Functions — never in client
- RLS enforced at DB level, not just application layer
- Multi-branch, single legal company entity
- Global catalog (products, brands, categories) — branch-independent
- Local operations (inventory, prices, orders, manifests, collections) — branch-scoped

## Domain Overview

Sistema de reparto (distribution management) for a Peruvian FMCG company. Manages the full order-to-delivery-to-collection cycle across multiple operational branches.

### Core Modules

| Module | Scope | Spec File |
|--------|-------|-----------|
| Core Masters | Global catalog, branches, warehouses | 01-core-domain-model.md |
| Inventory / Kardex | Stock tracking, movements, transfers | 02-kardex-inventory.md |
| Pricing | Price lists, discounts, bonifications | 06-pricing.md |
| CRM | Customers, addresses | 01-core-domain-model.md |
| Orders | Order state machine | 01-core-domain-model.md |
| Collections | Payments, daily settlements | 05-collections.md |
| Distribution / Manifests | Dispatch manifest lifecycle | 03-manifest.md |
| SUNAT / Fiscal | GRE, invoices, credit notes, annulments | 04-sunat-fiscal.md |

## Key Architectural Decisions

### Stock Model
`stock_actual` + `stock_reserved` + `stock_available` (GENERATED ALWAYS AS `stock_actual - stock_reserved`, STORED)

### Order State Machine
`DRAFT → PENDING → APPROVED → PROGRAMMED → EN_ROUTE → DELIVERED | PARTIAL | REJECTED`  
`ANY (non-terminal) → CANCELLED` (admin only)  
Terminal states: DELIVERED, PARTIAL, REJECTED, CANCELLED

### GRE (Guía de Remisión Electrónica)
- ONE per manifest (not per order)
- Hard block: EN_ROUTE transition requires `sunat_status = 'ACEPTADO'`

### Kardex Valuation
Promedio Ponderado (Weighted Average) — append-only, 11 reason_codes, stock_transfers for inter-branch

### OSE / SUNAT
- All async via Edge Functions (Deno)
- `FAILED` ≠ `RECHAZADO` (infrastructure failure vs. SUNAT rejection)
- `WAITING_FOR_INVOICE` status for credit notes pending invoice acceptance

### Collections
- Vendedor-cobrador model (same person sells and collects)
- America/Lima timezone for settlement_date
- Postgres trigger maintains `total_expected`
- Full Void reversals only (no partial corrections)
- `invoice_id` mandatory on collection_items with FIFO fallback

### Pricing
- Volume discounts only in MVP
- SUNAT `DescuentoLinea` declared explicitly (not embedded in unit price)
- `is_bonus = true` flag + `indicadorTransferenciaGratuita` for bonifications

### Correlativo Atomicity
PostgreSQL SEQUENCE per `(branch_id, document_type, serie)` — prevents gaps and race conditions

## Testing Capabilities

- **Test Runner**: NOT FOUND (pre-scaffold state)
- **Strict TDD Mode**: Will activate after project scaffold
- **Quality Tools**: None detected yet

## Conventions

- Conventional commits only (no AI attribution)
- Never build after changes
- All monetary amounts: `NUMERIC(12,2)` in PEN
- Timestamps: UTC storage, America/Lima for business-day logic
- All tables: `branch_id` indexed, `created_at` + `updated_at` present
