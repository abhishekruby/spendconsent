# First verified PayPal sandbox purchase — 21 October 2026

Sandbox only, fictional goods, user consent given in chat for each exact cart
and amount before each one-time permission was written (then removed after use).

| Field | Value |
| --- | --- |
| Attempt | `eef29d8e…` → **PAID** (server-verified) |
| Cart | CLOTH-A, 4 packs × 10 = 40 cloths, total **USD 47.60** (items 36.00, delivery 8.00, tax 3.60) |
| States | CREATING 01:04:54 → AWAITING_BUYER 01:04:57 → CAPTURING 01:05:20 → VERIFYING 01:05:22 → PAID 01:05:23 IST |
| Capture | sandbox capture `22B63989RB170984H`; order read back and matched by the server |
| Stock | CLOTH-A 100 → 96 packs, no remaining hold |
| Path | real AI comparison → exact review → app approval → one-time permission → PayPal JS SDK v6 popup in Chrome → sandbox personal buyer approval → server capture + independent GET verification |

## Failures found on the way (all fixed or explained; no money moved)

1. `b9f38bd9` UNKNOWN: create rejected with `SHIPPING_OPTIONS_NOT_SUPPORTED`
   (shipping options + SET_PROVIDED_ADDRESS). Fixed in 3952acc/abaa49a; adapter
   now reports create validation issues definitively. Attempt left UNKNOWN for
   manual resolution (no order id; nothing captured).
2. SDK `findEligibleMethods` failed with clientId in sandbox → made advisory.
3. Browser pane blocks agent-opened popups → buyer step done in the user's Chrome.
4. `UNSUPPORTED_PAYEE_CURRENCY`: the original sandbox business account (India)
   could not receive USD. User created a US sandbox business account + app and
   updated `.env` privately. Attempt `0db00f4d` stays AWAITING_BUYER with an
   expired approval; capture is impossible.

## Recovery checks against the real sandbox — 21 Oct 2026, 03:17–03:22 IST

One user-consented purchase (consent typed via `authorize_sandbox_purchase`):
CLOTH-B, 2 packs × 20, **USD 41.80**, attempt `7c626969`, capture
`97F67458GU342961X`.

| Check | Observed |
| --- | --- |
| Double click "Start sandbox checkout" | 1 create POST, 1 attempt for the approval, 1 PayPal order (button disabled while busy; server idempotency covered by tests) |
| API restart while AWAITING_BUYER (21:50:08 UTC) | Attempt and order id persisted; flow continued on the same attempt |
| Page refresh mid-flow | Same attempt restored as "awaiting buyer" |
| Cancel in PayPal window | Client-side only (SDK onCancel); no server call, attempt unchanged — user-reported |
| Final payment | CREATING 21:49:04 → AWAITING_BUYER 21:49:08 → CAPTURING 21:51:57 → VERIFYING 21:51:59 → PAID 21:52:01 (UTC); 1 capture POST; CLOTH-B stock 98 (−2 packs) |

First consent attempt expired before the command was run; the command refused
an expired approval and nothing was written (as designed). Used permission
file deleted. Not yet exercised for real: API decline and timeout after request
transmission (covered by fake-transport tests only).
