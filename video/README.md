# SpendConsent demo film

Source of truth: `../docs/video-plan.md`. Target 165 seconds, 1920×1080, 30 fps;
hard ceiling 175 seconds. Work stays here; app code is not changed, and private
configuration is not inspected. No cloud synthesis, paid APIs, stock assets or music.

## Current checkpoint: choose a voice

Four local Kokoro auditions use identical copy and speed. Listen in
`out/voice-samples/`, then choose A, B, C or D. The film, recorder and scene
narrations are intentionally pending this choice. `SetupSlate` is a development
slate, not product footage or a demo render.

| Choice | Voice | Locale |
| --- | --- | --- |
| A | Heart (`af_heart`), female | US |
| B | Michael (`am_michael`), male | US |
| C | Emma (`bf_emma`), female | UK |
| D | George (`bm_george`), male | UK |

From `video/` (all caches stay here):

```bash
export UV_CACHE_DIR="$PWD/.cache/uv"
export UV_PYTHON_DOWNLOADS=never
export npm_config_cache="$PWD/.cache/npm"
mkdir -p "$PWD/.cache/tmp"
# Short Linux alias avoids Chrome's Unix socket path limit in this long workspace.
# Run these commands with video/ as the current directory.
export TMPDIR=/proc/self/cwd/.cache/tmp
npm ci --no-audit --no-fund
uv sync --locked --no-dev --python /usr/bin/python3
npm run voices
npm run check:voices
npm run check
npm run studio
```

The first voice run downloads public versioned ONNX model files into `models/`
and verifies their SHA-256 against `models.json`. No account or API key is used.
Auditions are mono 48 kHz PCM WAV, normalized to −14 LUFS with a −1.5 dBTP
peak limiter (4× oversampling for the final level match).
Measured durations, loudness, peaks and hashes are saved in the output manifest.

## Recording boundary for the next phase

Use real app recordings only; do not synthesize app screens. Persistent Chrome
profile, raw recordings, outputs, models, environments and caches are ignored.
Before the first PayPal popup, hand off for the user's sandbox buyer sign-in;
do not record login or inspect credentials. Recording-only approval covers at
most six sandbox payments, each strictly below USD 100, and their refunds.
Maintain an ignored local action ledger before any money-moving step. No live
payments, publishing, deployment or submissions are authorized here.

Keep sandbox labels visible; redact links/tokens, emails and account IDs before
export. Measure real waits and label every shortened wait. Recheck facts before
scene work: the plan says ten-minute expiry but README says five minutes;
README supports 100+ backend tests rather than the plan's 150+ total; local
latency must be measured, not copied from the hosted deployment.
