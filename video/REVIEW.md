# Review checkpoint — voice auditions, 7 November 2026

## Changed

- Isolated Remotion / React / TypeScript setup at 1920×1080, 30 fps.
- Frontend paper/ink/persimmon tokens and the exact two font package versions.
- Local CPU Kokoro-ONNX pipeline, four comparable US/UK female/male auditions,
  two-pass loudness normalization, output manifest and a runnable artifact check.
- Dependency locks, model checksum manifest, asset credits and ignored private
  profile/raw/output/model/cache folders.

## Validation

- `npm run check:voices` passed: all four WAV hashes and durations match the
  manifest; mono 48 kHz PCM; −14.47 to −14.04 LUFS; −1.50 dBTP on every sample.
- `npm run check` passed. Remotion bundled and rendered `out/setup-slate.png`
  with installed Chrome. The 1920×1080 frame was visually inspected: the actual
  fonts, palette and 96 px margins render correctly, with no overflow.
- Chrome needs the short `/proc/self/cwd/.cache/tmp` TMPDIR alias documented in
  README to avoid Unix socket path limits in this workspace. It resolves inside
  `video/`; no separate browser profile outside this folder is needed.
- Listening and voice choice remain the user's review step. These technical
  checks do not establish preferred vocal style or pronunciation quality.

## Pending / placeholders

`SetupSlate` is a labelled development slate. No product screens, real MCP
transcript, footage, captions, complete film timeline, contact sheet or final
video have been created. No payments or refunds have been attempted. Step 2
and later remain pending the explicit voice-choice pause in the user brief.

## Open questions

1. Choose **A Heart (US female), B Michael (US male), C Emma (UK female), or
   D George (UK male)** after listening. All use the same text and speed 0.96.
   Listen especially for "SpendConsent" and "PayPal" pronunciation.
2. Verify the running app's actual cart expiry: video plan says ten minutes;
   README's table says five. Do not silently choose either.
3. Verify test-count evidence before displaying 150+: README currently supports
   100+ backend tests plus frontend tests. The 160/160 AI result is supported by
   README and impact evidence, but is a benchmark, not customer adoption proof.
4. Measure every local AI wait; do not reuse the hosted ~14-second figure as a
   local measurement. Survey claims need their source line and sample scope.

## Next action

Stop for the user's voice selection, then build the non-footage scenes and
recorder. Ask before opening the first PayPal sign-in popup; the user controls
credentials and must leave the laptop idle during automated recording. Do not
record the login. Keep at most six sub-$100 sandbox payment attempts in a local
ledger. Every shortened wait and all payment scenes need the required labels.
