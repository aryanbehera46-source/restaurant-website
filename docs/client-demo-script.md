# Royal Table — 5-Minute Client Demo

## 0:00–0:40 — Customer booking

“Royal Table starts with a polished customer site and a visual 50-item menu. I’ll request a table; the system checks slot capacity and keeps a confirmation with the reservation ID, date, time and guest count visible until the customer closes it. Matching emails can go to the customer and restaurant.”

## 0:40–1:30 — Admin and real orders

“In Admin, the reservation appears with its customer and service context. Instead of typing an unexplained final bill, staff build an order from active menu items. The server retrieves each price. A table can place a second order later, so starters, mains and dessert remain separate KOTs but roll into one reservation total.”

## 1:30–2:25 — Chef operations

“Submitting an order sends a KOT to the separate Chef portal. The Chef sees New, Accepted, Preparing and Ready queues, quantities, item notes, kitchen instructions, guest count and reservation context. Statuses can only move forward in sequence, so the shared service state stays reliable.”

## 2:25–3:20 — Billing and payment

“Back in Admin, each order is itemized. Discount, tax and service-charge percentages are configurable, while every amount and the grand total are calculated by the server. The restaurant can record Cash, Card, UPI or Other payments, including partial payment, and print a clean browser receipt.”

## 3:20–4:15 — Analytics and kitchen intelligence

“The dashboard now distinguishes actual orders from reservation forecasts. It shows orders today, billed revenue, payments received, outstanding balance, AOV, top dishes and top category. The kitchen briefing combines expected covers with live KOT counts, dish quantities, low stock, grocery requirements and preparation tasks, and remains read-only.”

## 4:15–5:00 — Credibility and close

“The product uses role-restricted JWT sessions, parameterized SQL, validated state transitions, server-authoritative pricing and persistent deployed storage. It deliberately avoids unnecessary POS hardware, payment gateways and multi-branch scope. For a restaurant, this means one understandable flow from booking to kitchen to bill—and a strong base for the next paid customization.”
