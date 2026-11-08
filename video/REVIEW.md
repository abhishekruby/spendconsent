# SpendConsent demo v1 — review notes

Updated 8 November 2026. Target and timeline: **2:45, 1920×1080, 30 fps**.
Verified final encode: H.264 High, limited-range `yuv420p`, CRF 18; AAC 48 kHz.
165.00 seconds / 4,950 frames; **−14.02 LUFS, −1.36 dBTP**, 38 caption cues.

## What changed

- User-selected Heart voice, phrase timing aligned to real actions, burned
  captions and SRT. Speech is not sped up. Original quiet thud/chime accents;
  no music or desktop audio.
- Eight scenes in the paper/ink/persimmon palette with the exact frontend font
  packages; QR/live URL and GitHub end card held for 6.5 seconds.
- Actual AI request, clarification chip, offers, Channel3 reference, exact cart,
  owner-phone approval and requester update, PayPal payment, receipt action,
  refund, one-cent revocation and real MCP transcript.
- Close-up cuts replace full-desktop frames for readability and privacy. All
  wait cuts/speed changes are labelled. No product screen or tool output is
  recreated. MCP source: `out/mcp-session.json`; cuts: `edit-excerpts.json`.
- Actual local comparison wait: 57.7 s; clarification inference: 62.0 s;
  MCP comparison: 56.3 s. The hosted ~14 s figure is not presented as local speed.
- Runtime cart expiry is ten minutes; approval validity is five minutes.
  Proof uses README's conservative **100+ backend tests**, plus the documented
  **160/160 AI outcomes, eight suites, six written blind**.

## Verified sandbox journey

One **$41.80 USD** payment reached server `PAID` / “Paid. All verified.” and one
full refund reached “Order cancelled. Refunded.” The earlier expired approval
was stopped without capture. Two orders were created, within the recording
approval's cap. Catalog pack price was restored from 1901 to 1900 cents after
filming the real `REVOKED` response.

## Editorial variations / review focus

- The payment result uses the real all-green “Payment confirmed” receipt card;
  the initial desktop focus loss after the PayPal popup is excluded. Only the
  real PayPal header/button, foreground receipt and refund ranges are used.
- Owner view is a real separate phone-sized browser context on the same laptop.
  The close-up split is labelled requester left / owner phone right; this is
  viewport emulation, not a claim of a second physical device.
- Refund is shown from the paid receipt rather than the Purchases drawer.
- A dedicated rejection-reason close-up is an editorial option for the next
  review; v1 prioritizes the actual eligible offers, totals and clarification.
- Macro crops deliberately exclude peripheral UI; review the pacing and phone
  readability, especially the approval split. No placeholder product footage
  remains in the ready composition.
- The end-card demo URL returned HTTP 200 on 8 November. The repository remains
  private; judge access/publication needs the owner's later decision.

## Validation

- Independent combined source review found no remaining actionable bugs after
  financial-control, authentication/privacy and evidence-export fixes.
- Guard checks, TypeScript, cut-plan checks, caption timing and MCP excerpt
  matching passed. Representative shopping, approval, payment and MCP frames
  were visually checked for layout and privacy.
- `check_delivery.py --version 1` passed on the finished MP4: dimensions,
  frame rate/count, duration, High profile, `yuv420p`, AAC 48 kHz, loudness,
  true peak, SRT cue count and review artifacts. Report: `out/qa-v1.json`.
- Full contact sheet inspected: eight scenes, real payment/refund/revocation
  proof, labelled edits, readable end card, no background editor or exposed
  approval URL/account identifiers in the selected shots.
- Final encoding explicitly converts the Remotion full-range picture to
  BT.709 limited-range `yuv420p`; the delivery check caught the initial range
  mismatch before delivery.
