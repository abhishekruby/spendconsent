# SpendConsent demo film

1920×1080 · 30 fps · 165 seconds. Story source: `../docs/video-plan.md`.
User-selected narration: Kokoro Heart (`af_heart`), US English, speed 0.96.
No paid service, stock asset, third-party music or cloud synthesis is used.

## Review files

`out/spendconsent-demo-v1.mp4`, `out/contact-sheet-v1.jpg`,
`out/timeline-v1.json`, `out/captions.srt`, `out/qa-v1.json` and `REVIEW.md`.
Generated media, original recordings, models, caches and browser profiles are
ignored. Only source and notices are committed.

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
npm run render -- 1
```

Rendering requires the original local takes in `raw/`. `prepare_clips.py`
contains the audited cut/crop map for these particular takes and writes
`edit-excerpts.json`. Retakes require updating that map and reviewing the
selected frames. It never recreates product pixels. After reviewing the ten
prepared clips and the real MCP evidence, set `src/edit.json`'s `ready` to
`true`; preparation deliberately resets it to `false`. The final renderer
refuses incomplete evidence. `npm run studio` opens the composition preview.
The renderer generates the QR, SRT, per-scene timeline, normalized master,
MP4, three-second contact sheet and encoding/audio QA report.

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
