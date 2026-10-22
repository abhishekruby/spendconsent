# Devpost submission draft (private — publishing needs the user's approval)

**Name:** SpendConsent
**Tagline:** AI agents can shop for you. SpendConsent makes sure they can't spend what you didn't approve.

## Inspiration

AI agents are learning to shop. But would you give one your PayPal?

Shoppers have answered. In a June 2026 YouGov survey for ACI Worldwide (2,080 UK
adults), 60% said they would stop using an AI shopping agent after one mistake,
and 70% said purchases made without asking would put them off. In RTB House's
2026 study across the US, UK, France and Japan, approval before checkout was the
single most requested safeguard, and a guaranteed return window made people far
more willing to give an agent a budget.

We took that literally. The agent does all the tedious work. A person approves
the exact cart. PayPal moves the money, and you can undo it.

Our test case is the small business that reorders the same supplies every month
(cloths, bin bags, spray bottles, notebooks). The hard part is not clicking "buy";
it is checking the size, making the pack count add up to exactly the quantity
needed, and keeping the delivered total, with tax, inside the budget.

## What it does

1. **Describe it in plain words.** "Exactly 40 microfiber cloths, 40 × 40 cm, under
   $60 including delivery and tax." A local AI model reads it; if something is
   missing it asks instead of guessing.
2. **Compare on the real delivered cost.** The server rules out wrong sizes and
   packs that can't make the exact quantity, and shows the cheapest offer that
   fits ("$5.80 less than the next"). Live US retail prices from **Channel3** show
   whether the supplier price is fair.
3. **Approve the exact cart.** Merchant, item, packs, tax, delivery, total. The
   approval is a *cart mandate*: a SHA-256 fingerprint of exactly that cart. Any
   later change, even one cent within budget, voids it. The person preparing the
   cart can send a one-cart approval link to the owner's phone.
4. **Pay with PayPal.** The server creates and captures the order, then reads it
   back from PayPal (amount, payee, order) before it says "Paid". Uncertain
   outcomes stay "unknown"; nothing is retried blindly.
5. **Undo for 7 days.** One tap issues a full PayPal refund, verified against the
   original capture.

**Any AI agent can use it.** SpendConsent is also an MCP server. Claude Desktop (or
any MCP client) can find offers, prepare the cart and ask the owner to approve it.
There is deliberately no tool to approve or pay: the approval link opens in the
owner's browser and never enters the agent's context.

## How we built it

- **AI:** Qwen3-4B (Q4_K_M) on llama.cpp, CPU only, on the user's machine: no
  hosted AI, no API key, no prompt data leaving the laptop. One native tool call
  per comparison. The model copies values as written; code keeps only numbers
  that appear in the buyer's own text and does all units and money maths.
- **PayPal:** Orders v2 (create, capture, independent read-back), Payments v2
  refunds, and the JavaScript SDK v6 for buyer approval. A persisted checkout state
  machine (CREATING → AWAITING_BUYER → CAPTURING → VERIFYING → PAID, plus UNKNOWN,
  STOPPED, PAYMENT_REVIEW) with idempotent request IDs; refunds have their own row
  and key, committed before the request.
- **Channel3:** one product search per request, filtered to the same size, to show
  real retail prices beside the offers and in the agent's answers.
- **Backend:** Django 5.2, DRF, PostgreSQL with database triggers that version
  offers; immutable reviews with digests and short expiries.
- **Frontend:** React 19 + TypeScript, no UI kit: a journey tracker, a receipt-style
  review with countdown and approval stamp, live AI progress, interface sounds,
  light/dark, phone layouts.
- **Agents:** a stdlib MCP server (`scripts/spendconsent_mcp.py`).

## Proof

- **AI quality:** 160/160 on eight test suites (six written blind by a separate
  author) run against the real application code. <!-- TODO: replace with the f7f75ab re-run result -->
- **Five usability tasks** through the real app: 5/5 correct, median 18.9 s.
- **122 backend tests** on real PostgreSQL (state machine, idempotency, races,
  stale approvals, refunds) and 17 frontend tests.
- **Real PayPal sandbox purchases** captured and verified; the bugs we hit (a
  closed popup, a disposed PayPal session) are documented and fixed.
- Every payment and permission change passed an independent security review.

## Challenges we ran into

Making a small local model reliable: early versions rounded prices or invented
sizes. We moved every number out of the model's hands, and kept every failed
evaluation run on record. Real PayPal edge cases: `PAYER_ACTION_REQUIRED`, closed
popups and background refreshes that silently cancelled an open PayPal session.

## Accomplishments we're proud of

An agent that is genuinely useful but provably can't overspend, and a checkout
that never claims "paid" without PayPal's own record.

## What we learned

Trust is the product. "Can the AI buy it?" is easy; "will people let it?" needs
exact approvals, hard limits, protected payment details and an undo.

## What's next

Spending rules for low-risk reorders (approve once within a limit, with undo),
real supplier catalogs, and approval by push notification.

## Built with

PayPal Orders v2 · PayPal Payments v2 (refunds) · PayPal JavaScript SDK v6 ·
Channel3 API · Model Context Protocol · Qwen3-4B · llama.cpp · Django · Django REST
Framework · PostgreSQL · React · TypeScript · Vite

## Testing instructions (for judges)

`docker compose up --build`, then open http://127.0.0.1:5173 (first start downloads
the 2.5 GB model once). Without PayPal credentials the app runs and says payment is
off. <!-- TODO: sandbox buyer login + PayPal sandbox app credentials via the private testing field -->

Sandbox only: fictional shop, test money, nothing ships.
