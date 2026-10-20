# Demo video script (draft, private)

Target 2:45, English, real screen recording of the local app. Label any cut or
speed-up on screen; never present prerecorded inference as live. Recording,
upload and submission each need the user's approval.

| Time | Scene | What the viewer sees | Narration (short) |
| --- | --- | --- | --- |
| 0:00–0:20 | Problem | Owner of a small cleaning business; supplier tabs and a calculator | "Buying routine supplies means checking sizes, pack counts and the full delivered price — and AI shopping agents can't be trusted with money." |
| 0:20–1:05 | Real AI comparison | Type the 40-cloth request; status "Waiting for actual AI comparison"; three options with packs, delivered total, per-cloth cost; the cheaper 30 cm cloth rejected for the wrong size | "A local model reads the request and calls one catalog tool. It copies what I wrote; the server checks every number against my words and does all the money arithmetic." |
| 1:05–1:20 | Grounding | A request with a missing size → the app asks instead of guessing | "If I didn't say it, the AI can't invent it." |
| 1:20–1:50 | Exact approval + changed price | Review card (merchant, SKU, packs, tax, delivery, total, expiry); approve; merchant price changes → blocked, fresh review required | "Approval binds this exact cart for five minutes. Even a change still inside my budget needs me again." |
| 1:50–2:30 | PayPal sandbox | Start sandbox checkout → PayPal buyer approval → server captures and independently reads the order back → "Payment confirmed" | "PayPal sandbox runs the payment; success is shown only after the server verifies amount, payee and order against what I approved." |
| 2:30–2:45 | Evidence + limits | Qualification table (blind suites, latency), test counts; limits: fictional catalog, one merchant, sandbox only | "Measured, not claimed — and here is what it doesn't do yet." |

Prerequisites before recording: AI readiness decision, one user-approved sandbox
purchase, the changed-price path exercised in the real app, and the usability
study numbers (docs/usability-evaluation.md) if they are shown.
