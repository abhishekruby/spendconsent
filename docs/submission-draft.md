# Devpost submission text

Paste each section into its Devpost field. Never add sandbox passwords to this file.

**Name:** SpendConsent

**Tagline:** AI shops. You decide. PayPal verifies.

**Video:** https://youtu.be/7zj3F00tqmI

**Try it:** https://spendconsent.ullagecloud.com

**Code:** https://github.com/abhishekruby/paypal-ai-hackathon-2026 (MIT)

## Inspiration

AI agents can already shop for you. Would you give one your card?

One major US retailer's terms now say purchases by an AI agent you approved "are
considered transactions authorized by you". In a June 2026 YouGov survey for ACI
Worldwide (2,080 UK adults), only 19% trusted AI to make everyday purchases, and
60% would stop using a shopping agent after one mistake. In RTB House's 2026 study
across four countries, approval before checkout was the most requested safeguard.

So we built an agent that does the shopping and cannot spend. Then we tried to break it.

## What it does

SpendConsent is for small teams where one person orders supplies and someone else pays.

1. **Say what you need.** "Exactly 40 microfiber cloths, 40 × 40 cm, under $60
   including delivery and tax." A self-hosted AI model reads it in about 14 seconds.
2. **Compare on the real delivered cost.** Code, not the AI, rules out wrong sizes
   and packs that can't make the exact quantity, then shows the cheapest offer that
   fits. Live retail prices from **Channel3** show whether the deal is fair.
3. **Approve the exact cart.** The owner gets a private link on their phone. Their
   approval is a fingerprint of that merchant, item, quantity and total. The
   requester's screen updates by itself.
4. **Pay with PayPal.** We call it paid only after our server captures the order and
   reads it back from PayPal: amount, payee and order must match.
5. **Cancel and refund.** A full PayPal refund for 7 days, verified the same way.

**Three ways we tried to make it spend the wrong money:**

- **Make it guess.** We left out the size. It asks instead.
- **Change the price.** We raised it one cent after approval. The approval was revoked.
- **Make the agent pay.** Any AI agent can use SpendConsent through MCP to find offers,
  prepare a cart and ask the owner. We called `pay`. The real answer:
  `Unknown tool pay.` No tool can approve or pay.

## How we built it

- **AI:** Qwen3-4B on llama.cpp, self-hosted on CPU, with no cloud AI. One native tool
  call per comparison. The model copies values as written; code keeps only numbers
  found in the buyer's own text and does all unit and money maths.
- **PayPal:** Orders v2 (create, capture, independent read-back), Payments v2 refunds
  and the JavaScript SDK v6, on a persisted state machine with idempotent requests.
  Uncertain outcomes stay "unknown" and are never retried blindly.
- **Channel3:** one product search per request, for real retail prices beside the offers.
- **Stack:** Django 5.2, DRF, PostgreSQL, React 19, TypeScript, and a standard-library MCP server.

## Proof

- **160/160** AI outcomes across 8 test suites, 6 written blind by a separate author,
  run against the real application. Earlier failed runs are kept in the repository.
- **151 automated tests:** 127 backend on real PostgreSQL (state machine, idempotency,
  races, stale approvals, refunds) and 24 frontend, run in CI.
- Verified PayPal sandbox purchases and a verified full refund, with evidence in the repository.

## Challenges we ran into

Making a small model reliable: early versions rounded prices or invented sizes, so we
moved every number out of its hands. PayPal edge cases too: an order left at
`PAYER_ACTION_REQUIRED` once stuck forever as "unknown" until we handled it properly.

## Accomplishments that we're proud of

An agent that is useful and structurally cannot pay, and a checkout that never says
"paid" without PayPal's own record.

## What we learned

"Can the AI buy it?" is easy. "Will people let it?" needs exact approvals, hard
limits and an easy refund.

## What's next for SpendConsent

Real supplier catalogs, approval by push notification, and spending limits for
low-risk reorders that keep cancel and refund.

## Built with

PayPal Orders v2 · PayPal Payments v2 · PayPal JavaScript SDK v6 · Channel3 · Model
Context Protocol · Qwen3-4B · llama.cpp · Django · Django REST Framework · PostgreSQL ·
React · TypeScript · Vite · Docker · Caddy · Google Cloud

## Testing instructions

Open https://spendconsent.ullagecloud.com (no sign-up). Sandbox only: test money,
fictional shop, nothing ships.

1. Tap a sample such as **40 microfiber cloths**, or type your own, then choose **Compare offers** (about 14 s). If it asks for a detail, answer it.
2. Choose **Review purchase**, tick the box and approve. To see the owner flow, open
   the approval link in a second browser or on your phone.
3. Pay in the PayPal window with this sandbox buyer:
   **[EMAIL AND PASSWORD: enter only in Devpost's testing field]**
4. Try to make it pay without approval.

To run it yourself: `docker compose up --build`, then open http://127.0.0.1:5173. See the README.
