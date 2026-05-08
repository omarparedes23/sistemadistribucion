# Specifications Index — Sistema de Reparto

**Project**: reparto  
**Last Updated**: 2026-05-06  
**SDD Persistence**: engram  
**Status**: All specs DRAFT — ready for `/sdd-design`

---

## Files

| File | Module | Engram # | BRs | Scenarios |
|---|---|---|---|---|
| [00-project-context.md](00-project-context.md) | Stack, architecture, key decisions | #191, #192 | — | — |
| [01-core-domain-model.md](01-core-domain-model.md) | Masters, Inventory, Pricing, CRM, Orders | #195 | BR-CM-*, BR-INV-*, BR-PRC-001–008, BR-CRM-*, BR-ORD-*, BR-COL-001–008 | CM-01–04, INV-01–05, PRC-01–04, CRM-01–04, ORD-01–07 |
| [02-kardex-inventory.md](02-kardex-inventory.md) | Kardex, Weighted Average, Transfers | #198 | BR-KAR-001–045 | KAR-01–17 |
| [03-manifest.md](03-manifest.md) | Dispatch Manifest lifecycle | #200 | BR-MAN-001–052 | MAN-01–12 |
| [04-sunat-fiscal.md](04-sunat-fiscal.md) | GRE, Invoices, Credit Notes, Annulments | #220 | BR-SNAT-001–047 | SC-SNAT-001–015 |
| [05-collections.md](05-collections.md) | Collections, Daily Settlements | #222 | BR-COL-001–035 | SC-COL-001–012 |
| [06-pricing.md](06-pricing.md) | Price Lists, Discounts, Bonifications | #227 | BR-PRC-010–044 | SCN-PRC-001–014 |

---

## Dependency Map

```
01-core-domain-model  (base)
   ├── 02-kardex-inventory    (extends Module 2 — supersedes BR-INV-004/005/006)
   ├── 03-manifest            (supersedes Module 7 entirely)
   ├── 04-sunat-fiscal        (supersedes Module 8 entirely)
   ├── 05-collections         (extends Module 6 — supersedes BR-COL-001–008)
   └── 06-pricing             (extends Module 3 — supersedes BR-PRC-001–008)
```

---

## Key Decisions Summary

| Decision | Choice | Spec |
|---|---|---|
| Stock model | stock_actual + stock_reserved + stock_available (GENERATED) | 01 |
| Order state machine | DRAFT→PENDING→APPROVED→PROGRAMMED→EN_ROUTE→terminal | 01 |
| PARTIAL undelivered items | Option A: cancelled, RETURN movements, Credit Note | 01 |
| Kardex valuation | Promedio Ponderado (Weighted Average) | 02 |
| Kardex immutability | Append-only enforced at PostgreSQL trigger level | 02 |
| GRE scope | ONE per manifest (not per order) | 03, 04 |
| EN_ROUTE guard | Hard block until GRE sunat_status = ACEPTADO | 03, 04 |
| Manifest closure | System-triggered; independent of payment status | 03 |
| FAILED vs RECHAZADO | FAILED = infra error; RECHAZADO = SUNAT rejection | 04 |
| Credit Note submission | WAITING_FOR_INVOICE state; auto-submit on invoice ACEPTADO | 04 |
| Correlativo atomicity | PostgreSQL SEQUENCE per (branch, doc_type, serie) | 04 |
| Timezone | America/Lima for settlement_date; UTC storage | 05 |
| total_expected | Postgres trigger (not frontend) | 05 |
| invoice_id in collections | Mandatory; FIFO fallback if unselected | 05 |
| Reversals | Full Void only; no partial corrections in MVP | 05 |
| Discounts | Volume discounts only in MVP | 06 |
| SUNAT discount | DescuentoLinea explicit; not embedded in unit price | 06 |
| Bonifications | is_bonus flag + indicadorTransferenciaGratuita | 06 |
| Bonus Kardex | Moves at weighted_avg_cost (not invoice price 0) | 06 |

---

## Next Step

`/sdd-design` — SQL schema, Postgres functions for state machines, RLS policies, Edge Function contracts
