# Royal Table — Restaurant Operations Platform

## Problem

Restaurant reservations, kitchen communication, billing and stock planning are often split across calls, paper KOTs and disconnected spreadsheets. A reservation total alone cannot explain what a table ordered or give the kitchen a reliable live queue.

## Solution

Royal Table joins the customer booking flow to actual restaurant operations. Staff attach one or more itemized orders to a reservation, submit each as a KOT, and see the Chef advance it through a controlled workflow. The same order records produce the final bill, payment state, receipt and transaction analytics.

## Business value

- Gives Admin and Chef one shared operational truth without weakening role separation.
- Replaces unexplained manual totals with server-priced, itemized bills.
- Supports follow-on courses and partial payments found in real service.
- Separates expected reservation demand from actual dishes ordered.
- Surfaces stock and grocery risks beside the live kitchen workload.
- Creates a credible demonstration for restaurant owners without pretending to be a full POS.

## Engineering decisions

- Existing reservation and billing behavior was preserved through additive SQLite migrations.
- Menu prices and all adjustments are calculated on the server.
- Orders support immutable item-name and price snapshots while retaining menu relationships for future inventory work.
- Admin financial endpoints and Chef operational endpoints have distinct authorization.
- Production SQLite is mounted on persistent storage; no migrations recreate tables or renumber primary keys.

## Verification story

The golden workflow creates a reservation, adds multiple orders, rejects manipulated prices and invalid quantities, sends a KOT, rejects skipped states, completes kitchen service, applies billing adjustments, records partial then full payment, and verifies receipt totals and analytics. The earlier Day 17 security and operations suite runs independently as a regression gate.

## Presentation outline

1. Customer problem and connected workflow
2. Booking and confirmation experience
3. Admin reservation and multiple-order view
4. Chef KOT queues and operational context
5. Itemized billing, payments and receipt
6. Actual-order analytics and AI briefing
7. Architecture, security and persistent deployment
8. Commercial value and deliberately excluded scope
