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

On 18 October the same server PID 151369 was still alive and health returned HTTP 200; the completed probe was not restarted. A separately controlled prompt/field-description revision is prepared to reinforce exact individual-unit digits, multiplication by 100 for cents using a new $12.34 example, and explicit final status/key instructions. Its script SHA-256 is `dccee6af4b3330a27116f0e323eb3d4a0c6cb3ade9c29e698e896291d71602bc`; it has not run inference. Inputs, expected answers, schema constraints, scoring, runtime and reasoning configuration remain unchanged. Independent review passed the restricted diff and offline self-test. All protocol-run finals already agreed with the actual tool status; the final wording reinforces the contract rather than fixing an observed status-copying bug.

An independent reviewer froze ten additional unseen cases, each to run twice, in `scripts/ai_holdout.py`, SHA-256 `ed64334974077189e6f380e9523f5290a371a465af7b7497b04fc1aaf17f8594`, before any revised-prompt inference. Its offline cases/mocks passed review, not actual inference. Those answers are withheld from the prompt author and are not used for tuning. After a committed checkpoint, run the primary 20 first and the separate held-out 20 on the same unchanged prompt/runtime; retain both reports and all failures. No regex correction or normalization of incorrect model outputs is introduced. No model gate or later implementation stage is passed by these experiments.
