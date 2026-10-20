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
