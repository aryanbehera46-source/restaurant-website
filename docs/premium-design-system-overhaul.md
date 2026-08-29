# Premium design system overhaul

## Scope

This pass changes presentation only. It does not change backend routes, database behavior, authentication, reservations, orders, KOTs, billing, payments, inventory, grocery, analytics, AI context, email, CORS, or security behavior.

## Root causes

- The customer stylesheet retained many fixed colors from the original dark-only design, including near-black heading and menu text that remained active after a theme switch.
- Typography was split between Georgia, Arial, system UI, and later Inter overrides, so each surface had a different hierarchy and rhythm.
- Admin contained a large embedded legacy stylesheet; Staff and Chef each had a separate embedded mini-system. The previous shared layer was only a small collection of broad `!important` overrides and did not define every semantic text, surface, status, or interactive state.
- Admin navigation was restyled as a horizontal strip without changing its application-shell behavior.
- Theme controls were injected consistently in JavaScript but lacked one fully specified responsive component contract.
- Print rules existed in both Admin and the shared layer, allowing themed content and modal styling to compete with receipt styling.

## Architecture after the pass

- `ui.css` is the shared semantic design-system layer used by Customer, Admin, Staff, and Chef.
- `ui.js` remains the single theme controller and preserves Light, Dark, and Auto behavior, including solar calculation, location fallback, system preference, and time-of-day fallback.
- Existing page markup and application scripts remain intact. The Admin shell is created from the existing header, navigation, and content structure; the shared script adds only the responsive drawer control and accessible current-page state.
- Legacy embedded styles remain as structural compatibility CSS, but the shared layer owns typography, semantic color, core components, application shell, responsive behavior, and printing.

## Typography

- Display: Playfair Display, weights 600–700, for restaurant identity and primary headings.
- UI/body: DM Sans, weights 400–700, for navigation, forms, tables, controls, labels, and body copy.
- System and Georgia fallbacks keep the product usable when web fonts are unavailable.

## Color system

Light theme uses warm off-white backgrounds (`#f6f3ed`), white surfaces, dark brown-black primary text (`#211c17`), and restrained bronze (`#8b5a19`). Dark theme uses near-black backgrounds (`#100f0e`), charcoal surfaces, warm white primary text (`#f7f3ed`), and gold (`#e0ad55`). Secondary and muted text remain deliberately legible in both modes. Success, warning, danger, and information each have semantic foreground and soft-surface tokens.

## Key behavior

- Customer hero and other editorial dark sections keep intentional light text in both themes; cards, menu names, descriptions, prices, navigation, and forms use semantic tokens.
- Admin uses a fixed left sidebar at desktop widths, a focused content canvas, and a dismissible drawer below 820px. Navigation is grouped into the existing six destinations, with Staff and Chef access separated at the bottom.
- Staff and Chef inherit the same cards, inputs, buttons, tables, status treatments, spacing, and typography as Admin.
- Exactly one Light / Dark / Auto control is injected at the bottom-right of every major page. At mobile width its label collapses, safe-area offsets apply, and its dimensions remain consistent.
- The receipt is forced to a light, print-safe document with a clear identity block, item table, aligned totals, and theme controls excluded.

## Verification contract

Check Customer home, signature/menu content, and reservation; Admin login and each application destination; Staff; Chef; and print receipt at 1440×900, 1024×768, and 390×844. Verify Light, Dark, and Auto, one theme control, zero page-level horizontal overflow, readable computed colors, clean console, 50 image mappings, and isolated functional regressions before deployment.
