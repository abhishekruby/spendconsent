# Demo video script (draft, private)

Target 2:50, English, real screen recording of the local app (two windows side by
side: the requester's laptop and the owner's phone-sized window). Label any cut or
speed-up on screen ("AI wait shortened"); never present prerecorded inference as
live. Recording, upload and submission each need the user's approval. Sound on —
the interface cues are part of the demo.

| Time | Scene | What the viewer sees | Narration (short) |
| --- | --- | --- | --- |
| 0:00–0:15 | Hook | Claude Desktop with the SpendConsent MCP server: "reorder 40 cloths under $60" → offers → "Sent to the owner — I can't approve or pay"; the owner's window opens the cart | "AI agents can shop for you. Would you give one your card? Here, the agent can find and prepare — never pay." |
| 0:15–0:30 | Problem | The 40-cloth request; mismatched sizes, pack counts, delivery and tax | "Reordering supplies means checking sizes, packs and the real delivered price — and an agent that guesses can spend the wrong money." |
| 0:30–1:05 | Real AI, live | Type the request → loader with timer → "Understood: 40 cloths, 40 × 40 cm, ≤ $60" → "2 offers fit", cheapest highlighted, wrong size ruled out | "A local model reads plain words and calls one catalog tool. Code — not the model — does every number. If I didn't say it, it asks." |
| 1:05–1:25 | Exact cart | Receipt with pack maths, delivered total, countdown | "This is the exact cart: merchant, packs, tax, delivery, total. It expires in ten minutes." |
| 1:25–1:55 | Owner approval | "Ask the owner to approve" → owner's window opens the link → receipt → Approve → stamp + thud; requester window updates by itself | "The person preparing the cart isn't the one paying. The owner approves this exact cart from their phone — and nothing else." |
| 1:55–2:25 | PayPal | Owner → PayPal sandbox popup → approve → "Paid. All verified." chime; requester's tracker turns all green; receipt download | "PayPal runs the payment. Success shows only after our server captures it and reads it back from PayPal — amount, payee, order." |
| 2:25–2:40 | Safety | Price changed by the merchant → approval revoked; two quick comparisons queue | "Change one cent after approval and the approval is void. No guesses, no silent retries." |
| 2:40–2:50 | Proof + close | 160/160 across 8 test suites (6 blind), ~17 s per comparison on a laptop, sandbox only | "AI that shops. A person who decides. PayPal that verifies. SpendConsent." |

Prerequisites before recording: services up (`scripts/run_demo.sh`), buyer
consent mode, a sandbox personal buyer login ready, sound on, one dry run, and
the usability numbers if they are shown.
