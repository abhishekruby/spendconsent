# Demo video plan (target 2:45, hard limit 2:55)

Judges score five equal criteria and may judge from the video alone. Devpost's
tips: open with the problem and who it is for, show PayPal and AI working end to
end, cut loading/setup, AI voiceover is fine, public YouTube, under 3 minutes,
upload early. Rules: no third-party music or trademarks without permission, real
working software (no mockups presented as the product).

**The one idea every viewer must leave with:** *AI can shop for you, but it can
never pay — a person approves the exact cart, and PayPal verifies the payment.*

## Roles and loop

1. **Codex** records the real app automatically (no human screen recording),
   builds the edit in `video/` (Remotion), voiceover, motion graphics, captions,
   and renders. It never touches app code or `.env`.
2. **You** do one thing: sign in once to the PayPal sandbox buyer in the
   recording browser when Codex asks, and approve the test payments (below).
3. **Claude** reviews each render (frames, timing, facts, honesty labels) and
   writes the next correction prompt. Repeat until the checklist passes.

## Story shape (trailer structure)

Cold open (the payoff, 4 s) → problem with real numbers → product live → the
"wow" (owner approves from a phone, laptop updates by itself) → PayPal verified
→ safety → proof → try-it card with QR code.

## Script (≈330 spoken words ≈ 2:10 of voice; the rest is visuals)

| # | Time | On screen | Voiceover |
|---|---|---|---|
| 1 Cold open + hook | 0:00–0:12 | 4 s montage of payoffs: phone "Approve" tap → APPROVED stamp + thud → "Paid. All verified." + chime → terminal `no tool can pay`. Cut to paper: kinetic type "AI agents can shop for you." → "Would you give one your card?" | AI agents can already shop for you. But would you give one your card? |
| 2 Problem + who | 0:12–0:32 | Two big stat cards counting up: **19%** "trust AI to make everyday purchases" · **60%** "would quit an AI shopping agent after one mistake" (source line: ACI Worldwide / YouGov, 2,080 UK adults, June 2026). Then icons: café / office / home — "One person orders. Someone else pays." Product title card: **SpendConsent** — "AI shops. You decide. PayPal verifies." | Only one in five people trust AI to buy for them — and most would quit after a single mistake. SpendConsent is built for small teams where one person orders supplies and someone else pays. The AI does the shopping. A person approves the exact cart. PayPal verifies the payment. |
| 3 Describe + AI | 0:32–1:02 | Request typed → live AI progress (sped up, label **"AI wait shortened · real: ~14 s"**) → "What the AI understood" with tagged words (zoom) → 2 offers fit, cheapest highlighted, "$5.80 less than the next", ruled-out reasons → Channel3 retail prices. 3 s insert: a request with a missing detail → the AI asks, one-click answer chips. Callout chips: "Qwen3-4B · self-hosted · 1 tool call", "Code does every number". | Just say what you need, in plain words. An open AI model on our own server reads it and makes one catalog search. It keeps only what you actually wrote — if a detail is missing, it asks instead of guessing. Then plain code, not the model, checks every offer and does every cent of math. Real retail prices from Channel3 show whether the deal is fair. |
| 4 Exact cart | 1:02–1:15 | Receipt; slow push-in on packs × units, delivery, tax, total; ring around the 10-minute countdown. | This is the exact cart: merchant, packs, tax, delivery and total. It expires in ten minutes. |
| 5 The wow: owner approves | 1:15–1:40 | Split screen: laptop (requester) + phone frame (owner). Link sent → phone opens the receipt → Approve → APPROVED stamp + thud → the laptop updates by itself (highlight pulse, small label "live, no refresh"). | The person preparing the cart isn't the one paying. One tap sends the owner a private link. They approve this exact cart — nothing else — and the requester's screen updates on its own. |
| 6 PayPal | 1:40–2:07 | PayPal sandbox popup → Pay → "Paid. All verified." + chime → tracker all green → receipt download. Diagram: Server → PayPal capture → read-back ✓ amount ✓ payee ✓ order. Then Purchases → Cancel & refund → "Refunded". | Checkout runs on PayPal. We only call it paid after our server captures the order and reads it back from PayPal — amount, payee and order must match. Changed your mind? The owner can cancel for a full PayPal refund, verified the same way. |
| 7 Safety + agents | 2:07–2:28 | Price changed by one cent after approval → approval stamped VOID. Animated terminal (real MCP transcript): `find_offers` → `prepare_cart` → `request_owner_approval` → highlighted line "This tool cannot approve or pay". | Change one cent after approval and the approval is void. And any AI agent can shop through our MCP server — find offers, prepare the cart, ask the owner — but there is simply no tool that pays. |
| 8 Proof + try it | 2:28–2:45 | Stat cards: **160/160** AI test cases (8 suites, 6 written blind) · **~14 s** per comparison · **150+** automated tests · **Sandbox only**. Flow line: Agent → Exact cart → Owner → PayPal → Verified. End card (hold ≥ 5 s): **Try it: spendconsent.ullagecloud.com** + QR code + GitHub link + tagline. | 160 out of 160 on our AI tests. It's live — try it yourself. SpendConsent: AI that shops, a person who decides, and PayPal that verifies. |

