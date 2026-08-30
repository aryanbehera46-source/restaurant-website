# Royal Table final UX/QA hardening

Baseline: Day 18 production commit `198fd03a39744deb564ddf70d74a1390d4f80082`.

## Scope and architecture

This is the bounded final polish pass. Existing backend routes, database tables, authentication, authoritative pricing, payments, KOT workflow, and Day 1–18 features remain intact.

The former Admin page displayed reservations, analytics, menu management and operations in one continuous screen. It now opens on a concise Overview and exposes focused destinations for Reservations & Orders, Billing & Payments, Menu, Staff/Kitchen/Stock, and Analytics/AI. Existing proven controls remain in their original modules.

All Customer, Admin, Staff and Chef pages share one restrained light customer/admin design language, while the Chef workspace retains its purpose-built dark operational surface. The former theme switch has been removed so presentation is consistent and predictable across demos. Print always renders a clean light itemized receipt.

## Controlled local QA matrix

- 10 realistic reservations, 14 itemized orders, including four reservations with multiple KOTs.
- Covers 1–12 guests and lunch/dinner times.
- KOT distribution: New 3, Accepted 3, Preparing 2, Ready 4, Served 2.
- Billing covers discounts from 0–15%, tax at 5/12%, service charge at 0/5/10%.
- Payment covers unpaid, partially paid and paid with Cash, Card, UPI and Other.
- Confirms server-authoritative item prices/totals, invalid CORS rejection, unauthenticated reservation/analytics rejection, public reservation rate limiting, analytics aggregation, shared UI inclusion and 50 local menu-image mappings.
- Uses a timestamped temporary database. Gmail is disabled. It creates no production records.

Run with `npm run test:final-qa` from `server/`.

## Browser checks

Customer, Admin, Staff and Chef surfaces were checked at 1440×900, 1024×768 and 390×844. No page-level horizontal overflow was found and the browser console remained clear. The Admin desktop sidebar and mobile drawer passed, and the authenticated Staff/Chef workspaces remained usable and responsive.

## Regression checks

- `npm test`: Day 17 role, staff, inventory, grocery, kitchen task and AI safeguards pass.
- `npm run test:day18`: order editing, multiple KOTs, sequential kitchen transitions, billing/payment protections, analytics and AI context pass.
- `npm run test:final-qa`: controlled final matrix passes.
- `npm run test:week-demo`: seven isolated service days, reservations, customer pre-orders, KOT stages, payments, Chef login, inventory, grocery and kitchen briefing pass.
- JavaScript syntax and `git diff --check` pass.

Production deployment and verification must be recorded separately after the source commit is pushed and the service finishes deploying.
