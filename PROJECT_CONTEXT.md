# SpendConsent — compact handoff

Updated 21 Oct 2026, 00:30 IST, by Claude Code. Claude and ChatGPT/Codex
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

- 9b459c6: 20, 18, unseen 16 → failed. 8b36b78: 20, 20, 17, blind 18 → failed.
- 2d1279b: 20, 20, exposed 16, exposed 20, blind 168eee7 20/20 → failed on an
  exposed suite (model unit arithmetic) — the reason for the as-written protocol.
- ef89dff partial (session end) preserved.
- **4158aba (= ef89dff sources): ALL SIX SUITE GATES PASSED** — original 20/20,
  regression 20/20, exposed 808472c 18/20, a12decc 18/20, 168eee7 20/20, blind
  52ad168 18/20; warm medians 26–38 s, max 55.3 s.
- **AI readiness marker granted** (`.runtime/backend/ai-ready.json`, bound to
  the agent.py hash — any agent.py edit disables AI until re-qualified).
- **First real browser journey verified (API with `SPENDCONSENT_AI_ENABLED=1`
  only):** sample request → actual AI 35.7 s → CLOTH-B $41.80 / CLOTH-A $47.60 →
  exact review → app approval → `set_offer_price` → approval shown REVOKED,
  checkout disabled → re-confirm → fresh AI 24.7 s at $45.43 → Review 2
  (quote v2). Fix d46bdda: stale approvals now display as REVOKED. CLOTH-B
  price restored (quote version 3).
- PayPal runtime still OFF: enabling `SPENDCONSENT_PAYPAL_ENABLED` was denied by
  the auto-mode safety check; it needs the user's explicit go-ahead.

## Live processes (detached; logs in .runtime/logs/)

Project PostgreSQL (`scripts/local_postgres.py --start`), model 127.0.0.1:11435
(`--parallel 2`, command in docs/ai-application-evaluation.md), Django
127.0.0.1:8000, Vite 127.0.0.1:5173. Reboot kills them; restart per READMEs.

## Next actions (in order)

1. **User:** approve enabling the PayPal sandbox runtime, then give concrete
   consent for one exact sandbox purchase (approval id + amount). Only then write
   `.runtime/backend/paypal-permission.json`; the user signs in as sandbox buyer.
   Verify SDK load, capture and server read-back; then recovery checks.
2. Next AI round (batch, then re-qualify with a NEW blind suite): pass
   `recommended_offer_id` to the final call (52ad168-01 copied the 3rd offer);
   >1 paper size in text → unknown (a12decc-08); unitless number with several
   fitting units → unknown; drop category when buyer says "not notebooks".
3. UI polish: "One-time purchase." is duplicated on the review card; consider
   hiding a superseded review once a newer one exists.
4. Usability study, accessibility pass, demo video (docs/demo-script.md),
   public repo + Devpost — each needs user approval.

## Known limits

Grounding checks number presence, not role. Run one API process (inference
lock). Untracked root dotfiles (`.bashrc`, `.mcp.json`...) are Claude sandbox
placeholders — never commit them.
