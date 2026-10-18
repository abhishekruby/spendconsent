# Local AI feasibility

18 October 2026. Readiness experiment for the authorized SpendConsent build. Fictional catalog/request fixtures only; no PayPal call, payment, credential, customer data or hosted inference.

## Runtime decision and provenance

Use the official **llama.cpp b11696 Ubuntu x64 CPU** release instead of Ollama's bundled GPU runtime. The selected 17,883,307-byte archive is much smaller than Ollama v0.40.5's 1,438,684,604-byte Linux bundle. The latter download was deliberately stopped after about 3.8 MB because observed throughput projected several hours. That partial file is ignored, not an installed runtime. No global installer, service or GPU driver was modified.

- [Official llama.cpp release](https://github.com/ggml-org/llama.cpp/releases/tag/b11696), [CPU archive](https://github.com/ggml-org/llama.cpp/releases/download/b11696/llama-b11696-bin-ubuntu-x64.tar.gz), [MIT license](https://github.com/ggml-org/llama.cpp/blob/b11696/LICENSE), [server/API documentation](https://github.com/ggml-org/llama.cpp/blob/b11696/tools/server/README.md).
- Expected archive SHA-256 from GitHub asset metadata: `6a04629ca5265eb4c5c7d6edec8d6fa429e7e7da2de1cd5d5e357a492fc8f802`.
- Model: **Qwen3-1.7B Q4_K_M**, official [Ollama listing](https://ollama.com/library/qwen3:1.7b) and registry manifest `https://registry.ollama.ai/v2/library/qwen3/manifests/1.7b`.
- Model layer: 1,359,279,776 bytes; expected SHA-256 `3d0b790534fe4b79525fc3692950408dca41171676ed7e21db57af5c65ef6ab6`. The model GGUF is downloaded directly from that official registry and loaded by llama.cpp; no quantization or third-party model conversion is performed here.
- Original [Qwen model card](https://huggingface.co/Qwen/Qwen3-1.7B), [Apache-2.0 license](https://huggingface.co/Qwen/Qwen3-1.7B/blob/main/LICENSE), and original tokenizer chat template. License notices are retained with ignored local artifacts; distributing weights would require preserving their notices separately from this repository's MIT license.

There is no API token quota, trial expiry or hosting charge for local execution. Initial downloads require internet and roughly 1.4 GB model storage plus runtime/scratch space. Existing laptop electricity/network/storage are still used. No cloud fallback is configured.

## Protocol and experiment

`scripts/ai_probe.py --self-test` checks deterministic pack math, exact $41.80/$47.60 totals, input schemas and expected synthetic fixture outcomes without inference/network.

`scripts/ai_probe.py --run` uses only `http://127.0.0.1:11435/v1/chat/completions`, explicitly bypasses proxies and rejects redirects. Each case allows one model-selected native `search_catalog` call. The model interprets the request; Python validates all arguments and calculates money/pack counts from fictional records. A second genuine inference returns a constrained status/offer decision. A mismatched interpretation, invalid schema, extra tool (including in the final response), wrong selection, timeout, late response or truncation counts as failure. No approval/payment tool exists. Hidden reasoning and full provider/model bodies are not recorded.

The original pre-inference fixture/probe checkpoint is commit `363af3f`, script SHA-256 `ea312070eab8a95c04d65db46f30ecc3f383bc5b5af02f855366bac9473504a7`. Before any actual inference, independent offline review identified two validator gaps: a final response could include an ignored tool call, and a response returning after the overall deadline could still pass. The corrected script SHA-256 is `07834176c7d76b5a54e70a70255de3d000723270773bd7352fffdff128211e2d`; all ten inputs, expected constraints/decisions, prompts and tool definitions remain unchanged. This is a harness correction before evaluation, not case tuning after a failed model run.

The 90-second overall deadline supplies each HTTP call's remaining socket-inactivity timeout and also rejects responses observed after the deadline. This is not hard cancellation: an in-progress socket read or server computation may continue beyond that time. Elapsed timings retain such overruns as failures.

Ten cases were fixed before the first actual inference and are run twice: exact 40/20/30 units; 30 cm rather than 40 cm; low budget; indivisible pack count; missing quantity; missing size; unsupported EUR; unknown gloves. Both repeated outcomes and timings are retained, including failures. The synthetic catalog has only three offers for this isolated gate; the product's planned larger catalog and unseen cases require later verification.

Gate: at least 18/20 correct grounded outcomes, warm median full two-call latency under 60 seconds. This tests the model/tool slice, not the eventual browser request-to-review workflow, full laptop application load, user usefulness, market fit or production reliability.

## Execution status

The complete model SHA-256, runtime archive SHA-256 and corrected probe SHA-256 above were verified locally before the first inference. Runtime `--version` reports `0.7.0-dev (build 11696, commit ceefd16da)`. The original Qwen tokenizer metadata's `chat_template` exactly matches `.ai-cache/qwen3.jinja`, SHA-256 `a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8`.

The baseline runs from commit `b8529ab`, with the corrected frozen probe and original template, using this manually started process:

```bash
.runtime/llama-b11696/llama-server \
  --model .ai-cache/qwen3-1.7b-q4_k_m.gguf --alias qwen3-1.7b-q4_k_m \
  --host 127.0.0.1 --port 11435 --threads 4 --threads-batch 4 \
  --ctx-size 4096 --parallel 1 --cache-ram 0 --device none --gpu-layers 0 \
  --jinja --chat-template-file .ai-cache/qwen3.jinja --reasoning off \
  --chat-template-kwargs '{"enable_thinking":false}' \
  --offline --log-disable --no-webui
python3 scripts/ai_probe.py --run
```

The redundant `enable_thinking` template flag is retained here to reproduce the actual invocation; the runtime warns it is deprecated in favor of `--reasoning off`. The server's health endpoint returned HTTP 200 with `{"status":"ok"}` and the listener was verified as `127.0.0.1:11435`. It was ready when first checked at approximately four seconds of process age; startup was not measured with a precise timer. No global service was created.

The first actual 20-case baseline is complete: **0/20 passed**. First request: **8.567 seconds**; warm median: **13.083 seconds**; maximum: **16.612 seconds**. All final responses failed the exact decision schema. Independently, only **6/20** extracted argument objects matched the frozen expectations: several dollar budgets were ten times too small, and “under 60 euros” became 5900 cents rather than the expected 6000. The accuracy gate failed; fast incorrect answers do not establish feasibility.

Every result remains in [ai-probe.json](evidence/ai-probe.json), with an unchanged [baseline archive](evidence/ai-probe-baseline-b8529ab.json). Both have SHA-256 `05cf4b7b80064d320da5f75b7cdadec4a0e0adfa5f05b152fedf4daba2802abd`. The server's observed peak resident set was 2,595,504 KiB (approximately 2.48 GiB); this is not a full application memory benchmark.

Post-baseline investigation found a protocol bug: the pinned server implementation reads `response_format.json_schema.schema` for `type=json_schema`, while its README shows an incompatible outer `schema` example. The baseline sent that README form, so the server constrained output only to an arbitrary object. See the [exact runtime source](https://github.com/ggml-org/llama.cpp/blob/ceefd16daa2093730bf3340315fa2b84b286ddbc/tools/server/server-common.cpp). A [single post-baseline diagnostic replay](evidence/ai-probe-diagnostic-b8529ab.json) preserved only sanitized shape information: the final object had `eligible` and `status` keys, no `offer_id`, and no additional tool call. Its standard-case budget was again incorrectly extracted as 600 cents. This diagnostic is excluded from the 20-case score.

The protocol-only correction nests the unchanged decision schema at `response_format.json_schema.schema`, names it `purchase_decision`, and adds an offline capture of the actual outgoing HTTP body. That check verifies the nested schema and absent final-request tools; existing extra-tool/deadline regression checks remain. Revised probe SHA-256: `5fe929c65b241354d0d2f1435b1495ca153b0cce06621dc8781f903d0e4e364d`. Prompts, ten inputs, expected constraints/decisions, schema contents and runtime configuration are unchanged. Independent review passed the diff and offline checks before script-only commit `f8fef57b63e9199b075402634a09b0f0266e7005`. Its separately retained 20-case rerun is complete:

```bash
python3 scripts/ai_probe.py --run --output docs/evidence/ai-probe-protocol-f8fef57.json
```

The [protocol-only result](evidence/ai-probe-protocol-f8fef57.json), SHA-256 `e441f5745e084ede1f23e852c275f1be8798d18c3ce582599d455dc4dd641f20`, achieved **6/20**, with **6/20** exact argument objects. First request: **12.548 seconds**; warm median: **15.457 seconds**; maximum: **23.672 seconds**. All 20 final objects had the required keys and matched the actual tool status. The remaining 14 failures were incorrect constraint extraction: besides money conversion, missing quantity was invented as 1 and missing size was invented as 40 cm while quantity 40 became 4. The resulting `NO_MATCH` final was consistent with that incorrect tool input; it was not a failure to copy an actual `NEEDS_CLARIFICATION` tool result. The 18/20 accuracy gate remains failed.

On 18 October the same server PID 151369 was still alive and health returned HTTP 200 before the prompt-only primary run. The separately controlled prompt/field-description revision reinforces exact individual-unit digits, multiplication by 100 for cents using a new $12.34 example, and explicit final status/key instructions. Its script SHA-256 is `dccee6af4b3330a27116f0e323eb3d4a0c6cb3ade9c29e698e896291d71602bc`. Inputs, expected answers, schema constraints, scoring, runtime and reasoning configuration remain unchanged. Independent review passed the restricted diff and offline self-test before private checkpoint `6a64292df216d49fe848a6da0a0096656bce138a`. All protocol-run finals already agreed with the actual tool status; the final wording reinforces the contract rather than fixing an observed status-copying bug.

An independent reviewer froze ten additional unseen cases, each to run twice, in `scripts/ai_holdout.py`, SHA-256 `ed64334974077189e6f380e9523f5290a371a465af7b7497b04fc1aaf17f8594`, before any revised-prompt inference. Its offline cases/mocks passed review before that checkpoint. Those answers were withheld from the prompt author and were not used for tuning.

The [prompt-only primary result](evidence/ai-probe-prompt-6a64292.json), SHA-256 `032828af9a211e321db9aaaade3674d7aeb364becb6884c028fd8a3a8a4df73a`, completed all 20 with **12/20 passed**, and **12/20** exact argument objects. First request: **14.718 seconds**; warm median: **11.495 seconds**; maximum: **15.732 seconds**. Four repeated cases failed: standard budget conversion, missing quantity, missing size, and unsupported currency. Across the eight failed rows there were four budget mismatches, two quantity mismatches and two size mismatches. This improves the observed synthetic result but still fails the 18/20 gate.

An external environment restart removed the original model process between the completed primary and held-out runs. The primary was not repeated. Before restarting only the project model, verified the same complete model/archive/template hashes and runtime version; the `llama-server` executable SHA-256 is `6c7e275a5fe0b9f2b3d90dd53d8fd441d653af415350cfc05ca41e45eb18abfb`. Port 11435 was free. New PID 8612 uses the exact original command/configuration above; no redownload, installation or configuration change occurred. These runs therefore do not share a continuous model process or cache history. Parallel backend preparation may also consume laptop resources; this is not a controlled full-application benchmark.

The [first held-out startup attempt](evidence/ai-holdout-prompt-6a64292.json) was started before health became ready because of an operator sequencing error. It completed **1/20**, with 19 `HTTPError` rows while loading and one genuine model/tool/final outcome that passed in 37.066 seconds. The first observed health response was HTTP 503; the probe retains only the generic error class for the individual requests. Its literal warm median of 0.141 seconds is dominated by startup errors and is not model inference latency. Every row is preserved, with a byte-identical [startup archive](evidence/ai-holdout-prompt-6a64292-startup-attempt.json), both SHA-256 `ee4cd8da822714676f60a63db2311b1f37ba0a09be79a861911b52029baf6296`.

After explicitly observing health HTTP 200, the separately authorized [whole-suite readiness retry](evidence/ai-holdout-prompt-6a64292-readiness_retry.json) completed **16/20 passed**, with **16/20** exact argument objects. First request and maximum: **28.130 seconds**; warm median: **13.948 seconds**. All 20 rows contain an actual tool call and valid final-decision keys; every final status matches its actual tool result. There are no HTTP errors. Four incorrect constraint outcomes remain failures. Report SHA-256: `064052f55ad9b3d72b7e16064acab63523b6d6c1679696bdd56f7c01f5b87bc0`.

The retry kept the unchanged frozen inputs, answers, prompt, runtime configuration and scoring; no individual case was selected or patched, and the failed startup attempt remains visible. The primary score is still **12/20**, and the readiness-confirmed held-out score is **16/20**; neither satisfies 18/20. These remain separate experiments, not a pooled or best-of-case pass. No regex correction, normalization of incorrect model outputs, or thinking configuration was introduced. No model gate or later implementation stage is passed by these experiments. Further inference changes need a separately reviewed checkpoint and clearly labeled new measurements; the already measured held-out set is now a regression set, not fresh unseen evidence.

## Next controlled configuration — not yet run

The optional `--thinking-extraction` flag is prepared in both probe entry points. Only the first extraction request overrides `chat_template_kwargs={"enable_thinking":true}`, `reasoning_effort="low"`, `reasoning_format="deepseek"`, `reasoning_budget_tokens=256` and `max_tokens=1024`. The final decision request retains `reasoning_effort="none"` and `max_tokens=350`; the 90-second total deadline, schemas, tool definition, prompts, inputs, expected answers and scoring remain unchanged. Per-request controls were checked against the [immutable runtime implementation](https://github.com/ggml-org/llama.cpp/blob/ceefd16daa2093730bf3340315fa2b84b286ddbc/tools/server/server-common.cpp). `reasoning_effort="none"` would force extraction thinking off, so that first request explicitly uses `low`.

Candidate source SHA-256: `scripts/ai_probe.py` = `50d663ca72cfdbe96babd6ade085b0a3ad842eebf7be2ff19b79251f0830255e`; `scripts/ai_holdout.py` = `7e67dfb885067ffeb16b1ca28a43220d1822bc01e34be9341f8dc9ef6ee50300`. Reports now record the flag, actual request configuration, source hashes and pinned runtime commit. Previously measured held-out cases are labeled regressions rather than fresh unseen evidence. The response parser immediately retains only role/content/tool calls and drops raw response/other fields, including `reasoning_content`; hidden reasoning is never logged, sent back or written to evidence.

Offline request-capture checks pass for both flag modes: only extraction gets the overrides, final requests stay unchanged, a synthetic reasoning marker disappears before the next request/evidence, and truncated responses fail. Existing late-final and extra-tool regression checks still pass. These are offline checks, not a successful thinking measurement. Independent review and private commit must precede any actual new primary/regression runs; the default 40-cloth case must also work correctly before approving integration. No thinking inference or AI gate pass is claimed.
