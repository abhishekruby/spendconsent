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

## Current session and next action (Claude, 22 Oct)

- Built: redesigned UI, sounds, live AI progress, owner approval links, purchases
  drawer, MCP server (agents shop, cannot approve/pay), Channel3 market check
  (user's free key in `.env`), savings insight, cart-mandate fingerprint,
  **Undo = owner-confirmed full PayPal refund within 7 days** (review PASS).
- **AI re-qualified after the refund change: report a01b9f9, 160/160**, warm
  medians 16–23 s (f7f75ab run kept: interrupted by a power-off).
- **Docker** one-command start verified end to end; **CI** green on GitHub.
- Agent-autonomous spending rules were started and parked in `git stash`
  ("spending-rule WIP"): Claude Code's safety classifier blocks agent-initiated
  purchases. Pitch instead: a person approves the exact cart (survey evidence in
  `docs/impact-evidence.md`). Judge audit: `docs/judge-audit.md`.
- Buyer-consent mode (cap $100) is how the API runs. Public/money steps need the
  user's approval.
- **Next:** user live-tests Undo; demo video (`docs/demo-script.md`), Devpost
  (`docs/submission-draft.md`), judge sandbox access, public repo, submit by 10 Nov.

## Known limits

Grounding checks number presence, not role. Run one API process (inference
lock). Untracked root dotfiles (`.bashrc`, `.mcp.json`...) are Claude sandbox
placeholders — never commit them.
