#!/usr/bin/env bash
# Final render (stage 7): one Remotion timeline → two deliveries with an identical audio path.
# Remotion's own AAC lands the mix 42.7 ms late (analysis/av_offset.json), so audio is rendered as WAV and muxed by ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
npx remotion render src/index.ts LtcgPromo out/video.mp4
npx remotion render src/index.ts LtcgPromo out/bgm-audio.wav --codec=wav
npx remotion render src/index.ts LtcgPromo out/nobgm-audio.wav --codec=wav --props=props-nobgm.json
for v in "promo:bgm-audio" "promo-nobgm:nobgm-audio"; do
  ffmpeg -v error -y -i out/video.mp4 -i "out/${v#*:}.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -movflags +faststart "out/${v%%:*}.mp4"
done
