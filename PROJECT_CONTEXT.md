# SpendConsent — compact handoff

Updated 21 Oct 2026, 02:50 IST, by Claude Code. Claude and ChatGPT/Codex
alternate on this repo: read AGENTS.md, then this file. History:
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
- **AI round 2 (in progress):** e069354 + review fixes eaaa3f9 (review PASS):
  final call gets `recommended_offer_id`; undecided/negated paper size, bare
  size among several units → asked; "labels, not notebooks" → NO_MATCH. New
  blind suite e069354 (unseen5) by a separate author. Qualification run on
  92fe770 → `docs/evidence/ai-application-qualification-92fe770.json`, log
  `.runtime/logs/qualify-92fe770.log` (7 suites, 140 outcomes). **AI readiness
  is OFF until it passes** (marker bound to agent.py hash). If it fails: keep
  the report, do not tune on unseen5; fallback = restore agent.py from 4158aba
  (marker hash matches again).

## Live processes (detached; logs in .runtime/logs/)

Project PostgreSQL (`scripts/local_postgres.py --start`), model 127.0.0.1:11435
(`--parallel 2`, command in docs/ai-application-evaluation.md), Django
127.0.0.1:8000, Vite 127.0.0.1:5173. Reboot kills them; restart per READMEs.

## Next actions (in order)

1. Finish AI round 2: read the 92fe770 report; if all 7 gates pass, write
   `.runtime/backend/ai-ready.json` with the new agent.py hash, restart the API
   with AI on, record evidence, mark unseen5 exposed.
2. Recovery checks against the real sandbox (cancel in popup, refresh mid-flow,
   double click), each with fresh user consent. Leftover attempts b9f38bd9 /
   0db00f4d are documented and cannot capture; left as is.
3. Usability study (docs/usability-evaluation.md, needs real participants),
   demo video (docs/demo-script.md), public repo + Devpost — each needs user
   approval. Accessibility spot check (R11) passed 21 Oct; UI duplicate fixed;
   only the current review is shown, so no superseded-review work is needed.

## Known limits

Grounding checks number presence, not role. Run one API process (inference
lock). Untracked root dotfiles (`.bashrc`, `.mcp.json`...) are Claude sandbox
placeholders — never commit them.
