# Royal Table

Royal Table is a full-stack restaurant reservation and operations platform. It connects the customer booking journey to the restaurant's live workflow: reservations, multiple orders and kitchen tickets, Chef queues, itemized billing, partial payments, analytics, inventory, grocery planning, staff access, and a read-only kitchen briefing assistant.

## Live demo

- Customer website: https://aryanbehera46-source.github.io/restaurant-website/
- API health: https://royal-table-api.onrender.com/
- Admin and Chef areas use role-restricted accounts; credentials are never published.

## Product workflow

`Reservation → Order(s) → KOT(s) → Chef status → Itemized bill → Partial/full payment → Receipt → Analytics`

One reservation can have several orders. Each submitted order becomes a KOT and moves through `New → Accepted → Preparing → Ready → Served`. Prices and monetary totals are calculated by the server from the active menu, not trusted from the browser.

## Features

- Customer reservation capacity checks and matching customer/restaurant email notifications
- 50-item menu with 50 images, search, category and availability management
- Admin reservation, menu, staff, order, billing, analytics and operations workspace
- Separate Chef portal with live status queues, dish quantities, instructions, guest context and preparation tasks
- Itemized discount, configurable tax and service charge, grand total and printable browser receipt
- Cash, Card, UPI and Other payment recording with unpaid, partially paid and paid lifecycle
- Actual-order metrics: orders, billed and paid revenue, AOV, top dishes and top category
- Inventory, stock adjustments, grocery requirements and kitchen task context
- Rate-limited, read-only kitchen briefing using reservations, actual orders, KOTs, inventory and grocery data

## Architecture

- Frontend: semantic HTML, CSS and browser JavaScript served by GitHub Pages
- API: Node.js and Express on Render
- Data: SQLite via prepared statements; production uses `/var/data/restaurant.db`
- Authentication: short-lived JWT sessions with separate Admin and Staff/Chef audiences
- Email: Nodemailer with Gmail configuration supplied only through deployment secrets

## Security and data integrity

- Server-authoritative menu prices and bill calculations
- Parameterized database queries and validated quantities, roles, states and monetary rates
- Role separation for Admin financial actions and Chef kitchen actions
- Sequential KOT state enforcement and overpayment protection
- Safe additive migrations; production data and primary keys are never recreated or renumbered
- CORS allowlist, rate limits and environment-only secrets

## Local setup

1. Install dependencies in `server/` with `npm install`.
2. Configure the variables documented in `.env.example` or the deployment dashboard. Never commit real secrets.
3. Start the API with `npm start` from `server/`.
4. Run `npm test`, `npm run test:day18`, `npm run test:final-qa`, and `npm run test:week-demo`.

### Local seven-day demo data

From `server/`, run `npm run seed:local-week` only when the configured `DB_PATH` points to a disposable local database. It creates a seven-day reservation, order, KOT, payment, inventory, grocery, task, and Chef-access demonstration. The seed refuses production mode, Render, and `/var/data` databases; it sends no email and must never be used against the live database.

## Deployment

The frontend deploys from `main` to GitHub Pages. The backend uses `render.yaml` and a persistent Render disk mounted at `/var/data`; `DB_PATH` must resolve to `/var/data/restaurant.db`. Create or reset Chef credentials inside authenticated Admin Staff Management, then share them privately and rotate temporary passwords.

## Portfolio and demo

See [Day 18 case study](docs/day18-case-study.md), [screenshot strategy](docs/screenshot-strategy.md), and [5-minute client demo](docs/client-demo-script.md).

## Deliberate future scope

Online gateways, POS hardware, waiter applications, QR ordering, payroll, multi-branch operations, supplier ordering and full recipe costing are intentionally outside this release.
