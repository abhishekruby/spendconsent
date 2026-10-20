# Devpost submission draft (private — publishing needs the user's approval)

**Name:** SpendConsent
**Tagline:** An AI purchasing assistant that can't spend money you didn't approve.

## Inspiration

Owners of small service businesses (cleaning crews, studios, offices) reorder the
same supplies again and again: cloths, bin bags, spray bottles, notebooks. The
annoying part is not clicking "buy". It is checking that the size is right, that
the pack count gives exactly the quantity needed, and that the delivered total
including tax still fits the budget. AI agents could do this, but nobody wants
to give an agent a card when it might guess a size or round a price.

## What it does

You type a request in plain English. A local AI model turns it into structured
requirements by calling one catalog tool. The server compares every offer on its
full delivered cost, rejects offers with the wrong size or a pack count that
can't make the exact quantity, and asks you about anything you didn't say
instead of guessing. You review the exact cart (merchant, SKU, packs, tax,
delivery, total) and approve it. Checkout then runs through PayPal sandbox. The
server captures the order and reads it back from PayPal before it shows
"Payment confirmed". If the merchant's price changes after you approve, even
within your budget, your approval is revoked and you must review again.

## How we built it

- **AI:** Qwen3-4B (Q4_K_M) on llama.cpp, CPU only, on loopback. There is no
  hosted AI and no API key. The model makes one native tool call with a
  flat JSON schema. It copies numbers *as written*. Python code then keeps only
  values that appear in the buyer's own text, converts units and cents itself,
  and turns anything else into a question for the buyer.
- **PayPal:** Orders v2 (create, capture, independent GET read-back) and the
  JavaScript SDK v6 for buyer approval. Checkout is a persisted state machine:
  CREATING → AWAITING_BUYER → CAPTURING → VERIFYING → PAID, plus UNKNOWN,
  STOPPED and PAYMENT_REVIEW. It uses idempotent request IDs and never blindly
  retries an uncertain outcome.
- **Backend:** Django 5.2, DRF and PostgreSQL. Database triggers version
  offers. Approvals are immutable snapshots with a digest and a 5-minute expiry.
- **Frontend:** React, TypeScript and Vite. Keyboard accessible, with light and
  dark themes.

## Challenges

- The small model was bad at arithmetic: it turned "$60" into 6000 and 0.5 l
  into 5000 ml. We stopped asking it to convert anything. It copies what the
  buyer wrote, and code converts.
- llama.cpp ignored fields inside a `oneOf` tool schema. One flat schema fixed it,
  and also cut prompt size and latency.
- Real PayPal sandbox errors that mocks never showed:
  - `SHIPPING_OPTIONS_NOT_SUPPORTED`;
  - an SDK eligibility call failing in sandbox;
  - a sandbox business account outside the US rejecting USD
    (`UNSUPPORTED_PAYEE_CURRENCY`).

## Accomplishments

- Honest AI evaluation: seven suites of 20 outcomes each, run against the real
  application code. Several suites were written blind by a separate author. All
  failed runs are kept as evidence.
- A verified end-to-end sandbox purchase: AI comparison, exact approval, PayPal
  capture, independent read-back and stock decrement.

## What we learned

The safest place for an LLM in a payment flow is interpretation, not
calculation or authority. Each step gets one job, and each job can be checked.

## What's next

More merchants and carts with several items, receipts and reorders, and PayPal
Vault for returning buyers. Each would keep the same exact-approval rule.

## Built with

python, django, django-rest-framework, postgresql, react, typescript, vite,
llama.cpp, qwen3, paypal-orders-v2, paypal-js-sdk-v6

## Links (to fill after approval)

- Public repository: _pending user approval_
- Demo video (YouTube, < 3 min): _pending recording_ — script in docs/demo-script.md
