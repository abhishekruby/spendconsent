# Expert evaluation without participants (21 Oct 2026)

**No human participant has been timed.** This file records what can be measured
or estimated without people, labelled by method. It does not replace the
participant study in [usability-evaluation.md](../usability-evaluation.md) and
supports no claim about real buyers' speed, errors or satisfaction.

## 1. Measured: the app on the five study tasks

The five frozen tasks U1–U5 were sent unchanged through the running application
(real local Qwen3-4B, real catalog code) via the MCP `find_offers` tool, one at a
time, warm model, laptop CPU, Channel3 market check on. Time is request to answer.

| Task | Expected | App answer | Correct | Seconds |
| --- | --- | --- | --- | ---: |
| U1 | CLOTH-B $20.90 | Sample microfiber cloths B $20.90 | yes | 19.3 |
| U2 | BAG-B $29.70 | Sample 30 L bags B $29.70 | yes | 18.6 |
| U3 | BOTTLE-A $37.00 | Sample 500 ml spray bottles A $37.00 | yes | 19.7 |
| U4 | NOTEBOOK-B $59.40 | Sample A5 notebooks B $59.40 | yes | 18.9 |
| U5 | No match | NO_MATCH | yes | 17.9 |

5/5 correct, median 18.9 s. One run; the larger AI evidence is the 160/160
qualification ([report](ai-application-qualification-34ec5e1.json)).

## 2. Estimated: Keystroke-Level Model (Card, Moran & Newell, 1980)

KLM predicts error-free *expert* time from standard operators: keystroke
K = 0.28 s, mental preparation M = 1.35 s. It is a lower bound; novices are
slower and make errors KLM ignores.

- **Manual, per task:** read the request and filter four offers by spec (~10 s);
  for each of ~3 eligible offers check divisibility, packs, subtotal, 10 % tax,
  delivery and budget (4 M + 16 K ≈ 10 s, ≈ 30 s); choose and write the answer
  (~11 s). **≈ 50 s.**
- **Assisted, typed request:** ~110 characters (31 s) + M + AI 19 s + reading the
  answer (3 M ≈ 4 s). **≈ 55 s.** With a pasted or sample request: **≈ 25 s.**

Honest reading: on a four-offer catalog the app is not predicted to beat an
error-free expert with a calculator unless the request is pasted. Its measured
value is that every rule (exact size, exact units, full delivered total, budget,
one-time) was applied correctly every time, and that nothing is bought without
the owner. Human arithmetic and rule errors are exactly what only a participant
study can measure.

## 3. Found by the developer using the app (dogfooding)

Real issues found while the developer bought in the sandbox, all fixed and
tested: a PayPal `PAYER_ACTION_REQUIRED` order left payment stuck as "unknown"
(3afecb7); no way back to edit the request (312b5c8); a background refresh closed
the open PayPal window so a paid-looking flow was never captured (cb70eda); an
expired approval showed a misleading "financial actions disabled" message (6ffc93d).

## Next

One to three real participants with the existing kit would turn section 2's
estimate into evidence. Until then, claim correctness and safety, not speed.
