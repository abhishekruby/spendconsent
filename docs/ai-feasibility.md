# Local AI feasibility

16 October 2026. Readiness experiment for the authorized SpendConsent build. Fictional catalog/request fixtures only; no PayPal call, payment, credential, customer data or hosted inference.

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

`scripts/ai_probe.py --run` uses only `http://127.0.0.1:11435/v1/chat/completions`, explicitly bypasses proxies and rejects redirects. Each case allows one model-selected native `search_catalog` call. The model interprets the request; Python validates all arguments and calculates money/pack counts from fictional records. A second genuine inference returns a constrained status/offer decision. A mismatched interpretation, invalid schema, extra tool, wrong selection, timeout or truncation counts as failure. No approval/payment tool exists. Hidden reasoning and full provider/model bodies are not recorded.

Ten cases were fixed before the first actual inference and are run twice: exact 40/20/30 units; 30 cm rather than 40 cm; low budget; indivisible pack count; missing quantity; missing size; unsupported EUR; unknown gloves. Both repeated outcomes and timings are retained, including failures. The synthetic catalog has only three offers for this isolated gate; the product's planned larger catalog and unseen cases require later verification.

Gate: at least 18/20 correct grounded outcomes, warm median full two-call latency under 60 seconds. This tests the model/tool slice, not the eventual browser request-to-review workflow, full laptop application load, user usefulness, market fit or production reliability.

## Execution status

Download and evaluation are in progress. No model accuracy or latency gate is claimed passed yet. Actual results, identity verification and runnable server commands will be added after the experiment completes.