Keep every number true at render time (check README, impact evidence and the
live site). Any speed-up or cut of a wait gets an on-screen label. "Sandbox ·
test money" stays visible in payment scenes.

## Automated recording (Codex) — replaces manual OBS

- Record against the local app (`scripts/run_demo.sh`): same code as the live
  site, full control (price-change command, no per-visitor action limit). The
  browser runs in kiosk mode, so no address bar appears.
- Playwright drives a **headed** Chrome (persistent profile in
  `video/.chrome-profile/`, gitignored) at 1920×1080 on this X11 desktop;
  ffmpeg `x11grab` captures the screen (crisp text, CRF ≤ 18, 30 fps). This also
  captures the PayPal popup window.
- Playwright does not move the real mouse: inject a smooth, visible cursor with
  click ripples via `context.addInitScript` (applies to popups too). Type at a
  human pace; pause before and after each click.
- Owner scene: a second browser context sized as a phone (390×844, device scale
  2) placed beside the laptop window; record both, composite in Remotion.
- Price-change scene: `.venv/bin/python backend/manage.py set_offer_price …`
  (read `--help` first) on the local app while recording.
- Clips: `video/raw/C1-describe … C7-price` plus `C3b-ask` (missing detail →
  AI asks). Re-record freely; never cut the AI wait without a label.
- The user must not use the laptop while a clip records.

### PayPal sandbox steps (needs the user)
- Codex opens the PayPal sandbox popup and **stops**; the user signs in with the
  sandbox *buyer* test account in that recording browser (the login stays in
  the profile). Codex never sees or types the password.
- Payments and refunds here are sandbox test money only. The user's approval
  for these recording payments is given in the Codex prompt (see there).

## Quality checklist (Claude reviews against this)

- [ ] ≤ 2:55; problem in the first 12 s; who it's for by 0:32; title card by 0:32
- [ ] AI and PayPal both shown working end to end on the real app
- [ ] The wow moment (phone approve → laptop updates live) is unmistakable
- [ ] Every speed-up/cut labelled; no fabricated screens; numbers match sources
- [ ] Voice clear, −14 LUFS, no clipping; captions burned in and in an SRT
- [ ] Text readable on a phone (≥ 36 px at 1080p); 96 px safe margins
- [ ] Brand matches the app (paper/ink/persimmon, Bricolage Grotesque, IBM Plex Mono)
- [ ] No third-party music/logos except PayPal and Channel3 UI inside the product
- [ ] No secrets, emails, tokens or account IDs visible (approval links blurred)
- [ ] End card: live URL + QR + repo + tagline, held ≥ 5 s

## Timeline

- 7 Nov night: Codex sets up `video/`, voice samples, motion-graphic scenes, recorder.
- 8 Nov: automated recording (user signs in to PayPal sandbox once); v1; Claude review → v2.
- 9 Nov: v3 final; upload to YouTube (public), check processing and captions.
- 10 Nov: Devpost text with the video link; submit.
