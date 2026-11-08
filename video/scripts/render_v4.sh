#!/usr/bin/env bash
# Final 1080p render of the v4 cut: picture from Remotion, soundtrack from score_v3.py.
set -euo pipefail
cd "$(dirname "$0")/.."
export UV_PYTHON_DOWNLOADS=never UV_CACHE_DIR=$PWD/.cache/uv
uv run --locked --no-dev python scripts/edit_v3.py
uv run --locked --no-dev python scripts/score_v3.py
node scripts/qr.mjs
python3 scripts/review_v3.py export
cp out/captions-v3.srt out/captions-v4.srt
node_modules/.bin/remotion render src/index.tsx SpendConsentV3 out/.picture-v4.mp4 --browser-executable=/usr/bin/google-chrome \
  --codec=h264 --crf=18 --pixel-format=yuv420p --x264-preset=medium --concurrency=1 --offthreadvideo-cache-size-in-bytes=402653184 --muted --log=warn
ffmpeg -hide_banner -loglevel error -y -i out/.picture-v4.mp4 -i out/master-v4.wav -map 0:v:0 -map 1:a:0 \
  -vf scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_trc bt709 -color_primaries bt709 -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart out/spendconsent-demo-v4.mp4
python3 scripts/contact_sheet.py out/spendconsent-demo-v4.mp4 out/contact-sheet-v4.jpg --interval 1
echo DONE
