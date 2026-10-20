# SpendConsent — compact handoff

Updated 20 October 2026, 21:00 IST, by Claude Code (Claude and ChatGPT/Codex now
alternate on this repo; read AGENTS.md, then this file). Earlier context:
PROJECT_CONTEXT_HISTORY.md and docs/progress.md.

## Scope and authorization

Unchanged: full [PRD](docs/PRD.md) — actual local AI, server-owned exact USD
totals, immutable human approval, one merchant/SKU, 16 fictional SKUs, one-time
USD, PayPal sandbox only. Zero cost, secrets, action-time financial consent and
no-publication boundaries remain. Private commits/pushes authorized; repo
verified PRIVATE today. Deadline 12 Nov 2026 noon PST (13 Nov 01:30 IST).

## What changed this session (commits a37ae31..HEAD, all pushed)

1. Root cause of every recent AI failure: the per-product `oneOf` tool schema
   made llama.cpp's grammar emit only `category`/`attributes`. Fixed with one flat
   schema (all five attribute keys nullable); server still rejects foreign specs.
2. `_grounded` in `backend/purchases/agent.py`: extracted quantity/budget/spec
   numbers must appear in buyer text (digits, number words, unit-adjacent metric
   conversion) or become unknown → buyer is asked. `$`/dollars → USD unless a
   foreign-dollar marker (C$, NT$, "Canadian dollars"...) is present. `0`/`""`
   attribute placeholders mean unset. Independently reviewed: PASS.
3. Model server now runs `--parallel 2` (same memory) so the extraction prefix
   stays cached: ~25–30 s per case instead of ~70 s. Command in
   docs/ai-application-evaluation.md (last sections).
4. Runner supports five suites (`scripts/ai_application_eval.py`); each blind
   suite is authored by a separate agent and becomes exposed once run.

## AI evidence (never pool, never erase failures)

- `...-a37ae31.json` invalid args; `...-199392d.json` timeout; `...-684afca.json`
  partial (10/10 then stopped for latency fix).
- `...-9b459c6.json`: original 20/20 (warm 23.7 s), regression 18/20, unseen
  16/20 → gate failed.
- `...-8b36b78.json`: 20/20, 20/20, exposed 808472c 17/20, blind a12decc 18/20.
- **Latest `...-2d1279b.json` (five suites, 100 outcomes):** original 20/20,
  regression 20/20, exposed 808472c **16/20**, exposed a12decc 20/20, **new blind
  168eee7 20/20**; every warm median 24–34 s (gate <60 s). `all_gates_passed`
  is false only because of exposed 808472c cases 03 (0.5-litre → model emits an
  invalid/decimal value) and 09 (model wrote 60000 cents for USD 60.00; grounding
  nulled it and asked the buyer). All four failures were safe: no wrong cart.
- Readiness marker NOT granted; runtime AI and payments remain off.

## Live processes (verify before restarting)

Project PostgreSQL (`scripts/local_postgres.py --start`), model on
127.0.0.1:11435 (`--parallel 2`), Django API on 127.0.0.1:8000, Vite on
127.0.0.1:5173. All started by Claude; a reboot kills them — restart with
backend/README.md, frontend/README.md and the model command above.

## Next actions (in order)

1. **User decision needed:** accept 2d1279b (96/100, blind 20/20, all failures
   safe) to grant the AI readiness marker, or require one more round. Do not
   write `.runtime/backend/ai-ready.json` without that decision.
2. Structural AI fix (recommended either way): the 4B model is unreliable at unit
   arithmetic. Change the tool to copy amounts as written — `budget` as the
   stated decimal amount, specification `value` + `unit` — and convert to cents/
   ml/cm in code. Then independent review, a NEW blind suite authored by a
   separate agent after the freeze, and a full re-qualification (all suites).
3. Once readiness is granted: restart the API with `SPENDCONSENT_AI_ENABLED=1
   SPENDCONSENT_PAYPAL_ENABLED=1`, run the real browser journey request →
   comparison → review → approval, then ask the user for action-time consent
   to one exact sandbox purchase (they sign in as the sandbox buyer themselves).
4. Then usability study, accessibility, demo video, submission prep.

## Remaining delivery

Browser journey, SDK and seller read-back, one user-approved sandbox purchase
(`.runtime/backend/paypal-permission.json` only after an exact yes), recovery,
usability study, accessibility, demo video, submission (each needs approval).

## Known limits

Grounding checks number presence, not role. Run one API process (inference
lock). Untracked root dotfiles (`.bashrc`, `.mcp.json`...) are Claude sandbox
placeholders — never commit them.
