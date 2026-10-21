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
- Model server `--parallel 2` (prefix cache): ~20–30 s per request.
- Independent reviews passed for every change through ef89dff (re-review PASS).

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
- **Operator commands:** `grant_ai_readiness <report>` (checks report + all
  hashed backend sources); `authorize_sandbox_purchase` (shows exact cart,
  person types the total, writes one-time permission; TTY only). Review PASS.
- README rewritten for judges; Devpost draft in docs/submission-draft.md.

## Current session and next action (Claude, 21 Oct 17:00 IST)

- Frontend redesigned (8512a26): journey tracker, honest AI loader, receipt
  review + stamp, payment track, light/dark, 375 px. Codex UI WIP preserved at
  `refs/codex-wip/frontend-2026-10-21`.
- Added: interface sounds (Web Audio, mute toggle), live AI progress
  (`GET /api/progress`: "Understood…" before the final call; agent.py unchanged),
  model warm-up at runserver start, background sync (focus, waiting states,
  approval expiry).
- **One AI call (eeb94c5), report 34ec5e1: 160/160**, warm medians 17–20 s;
  readiness granted. All 8 suites now exposed. Busy model queues 60 s; paid
  orders get Buy again + receipt download.
- **Week-1 build (21 Oct):** `scripts/run_demo.sh` one-command start; purchases
  drawer; **owner approval links** (requester → owner approves + pays one exact
  cart; review PASS). Demo script rewritten. Plan: wk2 Vault/Agent Toolkit,
  Channel3, usability; wk3 video, Devpost, public repo, submit by 10 Nov.
- **Buyer-consent mode** (`SPENDCONSENT_PAYPAL_CONSENT=buyer`, cap $100): the
  buyer's own unexpired in-app approval authorizes one sandbox order; default
  stays operator (typed permission). API currently runs in buyer mode.
- Popup cancel confirmed by the user (Codex note). Next: usability practice +
  timing (kit/practice pages from Codex), demo, submission — public/money steps
  need user approval.

## Known limits

Grounding checks number presence, not role. Run one API process (inference
lock). Untracked root dotfiles (`.bashrc`, `.mcp.json`...) are Claude sandbox
placeholders — never commit them.
