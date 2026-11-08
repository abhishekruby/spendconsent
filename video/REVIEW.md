# SpendConsent demo v3 — review notes

9 November 2026. Source: `../docs/codex-video-v3-brief.md`.
**2:45 · 1920×1080 · 30 fps · 60 shots · 43 caption cues.**
Final: **H.264 High / yuv420p / CRF 18 · AAC 48 kHz · −14.14 LUFS · −1.35 dBTP.**

## What changed

- Replaced the feature tour with a three-attempt challenge: missing size,
  one-cent pack-price change after approval, then the agent calling `pay`.
  The cold open withholds the real MCP rejection until **2:10**. Three shields
  track BLOCKED 0/3 → 3/3 throughout, including the dark terminal scenes.
- New script and locally synthesized Heart narration at **1.05×**. Eight scene
  WAVs use measured clauses and breathing room. Captions are whole natural
  phrases, 44 px, at most two lines, with persimmon keywords. The final proof
  sentence begins as a J-cut over the zero-dollar shot before its stat appears.
- Centred full-canvas stakes, promise and dare; 19% / 60% survey hits and fast
  160/160, 151, ~14 s proof hits. The approved-agent qualification appears above
  the retailer quotation, and the survey source identifies 2,080 UK adults.
- Every non-end-card shot is **four seconds or less**. Complete-page context
  leads into legible detail views; desktop crops remain 16:9 and at least
  768×432. A whole-or-absent sidebar guard checks the complete camera path.
  The eight-frame page-to-detail crossfade never pans through sliced sidebar words.
- Enlarged phone checkbox/tap, separate complete waiting viewports for 2.5 s,
  0.7 s full-width APPROVED and REVOKED slams, then the genuine requester update.
  The waiting label ends with the shortened wait; the live-update callout starts
  after the actual change. Rings identify the cart mandate and revocation.
- PayPal keeps the real $41.80, fictional address, INR line and complete portrait
  page. Only avatar and card digits are blurred. Actual payment button, one-second
  Thanks transition, all four green confirmation steps, ascending Amount / Payee /
  Order checks and three-second refund sequence use the existing genuine footage.
- Original low pulse, harmonic pad, ticks, thuds, rising check chimes and final
  dare lift are synthesized in code. Bed RMS is **18 dB below active voice**.
  Five deliberate **0.4 s silences** precede the title, approval, revocation,
  terminal rejection and zero-dollar slams. No third-party music or samples.
- Eight-and-a-half-second end card: “Try to make it pay without you.” Locally
  generated QR, public demo URL, test-money one-minute challenge and repository.

## Evidence and limits

- `evidence-v3.json`: fresh actual initialize, tools/list and tools/call `pay`
  transcript from the unchanged project MCP server. Literal **Unknown tool pay.**,
  `isError: true`, and the four actual tool names. The controlled rejection runs
  with backend access disabled because unknown tools are rejected before any API
  call; it creates no payment. Hook syntax is labelled request shorthand.
- `claims-v3.json` indexes the primary retailer/survey links and every cart,
  latency, test-count and zero-dollar claim. This is one retailer’s terms and a
  UK attitude survey, not an industry-wide contract rule or product-market proof.
- **$0.00 moved** is explicitly scoped to the three unauthorized attempts.
  The separate legitimate human-approved **$41.80 sandbox purchase and full refund**
  remain in the film. The one-cent change was to the pack price; the original
  session restored the pack price after the experiment. The recorded status is REVOKED.
- Reused **160/160 qualification outcomes, eight suites, six blind suites** and
  the existing **127 backend + 24 frontend = 151** passing v2 test results from
  8 November. No new application tests or AI comparisons were needed for this edit.
- **~14 s hosted** means the mean of recorded 14.356 s and 12.930 s waits,
  13.643 s. They are separate actual hosted takes. The first request asked for
  budget confirmation before the actual $60 answer chip led to the final result.
- Original phone approval and payment clips are separate genuine local takes
  of the same fictional-catalog cart; the phone is another browser viewport on
  this laptop. Existing recordings only: **zero new orders/payments/refunds** in v3.
- Read-only hosted readiness check returned HTTP 200, sandbox true and AI ready
  true (`out/v3/live-status.json`). This is point-in-time readiness, not uptime proof.
- All products are fictional and all money is sandbox. No app source changed,
  no secret configuration was read, no paid API was used and nothing was published.
  The repository remains private; judge access is the owner’s later choice.

## Inspection and validation

- Inspected all **165 frames of the 1-fps 960×540 draft sheet**, plus full-frame
  product/action samples. Corrected the terminal’s paper caption/tracker strip,
  enlarged the approval detail to 1350×900, and held the last real PayPal button
  frame before the native Thanks transition so Thanks appears for exactly one second.
- Targeted 540p replacement renders for frames 2085–2237 and 2841–2864 were
  assembled into the full draft and inspected again. No app screen was recreated;
  the only held pixels are actual recorded states. Final approval records the exact
  current source/media fingerprint in `out/v3/draft-approved.json`.
- Draft encode passes: **165.00 s / 4,950 frames, −14.14 LUFS, −1.35 dBTP**,
  H.264 High/yuv420p, AAC 48 kHz. All five encoded pre-slam silence windows pass.
  Every non-end-card shot is at most four seconds. TypeScript and the composition’s
  crop/sidebar/source guards pass. Actual browser-font measurement verifies all
  43 clauses fit in two lines (`out/v3/caption-layout-qa.json`).
- Completed **one final 1080p composition render**, then the delivery encode.
  `out/qa-v3.json` verifies 165.00 s / 4,950 frames, 1920×1080 at 30 fps,
  H.264 High/yuv420p, AAC 48 kHz, **−14.14 LUFS / −1.35 dBTP** and all five
  pre-slam encoded silence windows. There is no non-end-card shot over four seconds.
- Personally inspected **all 165 final 1-fps sheet frames and 11 full-resolution
  action frames**: AI understanding, actual question/answer chips, checkbox,
  approved mandate, both slams, PayPal amount/button, complete confirmation,
  real MCP rejection and end card. Evidence is in `out/v3/final-inspection/`.
  Main controls and proof stay readable, sidebars are complete or absent,
  the terminal tracker stays visible, and no desktop/editor or authority URL
  appears. Detail shots trim surrounding page context after establishing it.
- Final source/media fingerprint matches the inspected draft. No final-picture
  rerender or new financial action was needed. No subagents were used for v3.

## Placeholders and open questions

No product-footage or voice placeholders remain. No input is needed for this review.

## Review package

`out/spendconsent-demo-v3.mp4`, `out/contact-sheet-v3.jpg` (one frame per second),
`out/timeline-v3.json`, `out/captions.srt`, `out/captions-v3.srt`,
`out/qa-v3.json` and this file. Generated media is ignored; only `video/` source
and notices are committed.
