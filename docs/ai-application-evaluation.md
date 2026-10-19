# Actual application-protocol AI qualification

19 October 2026. `scripts/ai_application_eval.py` calls the real
`purchases.agent.compare` using the frozen native model protocol and actual
catalog arithmetic. Its catalog is sixteen unsaved copies of the original seed,
with stock 100, zero reservations and version 1. Only the ORM lookup and dummy
backend's autocommit introspection are supplied by the fixture context. Django's
dummy database backend prevents application/test database access; this runner
does not qualify request persistence, browser behavior or full application latency.
The native inference transport, parser, tool execution and final grounding remain
actual during `--run`. No fixture response or hidden inference fallback exists.

The original ten semantic cases from `ai_probe.py` run twice, preserving their
original statuses and lowest SKUs. Their representation changes only to the
canonical application schema: square size becomes width/height; unsupported
currency and its budget stay outside USD constraints; an unsupported item has no
invented supported category. The [independent fresh ten cases](ai-application-holdouts.md)
also run twice. Each suite independently requires at least 18/20 correct outcomes
and a warm median strictly below 60 seconds. Both original default 40-cloth cases
must additionally pass as READY with CLOTH-B; eighteen other correct outcomes
cannot compensate for a broken default flow. Scores are never pooled. The warm
median excludes the first measured request of each suite; that first timing is
also reported, without calling it cold startup unless separately established.

Exact supported partial constraints, clarification fields, all eligible pack/charge
facts, canonical offer evidence, actual native tool selection and metadata are
checked. Unknowns cannot pass through a guessed supported cart. The fresh answers
are checked against their hand-written totals before inference. Description
overrides touch fixture copies only. Exposure and context filtering are reported
separately; a filtered description exercises no model injection resistance.
Validated native arguments are recorded separately from canonical constraints so
human overrides and policy rejection cannot hide a model extraction mistake.
Only validated bounded synthetic arguments are retained; invalid argument bodies
and raw responses are excluded. Only the fixed local model socket is permitted. No approval, PayPal, secret loading,
application write, model startup or model download occurs here.

Run the offline self-test first. It uses explicitly mocked inference, checks all
twenty distinct semantic cases, rejects corrupted constraints/prices/IDs/authority,
checks independent score/latency thresholds, blocks a non-model destination and
proves checkpoint creation, refusal to overwrite and partial-report resumption:

```bash
.venv/bin/python scripts/ai_application_eval.py --self-test
```

After independent review and private commit of the runner, adapter, fixtures and
their source dependencies, prepare a new uniquely named report. Preparation makes
no network calls. It records all source hashes, prompt/schema hashes, model preset,
expected artifact provenance and fixture conditions before any measurement:

```bash
.venv/bin/python scripts/ai_application_eval.py --prepare --output docs/evidence/ai-application-qualification-CHECKPOINT.json
```

The team lead must separately authorize actual inference and verify the documented
single 4B runtime/artifact. The runner records expected artifact metadata; it does
not independently prove which binary/model the running server loaded. `--run`
refuses source/config drift and any source that differs from the current private
commit. For the first authorized actual case, then the remaining cases:

```bash
.venv/bin/python scripts/ai_application_eval.py --run --max-cases 1 --output docs/evidence/ai-application-qualification-CHECKPOINT.json
.venv/bin/python scripts/ai_application_eval.py --run --output docs/evidence/ai-application-qualification-CHECKPOINT.json
```

Every outcome is saved atomically. A partial run resumes without replacing earlier
failures or re-running completed cases. Completed reports cannot be restarted or
overwritten. An attempt is recorded before HTTP; process interruption leaves an
explicit failed case with unknown timing. It cannot be silently re-run and that
report cannot pass its latency gate with a missing measurement. Application model
metadata remains arguments-free. This synthetic evaluation evidence additionally
records bounded validated native arguments, with no raw responses, full prompts
or private reasoning. A failed experiment must remain preserved; these fixtures
must not become tuning data. Passing this isolated protocol evaluation still does
not complete the integrated browser, persistence, usefulness or payment gates.
