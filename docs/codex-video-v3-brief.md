# Video v3 brief: "We tried to make it spend" (Claude's review of v2, 58dfb89)

v2 fixed the broken screens, so keep its clean pipeline, whole-page recordings,
palette, fonts and Heart voice. But it is a calm feature tour: every scene has the
same shape and energy, nothing is at stake, and nothing makes a viewer want the next
shot. v3 changes the **story, script, rhythm and sound**. No new payments.

To save usage: no subagents, reuse all existing clips and test results, draft at
960×540, and do only one final 1080p render.

## The new idea

The film becomes a challenge. We open a question and keep it open for 2 minutes:
**we tried three ways to make the AI spend the wrong money.** A visible tracker
(blocked 0/3 → 3/3) makes people stay for the next attempt. All three are real.

| Technique | Where it is used, truthfully |
|---|---|
| Curiosity gap | Cold open: an agent calls `pay(...)`, cut before the result; paid off at 2:10 |
| Unfinished progress | "BLOCKED 0/3" tracker on screen from the hook to the climax |
| Loss aversion | Real retailer terms: your agent's purchase counts as authorized by you |
| Social proof | 19% / 60% survey numbers |
| Anticipation → release | "Waiting for the owner…" ticking → 0.4 s silence → tap → stamp thud |
| Peak-end | Biggest moment last; ends on a dare, not a summary |
| Participation | "Try to make it pay without you." QR, test money, one minute |

**Never use fake urgency or scarcity** ("limited spots", invented incidents or
numbers). The honesty rules from earlier briefs still apply.

## Script (about 2:45; timings follow the voice)

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:09 **Cold open** | Black. Terminal types `agent > pay($41.80)`, cursor blinks, hard cut before any result. Huge centred words, one at a time. Three empty shields appear. | We gave an AI a shopping job. Then we tried three ways to make it spend the wrong money. |
| 0:09–0:22 **Stakes** | Full-canvas quote card: Purchases by an AI agent you approved “are considered transactions authorized by you.” Source line: "A major US retailer's terms, updated Sept 2026" (no retailer name or logo). Hard cut: **19%** huge. Hard cut: **60%** huge, source line ACI Worldwide / YouGov. | One major retailer's terms already say your AI agent's purchases count as authorized by you. Only one in five people trust AI to buy for them. And most would quit after one mistake. |
| 0:22–0:32 **Promise** | Title slam **SpendConsent**. "One person orders. Someone else pays." Then AI shops / You decide / PayPal verifies, each landing exactly on its word. | SpendConsent is for small teams where one person orders and someone else pays. The AI shops. A person decides. PayPal verifies. |
| 0:32–0:58 **AI + Attempt 1** | Typing (cut to about 2.5 s) → wait compressed to about 1.5 s with its label → zoom "What the AI understood", tags pop in. Banner **ATTEMPT 1 · MAKE IT GUESS**. Request with no size → push in on the ask and answer chips → tracker 1/3, thud. Both offer cards, ring $41.80, "$5.80 less". Channel3 listings 3 s only. | Say what you need in plain words. Our self-hosted AI reads it in about fourteen seconds. Attempt one: we left out the size. It doesn't guess. It asks. Then code, not the AI, checks every offer to the cent, and real retail prices from Channel3 show if the deal is fair. |
| 0:58–1:32 **The only way through** | Receipt, push in on the total, ring on the countdown (4 s). Split laptop + phone, "Waiting for the owner…" with ticking, held 2.5 s at most. Phone fills the frame: tick box, tap. 0.4 s silence. Full-width **APPROVED** slam + thud. Whip to the laptop panel at full size as it changes by itself (pulse, "live, no refresh"). Zoom on "cart mandate… Any change voids it." | This is the exact cart. It expires in ten minutes. And nothing moves until the person paying says yes. One tap on their phone, and the laptop updates by itself. That yes fits this cart, and nothing else. |
| 1:32–1:52 **PayPal** | PayPal page, ring $41.80, click, "Thanks" 1 s at most. Zoom on the four green steps. ✓ Amount ✓ Payee ✓ Order land one at a time with rising chimes. Refund 3 s. | PayPal runs the payment. We call it paid only after our server captures it and reads it back from PayPal. Change your mind? A full refund, verified the same way. |
| 1:52–2:20 **Attempts 2 and 3 (climax)** | **ATTEMPT 2 · CHANGE THE PRICE**. Review card framed tight, "+$0.01", ticking, silence, APPROVED → **REVOKED** (ring, huge callout), tracker 2/3. **ATTEMPT 3 · MAKE THE AGENT PAY**. Terminal: real `tools/call pay` → real red `Unknown tool pay.` The four real tools; "approve / pay: no such tool". Tracker 3/3. Full screen: **$0.00 moved.** | Attempt two: after approval, we raised the price by one cent. Approval revoked. Attempt three: the agent calls pay. It can find offers, prepare the cart, and ask the owner. But that tool does not exist. |
| 2:20–2:45 **Proof + dare** | Fast stat hits, 1.5 s each: 160/160 AI tests · 151 automated tests · ~14 s hosted. Then huge: "AI agents are already at the checkout." End card (≥ 5 s): **Try to make it pay without you.** QR, URL, "Test money · one minute", repo, tagline. | 160 out of 160 AI tests. Live right now. AI agents are already at the checkout. This is what yes should look like. Try to make it pay without you. |

