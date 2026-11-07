# SpendConsent — compact handoff

Updated 21 Oct 2026, 17:00 IST, by Claude (after Codex `8390ffe`). Claude and ChatGPT/Codex
alternate on this repo: read AGENTS.md, then this file. Latest session summary:
docs/handoff-codex-2026-10-21.md. History:
PROJECT_CONTEXT_HISTORY.md, docs/progress.md, docs/ai-application-evaluation.md.

## Scope and authorization

Unchanged full [PRD](docs/PRD.md): actual local AI, server-owned exact USD
totals, immutable human approval, one merchant/SKU, 16 fictional SKUs, one-time
USD, PayPal sandbox only. Zero cost, secrets, action-time financial consent and
no-publication boundaries remain. Private pushes authorized; repo PRIVATE.
Deadline 12 Nov 2026 noon PST (13 Nov 01:30 IST).

## AI protocol now (backend/purchases/agent.py)

- One flat native tool schema (a per-product `oneOf` made llama.cpp drop fields).
- The model copies values **as written**: `budget` (e.g. 59.40), unit-free
  `width/height/capacity/volume`, `paper_size`, `size_unit`. `_grounded` keeps
  only values literally in the buyer text (digits/number words), takes each
  number's unit from the text right after it, converts to cents/cm/l/ml in code;
  anything else becomes unknown → buyer is asked. Whole-cent budgets only.
- Foreign-dollar markers never become USD; recurring phrases → unsupported.

## AI evidence (never pool, never erase failures)

- Failed runs kept: 9b459c6, 8b36b78, 2d1279b (model unit arithmetic → the
  as-written protocol), ef89dff partial.
- **4158aba (= ef89dff sources): ALL SIX SUITE GATES PASSED** — original 20/20,
  regression 20/20, exposed 808472c 18/20, a12decc 18/20, 168eee7 20/20, blind
  52ad168 18/20; warm medians 26–38 s, max 55.3 s.
- **AI readiness marker granted** (`.runtime/backend/ai-ready.json`, bound to
  the agent.py hash — any agent.py edit disables AI until re-qualified).
- **Real browser journey verified:** actual AI → offers → exact review →
  approval → `set_offer_price` → approval REVOKED → fresh AI → Review 2.
- **FIRST VERIFIED SANDBOX PURCHASE (PAID):** CLOTH-A USD 47.60, capture
  22B63989RB170984H, full state flow + independent read-back, stock 100→96.
  Evidence: docs/evidence/sandbox-purchase-2026-10-21.md. Fixes on the way:
  no shipping.options (SHIPPING_OPTIONS_NOT_SUPPORTED), definitive create
  declines, advisory SDK eligibility; `.env` now uses a **US** sandbox business
  account (India one gave UNSUPPORTED_PAYEE_CURRENCY). API runs with AI+PayPal on.
- **Operator commands:** `grant_ai_readiness <report>`; `authorize_sandbox_purchase` (TTY).

## Current session and next action (Claude, 22 Oct)

- Built: redesigned UI, sounds, live AI progress, owner approval links, purchases
  drawer, MCP server (agents shop, cannot approve/pay), Channel3 market check
  (user's free key in `.env`), savings insight, cart-mandate fingerprint,
  **Cancel order & refund = owner-confirmed full PayPal refund within 7 days** (review PASS).
- **AI re-qualified after the refund change: report a01b9f9, 160/160**, warm
  medians 16–23 s (f7f75ab run kept: interrupted by a power-off).
- **Docker** one-command start verified end to end; **CI** green on GitHub.
- Agent-autonomous spending rules were started and parked in `git stash`
  ("spending-rule WIP"): Claude Code's safety classifier blocks agent-initiated
  purchases. Pitch instead: a person approves the exact cart (survey evidence in
  `docs/impact-evidence.md`). Judge audit: `docs/judge-audit.md`.
- Buyer-consent mode (cap $100) is how the API runs. Public/money steps need the
  user's approval.
- **Next:** user live-tests Cancel & refund; demo video (`docs/demo-script.md`), Devpost
  (`docs/submission-draft.md`), judge sandbox access, public repo, submit by 10 Nov.

## Hosted demo (7 Nov)

https://spendconsent.ullagecloud.com (A record → 136.111.237.69, Namecheap) — Google Cloud free trial (user added card and paid
the ₹1,000 India prepayment; user-approved exception to zero-cost). VM `spendconsent`,
n2d-standard-4, us-central1-a, static IP; `compose.public.yaml` (Caddy HTTPS, 20/min
action limit). Deploy: `git archive HEAD | ssh … tar -x -C ~/spendconsent`, then
`docker compose --env-file deploy.env -f compose.yaml -f compose.public.yaml up -d --build`.
SSH key `.runtime/ssh/` (ignored). AI 13.8 s/comparison there. Review PASS after fixes.
Delete the VM after judging (15 Dec); never upgrade the billing account.

## Known limits

Grounding checks number presence, not role. Run one API process (inference
lock). Untracked root dotfiles (`.bashrc`, `.mcp.json`...) are Claude sandbox
placeholders — never commit them.
