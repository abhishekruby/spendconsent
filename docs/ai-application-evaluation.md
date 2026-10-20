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
invented supported category. The [independently authored ten cases](ai-application-holdouts.md)
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
thirty distinct semantic cases in the current three-suite revision, rejects corrupted constraints/prices/IDs/authority,
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

## 20 October continuation and next checkpoint

The preserved `ai-application-qualification-a9fdb54.json` original suite now has
20 attempted rows: **14/20** correct, both default repetitions correct, warm
median **55.6055 s**, maximum **90.027 s**. Its inherited interruption has unknown
timing, so latency qualification fails despite that numerical median. Both
repetitions invented a missing quantity and substituted cloth for an unsupported
product; a resumed unsupported-currency case timed out. Fresh cases remain unrun
in that report. This failed report will not be overwritten or used as a pass.

Continuation used the same verified 4B model/template/runtime hashes on 20 October,
but a restarted process and concurrent backend verification; this is not a
continuous or isolated benchmark. The first startup health check returned 503;
the continuation was inadvertently launched before a separate health-200 check,
which subsequently succeeded. No startup-related outcome was removed.

The next independently reviewed prompt-only checkpoint clarifies explicit item
count versus dimensions/budget and actual product identity before category mapping.
It changes no model, sampling, schema types, parser, arithmetic, deadline, answer
or score threshold. A newly prepared report must run all original and fresh
cases independently after explicit health HTTP 200 and a private source commit.
Neither a prompt review nor an offline self-test grants application readiness.

The `a7f7904` prompt-only trial then failed its first mandatory default in
**90.037 s** (`MODEL_TIMEOUT`). Its recorded native arguments were exactly
correct; two actual HTTP connections show the timeout occurred during the final
model response. The evaluator was stopped before fresh cases: the next original
attempt is preserved as interrupted with unknown timing. It is a failed trial,
not evidence of passing extraction quality or speed. At a subsequent point sample
the model used 2,665,448 KiB RSS plus 475,060 KiB swap; MemAvailable was
2,249,756 KiB. This point sample cannot establish continuous memory extrema or
prove the cause of the timeout.

The next independently reviewed optimization keeps both actual model calls and
the genuine native assistant-call/tool-result linkage. Its final call uses a
compact decision-specific system instruction and canonical tool facts, omitting
the extraction instructions and original buyer/confirmed payload. Full facts,
final schema/equality, native argument validation, model/sampling/deadline and
all original/fresh gates remain unchanged. The checkpoint also hashes the new
final system instruction. Start with one measured default; only proceed with
the remaining suite if that mandatory case succeeds. Performance is unproven.


### Compact-context trial: original passed, fresh failed (20 October)

`ai-application-qualification-2f05695.json` preserves original 18/20, both
mandatory defaults correct, warm median 55.952s and maximum 72.978s. The fresh
suite stopped once its gate was impossible: seven correct among eleven completed
outcomes, four completed failures and one interrupted attempt with unknown time.
Its numerical median 58.318s is not a passed latency gate. Two failures were
argument-validation failures with discarded invalid bodies; their precise cause
is unknown. Other failures involved an irrelevant bottle capacity field and a
missing cloth height incorrectly marked as an unsupported extra. Original
unknown-product cases also failed canonical grounding. All evidence remains.

The run spans a model-process break and concurrent setup/backend checks, so it
is not an isolated or continuous benchmark. Runtime model/template/binary hashes
were verified before continuation and health returned HTTP 200. No AI readiness
marker was granted. The next protocol revision will keep these cases and answers
as independent regression gates and add unseen cases only after source freeze.


### Category protocol revision before a new trial

The model now chooses a full product label from four supported products, an
explicit unsupported sentinel, or null for an unspecified product. The native
parser retains that exact label in evaluation evidence; catalog search alone
maps it to existing canonical category codes before applying authoritative human
constraints. Each category requires only its applicable nullable attributes.
Cloths still require both width and height keys, with unknown values null. The
schema and Python parser reject missing keys and irrelevant attributes. Explicit
additional requirements remain unsupported; missing facts require clarification.
This is protocol guidance and strict validation, not deterministic buyer-text
interpretation. It does not establish that a model follows the protocol.

