# Video v2 corrections (Claude's review of v1, commit 3f632fa)

Rejected. The motion design, palette, voice and story order are good, and the raw
recordings are mostly good. The edit destroys them.

## Root cause

`scripts/prepare_clips.py` / `edit-excerpts.json` cut thin strips out of the page
(650×80, 650×115, 300×180, 330×65) and stretch them into a 1920×600 clip, shown
in a 1728×552 stage (3.1:1). Viewers never see a page, only slices of one. The
owner scene puts two 300×180 slices in one clip and they overlap. Heading, chapter
counter, eyebrow, chips and captions use half the frame.

Delete that approach. **Viewers must always see a real, whole, recognisable page.**

## New layout rules (enforce them in code)

Canvas 1920×1080.
- **Footage card:** 1600×900 at x=160, y=28, radius 16, hairline border, soft
  shadow. Exactly 16:9, so footage is never letterboxed or stretched.
- **Bottom strip** (y 940–1070, on paper, never over footage): captions centred,
  ≥ 40 px, max 2 lines. Left: one chapter word. Right: a wait label only when needed.
- Remove during footage: heading row, "01 / 08", red eyebrow, chip rows. Title
  phrases ("Paid means verified.") get their own 1.2 s beat before the clip, or sit
  in the strip. Keep the thin progress line at the very bottom.
- **Standard framing:** source crop x 280–1640, 1360×765. It holds the tracker, the
  main column and the "Sandbox · test money" pill. Choose y per shot.
- **Zoom limit:** tightest crop 1000×562. Every crop on the desktop app is exactly
  16:9. No strips, ever.
- **Camera:** ease between framings over 500–800 ms, or use the real page scroll
  from the recording. Otherwise a 250 ms crossfade. Each shot ≥ 3 s, key shots ≥ 4 s.
- **Nothing covers product text.** Rings and callouts sit around content.
- **Labels:** delete "CUT · …", "HOLD · real footage", "SPEED ×2". Ordinary edits
  need no label. Only a compressed wait gets one, in the strip, e.g. "AI wait
  shortened · real: 14 s".
- **Never in frame:** browser tabs/address bar, 127.0.0.1, desktop, taskbar, the
  Codex window, or any other project or client name. C4 shows these around the
  windows. C5 and C7 contain long stretches of the Codex window: never use them.
  Also skip the white loading flash in C4 (about 16 s).

Add a guard to the build that fails if any desktop crop is not 16:9, is narrower
than 1000 px, or if any two footage panels intersect.

## Re-record only this

**C1-describe and C3b-ask**, against `https://spendconsent.ullagecloud.com`. No
payment is involved. The local waits (57.7 s, 62 s) were slow because the laptop
was busy; the hosted AI takes about 14 s. Use the same request text. Record inside
a nested display so the desktop cannot leak: `Xephyr :99 -screen 1920x1080`
(installed), Chrome `--app=<url>` at 0,0, `ffmpeg x11grab` on `:99`. Measure the
real wait and put that number in the label.

Re-record C4 or C5 only if a moment below cannot be obtained from the existing
clips. If so, use the same nested display. That would use one more sandbox payment,
inside the existing approval.

## Scene by scene

1. **Cold open.** Replace the slice and the empty black box with three real
   beats, about 1.3 s each: owner phone tap, "Payment confirmed" card, terminal
   with its line already typed. The black terminal must never be blank.
2. **Who + idea.** 0:21–0:32 is static for 11 s. Build three steps — "AI shops",
   "You decide", "PayPal verifies" — lighting up exactly as the voice says each.
3. **AI.** Whole page in standard framing: typing → "Finding what fits…" → "What
   the AI understood" (zoom to the card) → the ask with answer chips → **both offer
   cards fully visible** ($41.80 highlighted, $47.60 below; C2 about 5 s is ideal) →
   real scroll to **Real-world prices with at least two listings** and "via
   Channel3" → the "2 offers ruled out" section. v1 omitted the rejections and
   showed Channel3 as one line above grey skeletons.
4. **Exact cart.** "Check it, then approve." with the green "$5.80 less" banner,
   then zoom to the whole receipt, ring around the countdown. No grey skeleton frames.
5. **Owner (the wow).** Two separate panels, side by side, gap ≥ 40 px, **never
   overlapping**. From C4, crop to the exact page viewports only (measure the
   pixels; roughly requester x 23–1358, y 106–1054; owner x 1420–1810, y 106–950).
   Requester about 1240×875 on the left, owner in a phone bezel about 405×875 on the
   right, both complete. Show in order: requester "Waiting for the owner to
   approve…" + phone "Approve this purchase?" → phone scrolls, box ticked, Approve
   tapped → phone shows approved → requester changes by itself to "Your approval:
   approved" and the toast "The owner approved this exact cart" (pulse ring on that
   change, label "live, no refresh"). The APPROVED stamp must not cover text.
6. **PayPal.** Show the real PayPal page as its own centred panel (C5 start, column
   about x 660–1255, y 0–620, scaled up on paper), so PayPal is recognisable. Ring
   the **$41.80** and the Complete Purchase click, then "Thanks for using PayPal".
   Do not blur or edit the ₹ line; the ring directs the eye. Then the whole
   "Payment confirmed" card with all four green steps (C6 start is clean). Delete
   the giant "Download receipt" button; it stays normal size in the page. Animate
   the read-back checks one by one. Refund: the "Need to cancel this order?" card →
   click → "Order cancelled and refunded", in context.
7. **Safety + agents.** Frame the review card at 1100×619 so APPROVED → REVOKED is
   legible, ring on the stamp, callout "+$0.01 → approval revoked". For MCP, add a
   clear graphic of the four real tools (`find_offers`, `prepare_cart`,
   `request_owner_approval`, `purchase_status`), then "approve / pay — no such
   tool", beside the real transcript.
8. **Proof.** Change "100+ backend tests" to **150+ automated tests** (127 backend
   + 24 frontend, run them to confirm). Add **~14 s per comparison, hosted** using
   the measured value. Caption must read "160 out of 160", in digits.

Keep: Heart voice, script, palette, fonts, QR end card, honesty about sandbox,
loudness and export settings. Length ≤ 2:55.

## Before you stop

Render v2 and inspect it yourself: a contact sheet with **one frame every 2 s**,
and full-size frames at every scene change. If you see any strip, overlap, cut-off
page, blank panel, or anything from the "never in frame" list, fix it and re-render
before reporting. Deliver the same four review files as v1, named v2, and commit
`video/` source only.
