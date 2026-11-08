# SpendConsent demo v2 — review notes

8 November 2026. **2:45 · 1920×1080 · 30 fps.**
Source correction brief: `../docs/codex-video-v2-corrections.md`.
Final encode verified: H.264 High, limited-range yuv420p, CRF 18; AAC 48 kHz.
**165.00 s / 4,950 frames · -14.02 LUFS · -1.36 dBTP · 38 caption cues.**

## What changed

- Deleted the strip-crop pipeline. Every ordinary desktop source region is
  16:9 and at least 1,000 pixels wide. The main footage card is 1600×900 at
  (160,28); captions stay in the bottom paper strip at 40 px, at most two lines.
- Recorded C1 and the missing-size request again on the real hosted sandbox,
  in Chrome app/kiosk mode inside a private 1920×1080 Xephyr display.
  Actual browser waits: **14.356 s** and **12.930 s**; mean **13.643 s**, shown
  as **~14 s, hosted**. The first request asked for budget confirmation; the
  actual $60 answer chip was used before the completed comparison was recorded.
- Whole-page shopping now includes the AI-understood card, genuine size-answer
  chips, both complete $41.80 / $47.60 offer cards, a real scroll to five loaded
  Channel3 listings and both rejection reasons. Exact-cart footage includes
  the $5.80 comparison banner, the whole receipt and its countdown.
- Owner approval uses separate complete requester and phone viewports with a
  40 px gap. The actual scroll, checkbox/tap, phone approval, requester change
  and toast remain synchronized. The ring and APPROVED stamp avoid product text.
- PayPal is a complete centred portrait view: $41.80, Complete Purchase and
  the genuine Thanks screen. Buyer/avatar/address/card identifiers are blurred;
  **₹4,086.85 and the conversion rate are unchanged**. The whole confirmed card
  shows all four green steps. Read-back checks appear in sequence; refund
  remains in the actual paid-page context with a normal-sized receipt button.
- Revocation uses a 1104×621 review frame and actual APPROVED → REVOKED footage.
  MCP pairs the four real tool names with a progressively revealed real
  transcript. The first line is always present, including the cold open.
- Closing proof: **160 out of 160** in captions, 150+ automated tests, hosted
  latency, Agent → Exact cart → Owner → PayPal → Verified, QR and 6.5 s end card.
- Ordinary edits have no CUT/HOLD/SPEED tags. Compressed AI, approval, PayPal,
  refund and price-change waits are labelled. Playback remains 1×; real static
  states are held for breathing room. Transitions overlap for eight frames.

## Evidence and limits

- **127 backend + 24 frontend = 151 passing automated tests**, run on
  8 November; logs in `out/v2/`. The 160/160 AI qualification, eight suites and
  six blind suites come from the repository's existing qualification evidence.
- V2 uses the original verified $41.80 sandbox capture and full refund; it
  created no additional order/payment/refund. Original recording totals remain
  two order attempts, one verified capture, one verified full refund.
- These are separate genuine takes of the same fictional-catalog cart. The
  owner phone is a separate browser viewport on this laptop, not a second
  physical device. No product screen or MCP output is recreated.
- Exact cuts, complete source regions, 1× speed and crossfades are recorded in
  `edit-excerpts.json`. Measured facts are in `recorded-facts.json`; original
  recordings and the sanitized MCP transcript stay private in ignored folders.
- No app code changed, no publication occurred, and no paid service was used.
  The GitHub repository remains private; judge access is the owner's later choice.

## Placeholders and open questions

No product-footage placeholders remain. No input is needed for this review.

## Validation

- TypeScript, financial recording guards, hosted read-only route guards and
  whole-page crop/source-range regression checks pass.
- Independent combined review checked all 18 prepared clips at 36 endpoint
  samples: complete pages, loaded listings, rejection reasons, approval toast,
  preserved INR line, refund and revocation. It found transition flashes;
  overlapping opaque fades fixed them before the final render.
- Inspected the finished 83-frame contact sheet (one frame every two seconds),
  all 16 full-size scene-boundary/start-plus-0.6 s frames, and additional full-size
  action/transition frames. Corrected a misplaced safety ring and selected a
  clean payment-confirmed moment without the browser download notice, then
  re-rendered the affected moments and repeated final QA and frame inspection.
- The final inspected render has no strip crops, overlapping footage panels,
  blank product/terminal panels, browser address bars/tabs, localhost URLs,
  desktop/editor imagery or exposed approval tokens/account identifiers.
  Primary offer, AI, receipt, confirmation and refund cards stay complete;
  naturally scrolling pages and the exact owner viewports remain recognisable.
- `out/qa-v2.json` verifies duration/frame count, H.264 High/yuv420p, 30 fps,
  AAC 48 kHz, loudness/peak and all 38 caption cues. Boundary frames and their
  exact times: `out/v2-scene-boundaries/frames.json`. Contact timestamps sit
  below each complete thumbnail so the caption strip remains visible.
- Review package: `out/spendconsent-demo-v2.mp4`, `out/contact-sheet-v2.jpg`,
  `out/timeline-v2.json`, `out/captions.srt` and `out/captions-v2.srt`.