Common schema fields are shared at the root, with category/attribute pairs tied
by disjoint branches. This avoids repeating the entire tool six times (10,309
JSON bytes); the compact tool is 3,744 bytes. Native two-call inference, full tool
facts, final exact validation, model/sampling, deadline and score gates remain.
The prior fresh suite is now an exposed regression suite. Retain its unchanged
answers and independently require 18/20 and warm median below 60s. A third unseen
ten-case suite will be authored only after this adapter's reviewed source freeze;
its own 20 outcomes must pass the same gates without pooling.


Current evaluator revision retains the historical `fresh` suite under its original
name as exposed regression evidence and adds `unseen`, authored after adapter
commit `808472c`. All three suites retain independent 20-outcome gates. The
runner records both fixture hashes and binds new fixture provenance to the
frozen adapter hash/commit. Existing failed reports keep their original two-suite
checkpoints. The default run cap becomes 60; atomic attempt recording and
resumption behavior remain unchanged. The case author reviewed the adapter; the
implementation owner remains blind to new case inputs/answers before inference.
This independence is narrower than a separate external benchmark.

## 20 October evening (Claude session): grammar, grounding and slot fixes

- `a37ae31` default failed in 41.7s with invalid native arguments: the per-product
  `oneOf` let llama.cpp compile branches holding only `category`/`attributes`, so
  every actual call omitted five required fields. Preserved in
  `ai-application-qualification-a37ae31.json`.
- `199392d` made each branch complete and added number grounding; its default
  timed out at 90.093s (prompt 2,849 tokens, ~350 ms/token grammar sampling).
  Preserved in `ai-application-qualification-199392d.json`.
- `684afca` flattened the schema (1,024 prompt tokens, ~180 ms/token). Default
  passed READY in 40.889s; the next nine original cases also passed but took
  67–75s because one model slot alternates two prompts and evicts the cached
  prefix. Stopped deliberately after 10/10 passed + 1 interrupted; preserved as
  partial `ai-application-qualification-684afca.json` (latency gate unachievable).
- Grounding: extracted quantity, budget and integer specifications must appear in
  the buyer text (digits, number words, unit-adjacent metric conversion), else
  they become unknown and the buyer is asked. It checks presence, not role.
  Non-USD dollar markers (C$, NT$, "Canadian dollars", ...) never become USD.
- Current model runtime adds `--parallel 2` (same 4096 total context and memory)
  so the extraction prefix stays cached: warm full cases measured ~30s versus
  ~70s. Unseen cases remain unread by the implementer; one generic format class
  (decimal litres to millilitres) was learned from an offline self-test failure
  via a separate agent, without case text or values.

```bash
.runtime/llama-b11696/llama-server \
  --model .ai-cache/qwen3-4b-q4_k_m.gguf --alias qwen3-4b-q4_k_m \
  --host 127.0.0.1 --port 11435 --threads 4 --threads-batch 4 \
  --ctx-size 4096 --parallel 2 --cache-ram 0 --batch-size 128 --ubatch-size 128 \
  --device none --gpu-layers 0 --jinja --chat-template-file .ai-cache/qwen3.jinja \
  --reasoning off --offline --log-disable --no-webui
```

After `9b459c6` (original 20/20, regression 18/20, unseen 16/20; gate failed),
the 808472c suite became exposed regression evidence. Exposed case
`app-holdout-06` showed the flat grammar emitting `0`/`""` placeholders for
non-applicable attributes; `a12decc` treats those as unset. A separate agent then
authored `ai-application-unseen-a12decc.json` (suite `unseen2`) against frozen
adapter `a12decc`; the implementer has not read it. Qualification now requires
all four suites to pass independently (80 outcomes, default cap 80).

`8b36b78` (four suites): original 20/20, regression 20/20, exposed 808472c 17/20,
blind a12decc 18/20 — gate failed by one outcome on an exposed suite. Exposed
failures led to `168eee7` (unit-aware conversion per attribute, paper size must
appear in text, more recurring phrases) and a recurrence/number-boundary
follow-up after independent review. A separate agent authored blind suite
`ai-application-unseen-168eee7.json` (`unseen3`); five suites, 100 outcomes.
