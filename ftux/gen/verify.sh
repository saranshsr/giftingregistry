#!/bin/sh
# after the AE side (build_ftux.jsx, dump.jsx, ae_frames.jsx): export, render with lottie-web and dotLottie, diff against AE
set -e
cd "$(dirname "$0")"
python3 convert.py
node render.mjs canvas
node render_dotlottie.mjs
python3 diff.py canvas
python3 diff.py thorvg
