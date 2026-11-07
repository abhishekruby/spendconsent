# Assets and licences

Checked 7 November 2026. Everything runs locally. No paid account, trial, API,
card, third-party music, stock footage or external image asset is used.

| Asset / tool | Exact source | Licence / use |
| --- | --- | --- |
| Audition A, `out/voice-samples/A-af_heart.wav` | Locally synthesized with Kokoro v1.0 `af_heart` | Generated narration; Apache-2.0 model/voice weights |
| Audition B, `out/voice-samples/B-am_michael.wav` | Same, `am_michael` | Same |
| Audition C, `out/voice-samples/C-bf_emma.wav` | Same, `bf_emma` | Same |
| Audition D, `out/voice-samples/D-bm_george.wav` | Same, `bm_george` | Same |
| Kokoro-82M v1.0 ONNX weights and voice styles | [Upstream versioned release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0); exact downloads and SHA-256 in `models.json` | [Apache-2.0, upstream model card](https://huggingface.co/hexgrad/Kokoro-82M); model/voice files are not committed |
| Voice identifiers, accents and gender labels | [Upstream voice guide](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) | Model documentation; local reference copy in `licenses/` |
| Bricolage Grotesque Variable, normal WOFF2, Latin / Latin-ext / Vietnamese subsets | `@fontsource-variable/bricolage-grotesque@5.3.0`, default weight-axis CSS, as used by the frontend | SIL Open Font License 1.1; copy in `licenses/` |
| IBM Plex Mono, Latin 400 normal WOFF2 | `@fontsource/ibm-plex-mono@5.3.0`, as used by the frontend | SIL Open Font License 1.1; copy in `licenses/` |
| Palette, setup slate and audition text | This repository's app tokens, video plan and original video source | Project material; no third-party graphical assets |
| `out/setup-slate.png` | Local Remotion render of the labelled setup slate | Original development artwork; uses the OFL fonts above; not product footage |
| `kokoro-onnx==0.6.1` | [Upstream](https://github.com/thewh1teagle/kokoro-onnx) | **MIT** wrapper (distinct from Apache-2.0 model); copy in `licenses/` |
| ONNX Runtime and NumPy | Exact resolved versions in `uv.lock` | MIT and BSD-3-Clause respectively |
| Phonemizer / eSpeak NG / eSpeak loader | Exact resolved versions in `uv.lock`; bundled eSpeak data | GPL-3.0-or-later / GPL-3.0-or-later / MIT; local synthesis tools, not distributed in film |
| Remotion / CLI `4.0.541` | [Official licence and pricing](https://www.remotion.dev/docs/license/pricing) | Remotion licence, **not an OSI open-source licence**; free for individuals and companies up to three people, unlimited local commercial renders, no trial expiry or hosted quota. This individual-project use requires no paid licence. Copy in `licenses/` |
| React / React DOM `19.3.1` | npm packages locked in `package-lock.json` | MIT |
| TypeScript `7.0.2` / React type definitions `19.3.0` | Same | Apache-2.0 / MIT |
| FFmpeg `6.1.1-3ubuntu5` | Installed Ubuntu build | GPL-enabled build; local normalization/render tool, not redistributed |
| Python `3.12.3`, uv and Node `22.14.0` | Installed local tools | PSF; MIT/Apache-2.0; MIT respectively |

All transitive runtime/tool dependencies are pinned by the committed npm and uv
lockfiles. Installed dependency licence inventory is in
`licenses/dependency-licenses.json`; upstream package notices remain in the
ignored installations. No model or binary tool is redistributed in source.

No product footage, music, QR, sound design or MCP transcript exists yet. Add
each actual clip and generated asset here as it is created; never credit a
planned recording as completed evidence. PayPal and Channel3 may appear only
inside real product footage under the user's video brief.
