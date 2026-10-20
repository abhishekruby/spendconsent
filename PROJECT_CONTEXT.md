# SpendConsent — compact handoff

Updated 20 Oct 2026, 23:05 IST, by Claude Code. Claude and ChatGPT/Codex
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
- Independent reviews passed through 168eee7; 52ad168 review found two blockers,
  fixed in ef89dff; **re-review of ef89dff not completed** (reviewer hit limit).

## AI evidence (never pool, never erase failures)

- 9b459c6: 20, 18, unseen 16 → failed. 8b36b78: 20, 20, 17, blind 18 → failed.
- 2d1279b: 20, 20, exposed 16, exposed 20, blind 168eee7 20/20 → failed on an
  exposed suite (model unit arithmetic) — the reason for the as-written protocol.
- ef89dff partial: 20/20 + 15/15 then interrupted by session end (preserved).
- **Running now:** six suites, 120 outcomes, report
  `docs/evidence/ai-application-qualification-4158aba.json` (same sources as
  ef89dff; blind suite `unseen4` = ai-application-unseen-52ad168.json, unread by
  the implementer). Evaluator PID 12579, detached; ETA ~23:55 IST. Check:
  `python3 -c "import json;d=json.load(open('docs/evidence/ai-application-qualification-4158aba.json'));print(d['phase'],d['all_gates_passed'])"`.
  When complete: commit the report, then decide readiness.
- Readiness marker NOT granted; runtime AI and payments remain off.

## Live processes (detached; logs in .runtime/logs/)

Project PostgreSQL (`scripts/local_postgres.py --start`), model 127.0.0.1:11435
(`--parallel 2`, command in docs/ai-application-evaluation.md), Django
127.0.0.1:8000, Vite 127.0.0.1:5173. Reboot kills them; restart per READMEs.

## Next actions (in order)

1. Finish/commit the 4158aba report. If all six suites pass: get an independent
   re-review of ef89dff, then (with the user's OK) write
   `.runtime/backend/ai-ready.json` per `inference.ready()`. If not: preserve,
   diagnose exposed failures generally, new blind suite by a separate agent.
2. Restart API with `SPENDCONSENT_AI_ENABLED=1 SPENDCONSENT_PAYPAL_ENABLED=1`;
   run the real browser journey request → comparison → review → approval.
3. Changed-price demo: `.venv/bin/python backend/manage.py set_offer_price
   CLOTH-B <cents>` (CLI only; bumps version, blocks old review).
4. Ask the user for action-time consent to one exact sandbox purchase; the
   permission file `.runtime/backend/paypal-permission.json` only after an exact
   yes; the user signs in as the sandbox buyer. Verify read-back.
5. Usability study (docs/usability-evaluation.md), accessibility pass, demo
   video (draft docs/demo-script.md), public repo + Devpost — each needs approval.

## Known limits

Grounding checks number presence, not role. Run one API process (inference
lock). Untracked root dotfiles (`.bashrc`, `.mcp.json`...) are Claude sandbox
placeholders — never commit them.
