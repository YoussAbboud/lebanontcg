#!/usr/bin/env bash
# Render the reel: one Remotion timeline → with-BGM and no-BGM MP4s with byte-identical video and the same audio path.
# Audio is rendered as WAV and muxed by ffmpeg (Remotion's own AAC encode shifted the mix ~43 ms late on this pipeline,
# see analysis/av_offset.json).
set -euo pipefail
cd "$(dirname "$0")"
npx remotion render src/index.ts LtcgReel out/video.mp4
npx remotion render src/index.ts LtcgReel out/bgm-audio.wav --codec=wav
npx remotion render src/index.ts LtcgReel out/nobgm-audio.wav --codec=wav --props=props-nobgm.json
for v in "lebanontcg-reel:bgm-audio" "lebanontcg-reel-nobgm:nobgm-audio"; do
  ffmpeg -v error -y -i out/video.mp4 -i "out/${v#*:}.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -movflags +faststart "out/${v%%:*}.mp4"
done
rm -f out/video.mp4
