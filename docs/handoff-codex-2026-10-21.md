# Handoff to Codex — Claude Code session, 20–21 Oct 2026

Read `AGENTS.md`, then `PROJECT_CONTEXT.md` (current state, under 600 words).
This file summarizes what Claude Code did from 20 Oct 16:00 to 21 Oct 03:30 IST
(commits 721ddae → fc8dddb, all pushed to the **private** repo). Deadline:
12 Nov 2026 noon PST = 13 Nov 01:30 IST.

## Status in one line

**The product works end to end and all software gates are met.** That means
actual AI (qualified 140/140), exact human approval, two verified PayPal sandbox
payments and the real-sandbox recovery checks. What remains is human work:
the usability study, the demo video, and publishing/submission (each needs
the user's approval).

## What was done

### 1. Actual AI qualified (`backend/purchases/agent.py`)
- **Flat tool schema.** llama.cpp dropped fields inside a `oneOf` tool
  schema. One flat schema fixed that and cut latency.
- **Model server.** It runs with `--parallel 2` so the prompt prefix stays
  cached: about 25–30 s per request instead of about 70 s.
- **As-written protocol.** The model copies the budget and sizes exactly as
  the buyer wrote them, unit-free, plus `size_unit`. `_grounded()` keeps only
  numbers literally present in the buyer text, takes each number's unit from
  the text right after it, and converts to cents/cm/l/ml in code. Anything
  else becomes unknown and the buyer is asked.
- **Round 2** (e069354 + eaaa3f9):
  - the final call gets `recommended_offer_id`;
  - an undecided or negated paper size is asked ("A4 or A5", "not A5" handled);
  - a bare size among several written units is asked;
  - an explicitly excluded product ("labels, not notebooks") becomes NO_MATCH.
- **Evidence.** Report `docs/evidence/ai-application-qualification-92fe770.json`
  has **7 suites × 20, every suite 20/20**, warm medians 20–32 s, max 44 s.
  Five suites (unseen…unseen5) were authored by separate agents and run
  blind. Earlier failed reports are preserved (9b459c6, 8b36b78, 2d1279b,
  partials). Details are in `docs/ai-application-evaluation.md`.
- **Readiness marker.** `.runtime/backend/ai-ready.json` is bound to the
  agent.py hash, so **any agent.py edit disables AI** until re-qualified. All
  existing suites are now exposed: the next agent.py change needs a **new
  blind suite** written by a separate agent, which the implementer must not
  read before inference.

### 2. PayPal sandbox purchases verified
- **Fixes found against the real sandbox.**
  - `SHIPPING_OPTIONS_NOT_SUPPORTED`: removed `shipping.options`.
  - PayPal create 400/422 issue codes now stop an attempt definitively;
    others stay UNKNOWN.
  - SDK `findEligibleMethods` is advisory.
  - The India sandbox business account caused `UNSUPPORTED_PAYEE_CURRENCY`;
    the user created a **US** sandbox business account and app and updated
    `.env` privately.
- **Purchase 1.** CLOTH-A USD 47.60, capture 22B63989RB170984H.
- **Purchase 2 + recovery checks.** CLOTH-B USD 41.80, capture
  97F67458GU342961X:
  - a double click produced 1 order;
  - an API restart and a page refresh mid-flow continued on the same attempt;
  - after that, PAID once.

  Cancel in the popup is user-reported only: the client closes it with no
  server call, and the user has not yet confirmed it.

  Evidence: `docs/evidence/sandbox-purchase-2026-10-21.md`.
- **Leftover attempts.** b9f38bd9 (UNKNOWN, no order) and 0db00f4d (expired)
  are documented, cannot capture, and are left as they are.

### 3. New operator commands (CLI only, independently reviewed)
- `manage.py grant_ai_readiness <report.json>` writes the AI marker only if
  the report is complete, all gates passed, and every hashed backend source
  is unchanged.
- `manage.py authorize_sandbox_purchase` shows the newest valid approval's
  exact cart. The **person types the total** (TTY required). It then writes
  the one-time permission (create+capture, expires with the approval) and
  refuses expired or stale approvals.
- `manage.py set_offer_price SKU cents` changes a price to demo the revoked
  approval.

### 4. Product, UI and docs
- **Stale approvals.** An approval whose offer changed now shows REVOKED.
- **New request after a purchase.** A new request is allowed after
  PAID/STOPPED; uncertain states still block (`canStartNew` in
  `frontend/src/logic.ts`).
- **Review card.** The duplicated "One-time purchase." text is fixed.
- **Accessibility spot check (R11) passed:**
  - contrast ≥ 5.5:1;
  - every control labeled;
  - skip link and visible focus;
  - no horizontal scroll at 375 px.
- **`README.md`** is rewritten for judges: pitch, how it works, evidence, a
  6-step local run, and limits.
- **Drafts:**
  - Devpost draft: `docs/submission-draft.md`
  - demo script: `docs/demo-script.md`
  - usability kit: `docs/usability-kit.html` (printable participant sheet,
    observer timing sheet and answer key)
  - agent rehearsal: 5/5 tasks matched the key (not a usability result)

## Checks (all passing at fc8dddb)

```bash
.venv/bin/python backend/manage.py test purchases --keepdb --noinput   # 102 tests
.venv/bin/python scripts/ai_application_eval.py --self-test             # offline
cd frontend && npm test && npm run build
```
Django tests need the project PostgreSQL socket. In a sandbox they may need
to run unsandboxed.

## Live processes (detached; logs in `.runtime/logs/`)

- Project PostgreSQL (`scripts/local_postgres.py --start`)
- llama-server on 127.0.0.1:11435 (command in `docs/ai-application-evaluation.md`)
- API: `SPENDCONSENT_AI_ENABLED=1 SPENDCONSENT_PAYPAL_ENABLED=1 .venv/bin/python backend/manage.py runserver 127.0.0.1:8000 --noreload`
- Vite on 127.0.0.1:5173

A reboot kills all of them. Restart the API after any backend edit (it runs
with `--noreload`). Stop it only with the anchored pattern
`pkill -f "^\.venv/bin/python backend/manage.py runserver"`. An unanchored
pattern can kill your own shell.

## What is left (in order)

1. **Usability study (needs real people, run by the user).** Print
   `docs/usability-kit.html` and time 2–5 participants: manual vs app, 5 tasks.
   Enter results in `docs/usability-evaluation.md`. The target is ≥ 30% lower
   median active time with no extra errors. Report honestly even if it fails.
2. **Ask the user whether they closed the PayPal popup** before paying in the
   recovery test. If not, mark cancel "not yet exercised" in the evidence file.
3. **Demo video, under 3 min** (`docs/demo-script.md`), recorded by the user.
   Uploading to YouTube needs approval.
4. **Public repo + Devpost submission:** user approval for each.
   - Before going public: check `git status`, and that no secrets or `.env`
     are tracked.
   - Untracked root dotfiles (`.bashrc`, `.mcp.json`, `.profile`, …) are tool
     placeholders: **never commit them**.
   - Recheck the official rules and eligibility near the deadline.
5. **Optional, only if time allows:** more AI hardening (needs a new blind
   suite), and the API-decline and timeout cases against the real sandbox
   (currently covered by fake-transport tests).

## Rules that bit us (keep following them)

- **Money steps.**
  - Never write `paypal-permission.json` by hand.
  - The user runs `authorize_sandbox_purchase` and types the total.
  - The approval lasts 5 minutes, so the consent must come right after the
    approval.
  - Delete a used permission file.
- **Secrets.** Never read or print `.env`, the client secret, the merchant ID,
  or sandbox passwords. If the user pastes a credential, tell them to rotate
  it.
- **Browser.** The in-app browser pane blocks PayPal popups. The buyer step
  happens in the user's Chrome.
- **AI evidence.** Never tune on a blind suite. Never pool suites. Never
  delete failed reports.
