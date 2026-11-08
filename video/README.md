# SpendConsent demo film

1920×1080 · 30 fps · 165 seconds. V3 story source: `../docs/codex-video-v3-brief.md`.
User-selected narration: Kokoro Heart (`af_heart`), US English, speed 1.05 for v3.
No paid service, stock asset, third-party music or cloud synthesis is used.

## Review files

`out/spendconsent-demo-v3.mp4`, `out/contact-sheet-v3.jpg` (one frame per second),
`out/timeline-v3.json`, `out/captions.srt`, `out/qa-v3.json` and `REVIEW.md`.
Generated media, original recordings, models, caches and browser profiles are
ignored. Only source and notices are committed.

## V3 rebuild (existing recordings only)

Use the installed, locked environment from `video/`. V3 performs no new recording,
order, payment, capture or refund. It reuses the 151 passing v2 app tests.

```bash
uv run --locked --no-dev python scripts/narrate_v3.py
uv run --locked --no-dev python scripts/edit_v3.py
python3 scripts/prepare_v3.py
uv run --locked --no-dev python scripts/score_v3.py
npm run check
npm run render:v3 -- draft
```

Inspect the actual 960×540 draft and its one-frame-per-second contact sheet.
The final renderer requires `out/v3/draft-approved.json` containing the current
`node scripts/render_v3.mjs fingerprint` hash and `visualReviewPassed: true`. Run
`npm run render:v3 -- final` only after inspection. An exclusive marker prevents
a second final 1080p composition render. It writes the final H.264 High/yuv420p,
CRF 18, AAC 48 kHz movie, captions, timeline, contact sheet and encoded audio QA.
This gate records the operator's actual inspection; it does not ask for a user
approval or perform an automated aesthetic review.

`src/v3/film.tsx` validates native bounds, minimum 760×428-equivalent desktop
crops, 16:9 aspect, whole-or-absent sidebar and every intermediate detail camera.
A short crossfade moves from the complete page to the detail without panning
through sliced sidebar words. Separate complete requester/phone viewports establish context; phone and PayPal
detail cuts use real recorded regions. `src/v3/assets.json` inventories all 23 real takes;
`src/v3/timeline.json` records all 60 shots, voice timing and sound events.

`python3 scripts/evidence_v3.py` reproduces the actual unknown-pay-tool rejection
with backend access disabled. It does not invoke an app or payment API.
`claims-v3.json` links every statistic, cart number and scoped zero-dollar claim
to its source. The original synthesized score is mixed about 18 dB under active
speech, with deliberate 0.4 s pre-slam silences and a −14 LUFS final master.
All eight scene WAVs and natural-clause SRT captions are generated locally.

The sections below preserve the v2 recording/rebuild instructions for provenance;
they are not steps required by v3.

## Reproduce locally

Run from `video/`. Node 22.14.0, Python 3.12.3, FFmpeg 6.1.1 and installed
Chrome are used; npm and uv dependencies are pinned in both lockfiles.

```bash
export UV_CACHE_DIR="$PWD/.cache/uv"
export UV_PYTHON_DOWNLOADS=never
export npm_config_cache="$PWD/.cache/npm"
npm ci --no-audit --no-fund
uv sync --locked --no-dev --python /usr/bin/python3
npm run narrate
npm run pace
npm run prepare
npm run check
npm run check:guards
npm run render -- 2
```

Rendering requires the original private takes in `raw/`, including the two hosted
v2 takes and their measured event manifest in `raw/v2/manifest.json`.
`prepare_clips.py` validates complete viewports, 16:9 desktop crops at least
1000 pixels wide, safe source ranges and no speed-ups, then writes the exact
provenance to `edit-excerpts.json`. Preparation activates readiness only after
all 18 clips are prepared. The composition additionally rejects missing crops,
invalid viewport kinds, overlapping panels and unsynchronized owner views.
`npm run studio` opens the composition preview. Rendering generates the QR,
SRT, per-scene timeline, normalized master, MP4, two-second contact sheet and
encoding/audio QA report. Always inspect the actual render before sharing.

