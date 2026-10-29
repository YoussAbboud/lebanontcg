#!/usr/bin/env bash
# Picks the poster frame, writes brag.jpg, bakes it as frame 0 of brag.mp4.
set -euo pipefail
cd "$(dirname "$0")/.."
POSTER_T="${1:-7.0}"
ffmpeg -y -v error -ss "$POSTER_T" -i brag.mp4 -frames:v 1 -q:v 2 brag.jpg
ffmpeg -y -v error -i brag.mp4 -i brag.jpg -filter_complex "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]" \
  -map "[v]" -map 0:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart -c:a copy work/brag-baked.mp4
mv work/brag-baked.mp4 brag.mp4
echo "poster at ${POSTER_T}s baked into frame 0"
