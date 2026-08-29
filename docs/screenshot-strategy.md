# Day 18 Screenshot Strategy

Use a disposable local database or a separate demo environment. Never seed production for screenshots, never copy real customer details, and never publish credentials.

## Safe demo dataset

- Use fictional names and reserved example addresses such as `guest@example.com`.
- Create 6–8 reservations across lunch and dinner, with mixed New, Confirmed and Completed states.
- Attach multiple KOTs to at least two reservations and place them across New, Preparing, Ready and Served.
- Include one partial and one completed payment, two low-stock ingredients and two grocery follow-ups.
- Delete the disposable database after capture; do not copy it to `/var/data`.

## Capture set

1. Customer homepage and 50-item visual menu
2. Reservation form and persistent confirmation with ID/date/time/guests
3. Admin dashboard and actual-order analytics
4. Reservation detail with multiple orders/KOT states
5. Itemized billing, partial payment and printable receipt
6. Chef queue summary and KOT cards with instructions
7. Inventory warnings and grocery requirements
8. AI briefing showing expected reservations versus actual orders

Capture desktop at approximately 1440 px and one mobile view at approximately 390 px. Hide browser bookmarks, tokens, passwords, email addresses and private customer data. Prefer real interface states over mock overlays and label demo data as fictional in portfolio captions.
