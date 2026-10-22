# SpendConsent

[![tests](https://github.com/abhishekruby/paypal-ai-hackathon-2026/actions/workflows/ci.yml/badge.svg)](https://github.com/abhishekruby/paypal-ai-hackathon-2026/actions/workflows/ci.yml)

**An AI purchasing assistant that can't spend money you didn't approve.**

A small-business owner types what they need ("exactly 40 microfiber cloths,
40 × 40 cm, under $60 including delivery and tax, one-time"). A local AI model
reads the request and calls one catalog tool. The server compares offers on the
full delivered cost and shows an exact cart (merchant, SKU, packs, tax, delivery,
total). The owner approves that exact cart. Then PayPal sandbox checkout runs, and
success is shown only after the server verifies the captured order against what
was approved.

Built for the PayPal AI Hackathon 2026. Sandbox only; fictional catalog.

## Why

Buying routine supplies means checking sizes, pack counts and the real delivered
price across options. AI shopping agents could do that work, but a buyer can't
hand one money if it might guess a size, convert a currency, or buy the wrong
pack. SpendConsent splits the job: **AI interprets, code checks and calculates,
the human approves the exact cart, PayPal moves the money.**

## How it works

| Step | Who | What is enforced |
| --- | --- | --- |
| Understand the request | Local Qwen3-4B (llama.cpp, CPU) via one native tool call | The model copies values *as written*; code keeps only numbers literally in the buyer's text, converts units and cents itself, and asks the buyer about anything missing or ambiguous |
| Compare | Server | Exact spec and individual-unit quantity, full delivered total within budget, USD and one-time only; rejected offers say why |
| Review | Server | Immutable snapshot + digest, 5-minute expiry |
| Approve | Buyer, in the app | Binds that exact cart. Any later price or offer change revokes it, even within budget |
| Pay | PayPal Orders v2 + JS SDK v6 (sandbox) | Server creates and captures the order, then reads it back independently (amount, currency, payee, order) before showing "Payment confirmed". Uncertain outcomes stay UNKNOWN; nothing is retried blindly |
| Undo | PayPal Payments v2 refund, owner-confirmed, 7 days | One full refund per purchase with its own idempotency key; verified against the original capture; stock returned once |

## Evidence

- **AI:** eight suites × 20 outcomes against the real application code, six of
  them written by a separate author who never shared them before inference.
  Current qualified run [a01b9f9](docs/evidence/ai-application-qualification-a01b9f9.json):
  **160/160** (gate: ≥ 18/20 per suite), one model call per comparison, warm
  medians 16–23 s on a laptop CPU. Earlier failed runs are kept; see
  [AI evaluation](docs/ai-application-evaluation.md).
- **PayPal sandbox:** a real end-to-end purchase (USD 47.60, captured, read back,
  stock decremented), with the problems found on the way:
  [sandbox purchase evidence](docs/evidence/sandbox-purchase-2026-10-21.md).
- **Tests:** 100+ backend tests on real PostgreSQL (checkout state machine,
  idempotency, concurrency, stale approvals) and frontend unit tests.

## Run it locally

### Quickest: Docker (one command)

Needs Docker, about 8 GB RAM and 6 GB of disk. The first start downloads and
hash-checks the 2.5 GB model once; the app then switches its AI on from the
committed qualification report.

```bash
docker compose up --build        # then open http://127.0.0.1:5173
```

PayPal sandbox checkout stays off (the app says so) until you add sandbox keys:
copy `.env.example` to `.env` (`chmod 600`), fill the `PAYPAL_*` values for a US
sandbox business app, and uncomment the `.env` line in `compose.yaml`.

### Without Docker

Tested on Ubuntu x86-64 with Python 3.12 + [uv](https://docs.astral.sh/uv/),
PostgreSQL 16 binaries, Node 22, about 3 GB of disk for the model and 8 GB of RAM.
Everything is free and runs on loopback.

**After the one-time setup below, one command starts everything** (database,
local AI, API, web app) and prints what is ready:

```bash
scripts/run_demo.sh          # start · scripts/run_demo.sh stop · scripts/run_demo.sh status
```

1. **Backend and database:** follow [backend/README.md](backend/README.md)
   (creates `.venv`, an isolated project PostgreSQL, migrations and tests).
2. **Model:** download and verify llama.cpp b11696 and Qwen3-4B Q4_K_M as in
   [docs/ai-feasibility.md](docs/ai-feasibility.md) (Current 4B setup), then start
   the server with the command in [docs/ai-application-evaluation.md](docs/ai-application-evaluation.md).
3. **Enable AI** for the qualified adapter (or rerun the qualification yourself
   with `scripts/ai_application_eval.py`):
   ```bash
   .venv/bin/python backend/manage.py grant_ai_readiness docs/evidence/ai-application-qualification-a01b9f9.json
   ```
4. **PayPal sandbox:** create a sandbox REST app on a **US** sandbox business
   account (see [docs/sandbox-setup.md](docs/sandbox-setup.md)). Copy
   `.env.example` to `.env` (owner-only, `chmod 600`) and fill the four
   `PAYPAL_*` values with `PAYPAL_ENV=sandbox`. Never commit `.env`.
5. **Start the API and the app** (`SPENDCONSENT_PAYPAL_CONSENT=buyer` lets the
   buyer's own in-app approval authorize one sandbox order, capped at $100; leave
   it out for strict mode, where a person must also run the consent command below):
   ```bash
   SPENDCONSENT_AI_ENABLED=1 SPENDCONSENT_PAYPAL_ENABLED=1 SPENDCONSENT_PAYPAL_CONSENT=buyer .venv/bin/python backend/manage.py runserver 127.0.0.1:8000 --noreload
   ```
   Then follow [frontend/README.md](frontend/README.md) (`npm ci`, `npm run dev`)
   and open http://127.0.0.1:5173.
6. **Buy:** use the sample request → compare → review → approve → start sandbox
   checkout, then approve with a sandbox **personal** account in the PayPal
   window. (Strict mode only: before checkout, give the one-time consent in a
   terminal with `.venv/bin/python backend/manage.py authorize_sandbox_purchase`,
   which shows the cart and asks you to type the total.)

### Real-world price check (Channel3, optional)

With a free [Channel3](https://trychannel3.com/developers) key in `.env`
(`CHANNEL3_API_KEY`, no card needed), each comparison also shows up to five live
US retail listings for the same item and how the best supplier offer compares
per unit. One search per request; informational only, never part of the cart.

### Let any AI agent shop through it (MCP)

[`scripts/spendconsent_mcp.py`](scripts/spendconsent_mcp.py) is a stdlib MCP server.
Claude Desktop, Claude Code or any other MCP client can `find_offers`,
`prepare_cart`, `request_owner_approval` and check `purchase_status`. There is
no tool to approve or pay: the approval link opens in the owner's browser, and
its token never enters the agent's context (an agent that also has shell access
as the same user could still read the browser's command line). Add to the client's MCP config:

```json
{"mcpServers": {"spendconsent": {"command": "python3", "args": ["/path/to/repo/scripts/spendconsent_mcp.py"]}}}
```

Without step 3 or 4 the app still runs and says honestly that AI or payment is
unavailable; it never fakes a result. To demo a changed price:
`.venv/bin/python backend/manage.py set_offer_price CLOTH-B 2050`.

## Limits

One fictional merchant and 16 sample SKUs; one item per cart; USD one-time
purchases only; sandbox only. The grounding check verifies that a number appears
in the buyer's text, not its role, so the exact review remains the final check.
Model latency is about 15–20 s per comparison on CPU. No usability claim is made yet.

## Repository map


`backend/` Django 5.2 + DRF + PostgreSQL (authority, checkout, PayPal adapter,
AI adapter in `purchases/agent.py`) · `frontend/` React + TypeScript + Vite ·
`scripts/` qualification runner, PostgreSQL helper, sandbox OAuth check ·
`docs/` [PRD](docs/PRD.md), [system design](docs/system-design.md),
[PayPal runtime](docs/paypal-runtime-plan.md), [progress log](docs/progress.md),
[evidence](docs/evidence/) · `PROJECT_CONTEXT.md` current status and handoff ·
`AGENTS.md` rules for the coding agents that built this.

## License

[MIT](LICENSE). Model and runtime licenses are recorded in
[docs/ai-feasibility.md](docs/ai-feasibility.md).
