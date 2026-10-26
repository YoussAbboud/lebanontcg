#!/usr/bin/env bash
# Final render (stage 7): one Remotion timeline → landscape and vertical cuts, each with and without BGM, all through the
# same audio path. Remotion's own AAC lands the mix 42.7 ms late (analysis/av_offset.json), so audio is rendered as WAV
# and muxed by ffmpeg. The audio is identical across formats (same timeline, same SFX table), so it is rendered once.
set -euo pipefail
cd "$(dirname "$0")"
npx remotion render src/index.ts LtcgPromo out/video.mp4
npx remotion render src/index.ts LtcgPromoVertical out/video-vertical.mp4
npx remotion render src/index.ts LtcgPromo out/bgm-audio.wav --codec=wav
npx remotion render src/index.ts LtcgPromo out/nobgm-audio.wav --codec=wav --props=props-nobgm.json
for v in "video:promo:bgm-audio" "video:promo-nobgm:nobgm-audio" "video-vertical:promo-vertical:bgm-audio" "video-vertical:promo-vertical-nobgm:nobgm-audio"; do
  IFS=: read -r vid out aud <<<"$v"
  ffmpeg -v error -y -i "out/$vid.mp4" -i "out/$aud.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -movflags +faststart "out/$out.mp4"
done
rm -f out/video.mp4 out/video-vertical.mp4
