# Prompt for Codex — build the SpendConsent demo video

Paste everything below the line into Codex (Codex CLI or the Codex app, working
in this repository folder, strongest model, highest reasoning). Before pasting,
read the "User approval" paragraph — keep it only if you agree.

---

You are a senior motion designer and video engineer. Produce the 2:45 demo video
for SpendConsent, our PayPal AI Hackathon 2026 entry, as code in a new `video/`
folder of this repository. Judges may score us from this video alone, so it must
feel like a polished product-launch film: calm, premium, clear, honest — and
the viewer must leave with one idea: *AI can shop for you but never pay; a person
approves the exact cart; PayPal verifies the payment.*

## Read first (and only these)
- `AGENTS.md` — its rules apply to you (zero cost, no secrets, sandbox only).
- `docs/video-plan.md` — source of truth for story, script, timing, the
  automated-recording method and the quality checklist.
- `frontend/src/style.css` (design tokens at the top), `frontend/package.json`
  (font packages), `README.md` ("AI" and "MCP" sections), `docs/impact-evidence.md`.

## User approval (the user keeps or deletes this paragraph)
For recording this video only, I approve Codex to create, pay and refund
SpendConsent PayPal **sandbox** test orders (test money, each under USD 100, at
most 6 payments in total) on the local app. I will sign in to the PayPal sandbox
buyer myself when asked; Codex never types or reads a PayPal password.

## Hard rules
- Work only inside `video/` (plus `.gitignore` lines). Never edit app code, never
  read `.env` or `.runtime/`. Sandbox only; never switch anything to Live.
- Zero cost: open-source/free tools only; no paid APIs, trials or stock sites.
- Honesty: the product appears only through real recordings of the running app.
  Motion graphics explain; they never fake product screens. Label every speed-up
  or cut wait (e.g. "AI wait shortened · real: ~14 s"). Keep "Sandbox · test
  money" visible in payment scenes. Every number must match its source file.
- No third-party music, logos or trademarks except PayPal and Channel3 UI as it
  appears inside our product. No Claude/ChatGPT/OpenAI branding on screen.
- Blur approval-link URLs/tokens, emails and account identifiers.
- Pin exact dependency versions; list every asset and licence in `video/CREDITS.md`.

## Stack
- Remotion (free for individuals), React + TypeScript, 1920×1080, 30 fps.
- Fonts Bricolage Grotesque + IBM Plex Mono (the frontend's OFL npm packages);
  colours from the app's paper/ink/persimmon tokens.
- Voice: Kokoro TTS run locally (Apache-2.0; prefer `kokoro-onnx`). First make
  4 short samples (2 female, 2 male, US/UK) in `video/out/voice-samples/` and stop
  for the user to choose. Then one WAV per scene; scene lengths follow voice
  durations plus breathing room.
- Music: none from third parties. Optional: a very quiet ambient pad synthesised
  in code, ducked under the voice. The app's own UI sounds in recordings are welcome.
- Recording: Playwright (headed Chrome, kiosk, 1920×1080, persistent profile in
  `video/.chrome-profile/`) + ffmpeg `x11grab` (this is an X11 desktop), exactly
  as described in the plan, with an injected smooth cursor and click ripples.
  QR code for the end card from a free library.

## Order of work
1. Set up `video/` and the voice samples; stop for the voice choice.
2. Build scenes that need no footage: 1 (kinetic hook; montage slots), 2 (stats
   with source line, who-it's-for, title card), 7 (terminal — run the real MCP
   server against the local app and animate that real transcript, labelled
   "real MCP session"; never invent tool output), 8 (proof, flow line, end card
   with QR). Shared components: kinetic title, caption track, callout chip,
   eased zoom/pan on a clip region, highlight ring, laptop+phone split frame,
   animated terminal, stat counter, flow diagram, chapter progress bar.
3. Write the recorder and record clips C1–C7 + C3b from the plan on the local
   app (start it with `scripts/run_demo.sh` if not running). Ask the user before
   the first PayPal popup so they can sign in; tell them not to use the laptop
   while recording. Retake anything shaky.
4. Edit footage scenes 3–7 and the cold-open montage from the clips.
5. Captions burned in (bottom, max 2 lines) and `video/out/captions.srt`.
6. Render `video/out/spendconsent-demo-vN.mp4` (H.264 high, yuv420p, CRF 18,
   AAC 48 kHz, loudness −14 LUFS, ≤ 2:55).

Motion style: restrained and premium — 250–600 ms ease-out moves, springs only
for APPROVED/VOID stamps, no spinning, glitch or stock transitions. Text ≥ 36 px,
key text ≥ 64 px, 96 px safe margins. One idea per shot.

## Deliver for review (every version N)
- `video/out/spendconsent-demo-vN.mp4`
- `video/out/contact-sheet-vN.jpg` — a frame every 3 s in a grid, with timestamps
- `video/out/timeline-vN.json` — per scene: start, end, voiceover text, clips used
- `video/REVIEW.md` — what changed, what is still placeholder, open questions
- Commit `video/` source only (gitignore `raw/`, `out/`, `.chrome-profile/`).

Then stop and summarise in under 150 words. The user will bring Claude's review
back as the next prompt.
