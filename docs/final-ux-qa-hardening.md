# Royal Table final UX/QA hardening

Baseline: Day 18 production commit `198fd03a39744deb564ddf70d74a1390d4f80082`.

## Scope and architecture

This is the bounded final polish pass. Existing backend routes, database tables, authentication, authoritative pricing, payments, KOT workflow, and Day 1–18 features remain intact.

The former Admin page displayed reservations, analytics, menu management and operations in one continuous screen. It now opens on a concise Overview and exposes focused destinations for Reservations & Orders, Billing & Payments, Menu, Staff/Kitchen/Stock, and Analytics/AI. Existing proven controls remain in their original modules.

All Customer, Admin, Staff and Chef pages now share design tokens and a visible Light/Dark/Auto switch. Preference is stored locally. Auto uses a local sunrise/sunset calculation after the user selects Auto and location is available; otherwise it uses the system color preference, then a sensible time fallback. Print always renders a clean light itemized receipt.

## Controlled local QA matrix

- 10 realistic reservations, 14 itemized orders, including four reservations with multiple KOTs.
- Covers 1–12 guests and lunch/dinner times.
- KOT distribution: New 3, Accepted 3, Preparing 2, Ready 4, Served 2.
- Billing covers discounts from 0–15%, tax at 5/12%, service charge at 0/5/10%.
- Payment covers unpaid, partially paid and paid with Cash, Card, UPI and Other.
- Confirms server-authoritative item prices/totals, invalid CORS rejection, unauthenticated reservation/analytics rejection, public reservation rate limiting, analytics aggregation, theme inclusion and 50 local menu-image mappings.
- Uses a timestamped temporary database. Gmail is disabled. It creates no production records.

Run with `npm run test:final-qa` from `server/`.

## Browser checks

Customer, Admin, Staff and Chef surfaces were checked at 1440×900, 1024×768 and 390×844. No page-level horizontal overflow was found and the browser console remained clear. Light and Dark selection/persistence passed. Admin login error state remained usable and responsive.

## Regression checks

- `npm test`: Day 17 role, staff, inventory, grocery, kitchen task and AI safeguards pass.
- `npm run test:day18`: order editing, multiple KOTs, sequential kitchen transitions, billing/payment protections, analytics and AI context pass.
- `npm run test:final-qa`: controlled final matrix passes.
- JavaScript syntax and `git diff --check` pass.

Production deployment and verification must be recorded separately after the source commit is pushed and the service finishes deploying.
