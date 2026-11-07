# Prompt for Codex — build the SpendConsent demo video

Paste everything below the line into Codex (local Codex CLI or the Codex app,
working in this repository folder, highest reasoning setting).

---

You are a senior motion designer and video engineer. Build the 2:45 demo video
for SpendConsent, our PayPal AI Hackathon 2026 entry, as code in a new `video/`
folder of this repository. Judges may score us from this video alone, so it must
look like a polished product launch film: calm, premium, clear, honest.

## Read first (and only these)
- `AGENTS.md` — the rules apply to you: zero cost, no secrets, sandbox only.
- `docs/video-plan.md` — the script, timing, shot list and quality checklist.
  It is the source of truth for the story and the voiceover text.
- `frontend/src/style.css` (top: design tokens) and `frontend/package.json`
  (font packages) — match the product's look.
- `README.md` sections "AI" and "MCP" — for the true numbers and claims.

## Hard rules
- Work only inside `video/` (plus one line in `.gitignore` if needed). Never edit
  app code, never read `.env` or `.runtime/`, never start or approve payments.
- Zero cost: open-source/free tools only; no paid APIs, no trials, no stock sites.
- Honesty: the product is shown only through real screen recordings from
  `video/raw/`. Motion graphics explain; they never fake product screens. Any
  speed-up or cut of a wait gets an on-screen label (e.g. "AI wait shortened ·
  real: 14 s"). Keep "Sandbox · test money" visible in payment scenes.
- No third-party music, logos or trademarks except PayPal and Channel3 UI as it
  appears inside our product. Do not show Claude/ChatGPT/OpenAI branding.
- Blur approval-link URLs/tokens, emails and any account identifiers in clips.
- Pin exact dependency versions; record every asset and licence in
  `video/CREDITS.md`.

## Stack
- Remotion (free for individuals) with React + TypeScript, 1920×1080, 30 fps.
- Fonts: Bricolage Grotesque + IBM Plex Mono from the same OFL npm packages the
  frontend uses. Colours: the app's paper/ink/persimmon tokens.
- Voice: Kokoro TTS run locally (Apache-2.0; prefer `kokoro-onnx`). First render
  4 short samples (2 female, 2 male US/UK voices) to `video/out/voice-samples/`
  and stop for the user to choose. Then one WAV per scene; scene lengths follow
  the voice durations plus breathing room.
- Music: none from third parties. Optional: a very quiet ambient pad you
  synthesise yourself in code, ducked under the voice. The app's own UI sounds
  in the recordings are welcome.
- ffmpeg for remux/loudness (if missing, tell the user: `sudo apt install ffmpeg`).

## Build
1. `video/` Remotion project: one composition per scene (8 scenes from the plan)
   plus a `Main` composition that sequences them; shared components:
   kinetic title, caption track, callout chip, zoom/pan on a clip region
   (smooth ease, no shaky Ken Burns), highlight ring, split laptop+phone frame,
   animated terminal, stat counter, flow diagram, end card, chapter progress bar.
2. Motion style: restrained and premium — 250–600 ms ease-out moves, spring
   only for the APPROVED/VOID stamps, no spinning, no glitch, no stock
   transitions. Text ≥ 36 px, key text ≥ 64 px, safe margins 96 px.
3. Scenes 1, 2, 7 (terminal) and 8 need no footage: build them now. For the
   terminal, run the real MCP server against the local app if it is running
   (`scripts/run_demo.sh`, `python3 scripts/spendconsent_mcp.py`) and animate
   that real transcript; label it "real MCP session". If the app is not
   running, ask the user to start it — never invent tool output.
4. Footage scenes (3–7) use `video/raw/C1…C7`. Until the clips exist, show a
   labelled placeholder with the clip name so timing can be reviewed.
5. Captions: burned in (bottom, 2 lines max) and exported as `video/out/captions.srt`.
6. Render `video/out/spendconsent-demo.mp4` (H.264, yuv420p, AAC 48 kHz, audio
   normalised to −14 LUFS, ≤ 2:55).

## Deliver for review (every version)
- `video/out/spendconsent-demo-vN.mp4`
- `video/out/contact-sheet-vN.jpg` — one frame every 3 s in a grid with timestamps
- `video/out/timeline-vN.json` — per scene: start, end, voiceover text, clips used
- `video/REVIEW.md` — what changed, what is still placeholder, open questions
- Commit `video/` source (not `raw/` or `out/`; gitignore them) with a clear message.

Then stop and summarise in under 150 words. The user will bring Claude's review
back to you as the next prompt.