Original scene WAVs remain in `out/voice/`. `pace_voice.py` places their
phrases beside the real actions without speeding speech; final one-scene
WAVs are in `out/voice-paced/` and `public/voice/`. Long caption phrases are
split into sequential readable cues. Original thud/chime accents are
synthesized in `master_audio.py`; there is no music or recorded desktop audio.

## Record a new take

Start the existing app with `../scripts/run_demo.sh`, then `npm run record`.
The driver uses headed Chrome kiosk at 1920×1080, persistent private profile
`.chrome-profile/`, injected cursor/ripples and FFmpeg X11 capture. JSON-line
commands arrive on stdin, for example:

```json
{"op":"start","name":"C1-describe"}
{"op":"stop"}
```

The user must leave the laptop idle while capture runs. Sign-in is user-only;
recording stops before every checkout opening and authentication navigation.
No password, email or OTP value is read or typed. Native pointer control is
restored for handoff. Credentials and authority URLs never enter command-line
arguments. The recorder keeps the intended app surface above the editor and
stops on a page crash; all selected source ranges still need visual review.

Financial operations are separate guarded commands tied to the request,
review, attempt, provider order, exact USD total and sandbox environment.
The private `.cache/action-ledger.json` caps this authorized recording at six
order attempts, each strictly below $100, and prevents blind payment/refund
retries. Do not reset the ledger during this recording project. Fresh financial
work needs its own applicable user authorization. No publication is performed.

`npm run capture:mcp` runs the unchanged real MCP server against the local app.
Its owner-browser helper receives the approval URL through stdin, never argv.
`out/mcp-session.json` retains sanitized responses; the film uses verified
literal excerpts. Capture this outside an active desktop take: it opens a
real, separate owner browser briefly.

The short temporary path uses `/proc/<render-or-recorder-pid>/cwd/.cache/tmp`
to avoid Chrome Unix socket path limits while keeping files inside `video/`.
App source remains unchanged. Private `.env` and `.runtime/` contents are not inspected by these video tools.
See `CREDITS.md` for assets, notices and free-use eligibility.

## Hosted v2 capture

The approved correction takes use the hosted sandbox and an isolated X11 display:
`Xephyr :99 -screen 1920x1080`, with a private Xauthority cookie, no TCP listener,
and Chrome app/kiosk mode. `npm run record:hosted` uses the video-owned private
profile and FFmpeg `:99.0+0,0`. It permits only comparison, clarification and
review writes; approval and financial routes are blocked. `node
scripts/record_hosted.mjs --check` checks this boundary without opening a browser.
Only `C1-describe` and `C3b-ask-take2` are used from these hosted recordings;
C1 continues through real offers, loaded retail listings, rejections and review.
No additional payment or refund was needed for v2.

The v2 corrections supersede v1 framing and editorial labels. Ordinary edits
are unlabelled; only compressed waits carry a label. Final static states may
breathe without changing pixels. Desktop source crops stay 16:9 and are never
stretched into strips. Owner panes are separate complete measured viewports.

For a fresh private display, run this from `video/` before the hosted recorder
(leave an existing recording display running rather than starting it twice):

```bash
python3 - <<'CAPTURE_DISPLAY'
from pathlib import Path
import os, secrets, subprocess
os.umask(0o077)
cache=Path('.cache');cache.mkdir(exist_ok=True)
auth=cache/'xephyr-v2.auth';auth.touch(mode=0o600,exist_ok=True)
subprocess.run(['xauth','-f',str(auth.resolve())],
    input=f'add :99 . {secrets.token_hex(16)}\n',text=True,check=True,
    stdout=subprocess.DEVNULL)
with (cache/'xephyr-v2.log').open('w') as log:
    subprocess.Popen(['Xephyr',':99','-screen','1920x1080','-nolisten','tcp',
        '-noreset','-auth',str(auth.resolve()),'-title','SpendConsent capture'],
        stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
CAPTURE_DISPLAY
node scripts/record_hosted.mjs
```

The cookie is generated locally and passed through stdin, never printed or
placed in command arguments. The auth file and capture profile remain ignored.