Attempt 3 must be real: run `tools/call` with name `pay` against
`scripts/spendconsent_mcp.py` and animate its actual output (I verified it returns
`Unknown tool pay.`). Record it in the evidence file.

## Edit rules (replace v2's)

- **No shot over 5 s** except the end card; aim for 2.5–4 s. Something must change
  at least every 2 s: a push-in, ring, word or counter. v2 held 9–12 s at 0:03–0:12,
  0:18–0:32, 0:51–1:02, 1:15–1:27, 2:15–2:27 and 2:30–2:39.
- **Show the page for about 1 s, then push in** on what the voice is describing, so
  product text is readable on a phone. Crops stay 16:9, minimum 760×428.
- **Crops include the whole sidebar or none of it.** v2 slices words ("escribe",
  "ompare") at 0:39, 0:54 and 0:57. Update the guard to catch this.
- **Text slides fill the canvas**, centred, 120–200 px. v2 sits top-left with the
  lower half empty (0:03–0:32, 1:54–2:00, 2:30–2:39). One idea per slide, hard cuts.
- **Tracker:** three shields in the bottom strip's left area, ≥ 36 px, "BLOCKED 1/3",
  animating each time. It replaces the chapter word.
- **Captions:** one phrase at a time, broken at natural pauses, key word in
  persimmon, ≥ 44 px. Never split a clause like v2's "server reads it and…".
- **APPROVED and REVOKED must be the biggest moments in the film** (v2's APPROVED
  is a tiny tag at 1:36). Slam full-width for about 0.7 s, without hiding the product change.
- **Wait labels:** keep them only where real time was removed, one line, ≥ 26 px. Do
  not show "Approval wait shortened" over a long hold; cut the wait instead.
- **PayPal page:** the delivery address is fictional, so un-blur it. Blur only the
  avatar and card digits. v2's blur makes PayPal look broken. Toasts must not cover
  the point of a shot (2:06).

## Sound (v2 has no music, which is a large part of why it feels flat)

Original, synthesised in code only: a low pulse that builds through tension
sections, ticks during waits, **0.4 s of silence before each slam**, thud on stamps,
rising chimes on the checks, a lift on the final dare. Keep the bed about 18 dB
under the voice. Add 0.3–0.5 s pauses before punchlines and try Kokoro at 1.05 speed.
Final mix −14 LUFS.

## Before you stop

Inspect a 1-frame-per-second sheet yourself. Reject any hold over 5 s, sliced text,
empty half-canvas, or a claim without a source. Confirm the film is ≤ 2:55. Deliver
the usual four review files as v3 and commit `video/` source only.
