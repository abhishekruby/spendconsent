# Video v4 patch (Claude's review of v3, 4713c52)

v3 is approved in structure. Keep the three-attempt story, tracker, script, voice,
sound and end card. This is a **small patch**: edit only the v3 edit plan and film,
re-synthesize only the voice lines that change, no new recordings, no payments, no
subagents, one final render. Do not re-run earlier checks that these edits cannot affect.

## Must fix

1. **Attempt 3: the voice and picture disagree (2:04–2:14).** The voice lists what
   the agent *can* do while the screen shows the `pay` call, so "Unknown tool pay."
   lands under "and ask the owner". New order:
   - "MAKE THE AGENT PAY." + VO: "Attempt three: the agent calls pay."
   - Terminal `tools/call pay`, 0.4 s silence, red **Unknown tool pay.** + VO:
     "That tool does not exist."
   - The four real tools + "approve / pay: no such tool" + VO: "It can find offers,
     prepare the cart, and ask the owner. It cannot pay."
   - Tracker 3/3 lands on the red error. Then **$0.00 moved.**

2. **The wow moment hides the actual change (1:10–1:22).** The laptop's flip happens
   small, in a whole-page shot after the stamp, then 6 s of near-identical frames. New order:
   - Phone: tick and tap, about 1.2 s.
   - 0.4 s silence, cut to the **requester laptop panel framed so the change is
     readable** (16:9, at least 768 px wide): grey
     "Approve exact cart" / "Waiting for the owner…" for about 0.8 s, then the real
     change to the green "Your approval: approved" happens on camera.
   - On that change: thud and the APPROVED slam, over the dimmed laptop footage, not
     blank paper.
   - Hold the green result with "live, no refresh" for about 2.5 s total. Delete the
     repeated frames and the 2 s phone-result shot where the cursor covers "exact".

3. **28 s of text before any product (0:04–0:32).** In the promise beat, give each
   line real footage: **AI SHOPS** with the two offer cards, **YOU DECIDE** with the
   phone Approve screen, **PAYPAL VERIFIES** with the four green steps. Large word
   beside the footage, never covering product text, about 2.5 s each. Shorten
   "AUTHORIZED BY YOU.", 19% and 60% to about 2.5 s each.

## Quick fixes

4. 0:06: the slide "MONEY." should read **THE WRONG MONEY.**
5. 1:24–1:30: put "THIS CART." / "NOTHING ELSE." beside the real cart-mandate shot
   instead of on blank slides. 1:40–1:48: show ✓ Amount / ✓ Payee / ✓ Order /
   Verified in a column beside the real "Payment confirmed" card.
6. Fix the order at 0:46–0:58: offers → rejected offers → Channel3 → then the exact
   cart with the "$5.80 less" banner, so the cart isn't shown before the comparison ends.
7. 2:23: the caption "Live right now." appears over "AI agents are already at the
   checkout". Align it with the ~14 s hosted beat.

Keep ≤ 2:55. Inspect 1 frame per second around 0:24–0:33, 1:08–1:20 and 2:02–2:16
at full size before reporting. Deliver the usual files as v4 and commit `video/`
source only.
