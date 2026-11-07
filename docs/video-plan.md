# Demo video plan (target 2:45, hard limit 2:55)

Judges score five equal criteria and may judge from the video alone. Devpost's
tips: open with the problem and who it is for, show PayPal and AI working end to
end, cut loading/setup, AI voiceover is fine, public YouTube, under 3 minutes,
upload early. Rules: no third-party music or trademarks without permission, real
working software (no mockups presented as the product).

## Roles and loop

1. **You** record the raw screen clips (shot list below) and run Codex.
2. **Codex** builds the edit in `video/` (Remotion), voiceover, motion graphics,
   captions, and renders. It never touches app code, `.env` or payments.
3. **Claude** reviews each render (frames, timing, facts, honesty labels) and
   writes the next correction prompt. Repeat until the checklist passes.

## Script (≈300 spoken words ≈ 2:00 of voice; the rest is visuals)

| # | Time | On screen | Voiceover |
|---|---|---|---|
| 1 Hook | 0:00–0:12 | Kinetic type on paper background: "AI agents can shop for you." → "Would you give one your card?" → a terminal line: `request_owner_approval → Sent to the owner. I can't pay.` | AI agents can already shop for you. But would you hand one your card? SpendConsent lets an agent find and prepare a purchase — and never pay. |
| 2 Problem, who | 0:12–0:30 | Icons: small café / office / household. Animated "messy offers" table: pack sizes, specs, delivery, tax — mismatches flash red. Label "One person orders. Someone else pays." | Think of a small café or office. One person reorders supplies; someone else pays. Offers differ in pack size, spec, delivery and tax — and an agent that guesses spends the wrong money. |
| 3 Describe + AI | 0:30–1:00 | Clip C1 typing the request → live AI progress (sped up, label **"AI wait shortened · real: 14 s"**) → "What the AI understood" card, zoom on tagged words → offers, cheapest highlighted, ruled-out reasons → Channel3 retail prices. Callout chips: "Qwen3-4B · self-hosted · 1 tool call", "Code does every number". | Just say what you need. An open AI model on our own server reads it and makes one catalog search. It keeps only what you actually wrote — if a detail is missing, it asks instead of guessing. Then plain code, not the model, checks every offer and does every cent of math. Real retail prices from Channel3 show whether the deal is fair. |
| 4 Exact cart | 1:00–1:15 | Clip C3 receipt; slow push-in on packs × units, delivery, tax, total; ring around the 10-minute countdown. | This is the exact cart: merchant, packs, tax, delivery and total. It expires in ten minutes. |
| 5 Owner approves | 1:15–1:40 | Clip C4 split: laptop (requester) + phone frame (owner). Link sent → owner opens → Approve → APPROVED stamp + thud → requester screen updates by itself (highlight pulse). | The person preparing the cart isn't the one paying. One tap sends the owner a private link. They approve this exact cart — nothing else — and the requester's screen updates on its own. |
| 6 PayPal | 1:40–2:08 | Clip C5 PayPal sandbox popup → "Paid. All verified." + chime → tracker all green → receipt download. Small diagram: Server → PayPal capture → read-back ✓ amount ✓ payee ✓ order. Clip C6 cancel → "Refunded". | Checkout runs on PayPal. We only call it paid after our server captures the order and reads it back from PayPal — amount, payee and order must match. Changed your mind? The owner can cancel for a full PayPal refund, verified the same way. |
| 7 Safety + agents | 2:08–2:30 | Clip C7 price change → approval stamped VOID. Animated terminal (real MCP transcript): `find_offers`, `prepare_cart`, `request_owner_approval` → "no tool can pay". | Change one cent after approval and the approval is void. And any AI agent can shop through our MCP server — find offers, prepare the cart, ask the owner — but there is simply no tool that pays. |
| 8 Proof + close | 2:30–2:45 | Stat cards count up: **160/160** AI test cases (8 suites, 6 written blind) · **~14 s** per comparison · **150+** automated tests · **Sandbox only**. Flow line: Agent → Exact cart → Owner → PayPal → Verified. End card: spendconsent.ullagecloud.com · GitHub link · tagline. | 160 out of 160 on our AI test suites. Live today on our own server. SpendConsent: AI that shops, a person who decides, and PayPal that verifies. |

Keep every number true at render time (check README and the live site). Any
speed-up or cut of a wait gets an on-screen label. "Sandbox · test money" stays
visible in payment scenes.

## Shot list — you record with OBS (about 30–40 min with retakes)

Setup: OBS → Settings → Video 1920×1080, 30 fps; Output → Recording quality
"Indistinguishable", format MKV (remux to MP4 after); Audio → desktop audio on,
mic off (the app's own sounds are wanted). Chrome: new Guest window, bookmarks
bar hidden, zoom 110%, light mode, sound on. Site:
https://spendconsent.ullagecloud.com. Move the mouse slowly; pause 2 s before
and after every click. One file per clip, named as below, into `video/raw/`.

| Clip | What to do |
|---|---|
| C1-describe.mkv | Start a new request, type: `Find exactly 40 microfiber cloths, 40 × 40 cm, under $60 including delivery and tax. One-time purchase.` → Compare offers → let the full wait run (do not cut). |
| C2-results.mkv | Scroll slowly through "What the AI understood", the offers, the ruled-out reasons and the Channel3 prices. |
| C3-review.mkv | Choose the cheapest offer → Review purchase → hold 5 s on the receipt and countdown. |
| C4-owner.mkv | Second Chrome window at phone size (430×900) on the right. Ask the owner to approve → open the link in the phone window → Approve → keep both windows in view until the left one updates. |
| C5-pay.mkv | Continue to payment → PayPal sandbox popup (you sign in with the sandbox buyer; blur nothing, it is test data, but never show a real password) → Pay → wait for "Paid. All verified." → Download receipt. |
| C6-refund.mkv | Purchases → the order → Cancel & refund → owner confirms → "Refunded". |
| C7-price.mkv | New cart up to approval. Tell Claude "price now" — Claude changes the offer price on the server — then reload: the approval is revoked. |

Also take 3–4 phone photos or screenshots you like; Codex may use them as stills.

## Quality checklist (Claude reviews against this)

- [ ] ≤ 2:55 total; first 12 s states the problem; who it's for by 0:30
- [ ] AI and PayPal both shown working end to end, on the real live site
- [ ] Every speed-up/cut labelled; no fabricated screens; numbers match README
- [ ] Voice clear, −14 LUFS, no clipping; captions burned in and in an SRT
- [ ] Text readable on a phone (≥ 36 px at 1080p); nothing important in the edges
- [ ] Brand matches the app (paper/ink/persimmon, Bricolage Grotesque, IBM Plex Mono)
- [ ] No third-party music/logos except PayPal and Channel3 UI as they appear in the product
- [ ] No secrets, emails, tokens or account IDs visible (approval links blurred)
- [ ] End card: live URL + repo + tagline, held ≥ 4 s

## Timeline

- 7 Nov night: Codex sets up `video/`, voice samples, all motion-graphic scenes.
- 8 Nov: you record clips; Codex v1 edit; Claude review → v2.
- 9 Nov: v3 final; upload to YouTube (public), check processing, captions.
- 10 Nov: Devpost text with the video link; submit.
