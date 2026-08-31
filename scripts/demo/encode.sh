#!/bin/bash
# Turns the raw Playwright capture into an MP4 suitable for social posts.
#
# The app holds a deliberate 5-7 second loading screen. That is fine to play
# but reads as dead air in a short clip, so it is sped up while everything
# else stays at real time. Pass the loading window's start and end, in seconds,
# as printed by record.mjs.
#
# Usage: scripts/demo/encode.sh raw.webm out.mp4 2.46 8.36 [speedup] [crf]
set -euo pipefail

RAW=${1:?raw webm}
OUT=${2:?output mp4}
LOAD_IN=${3:?loading start seconds}
LOAD_OUT=${4:?loading end seconds}
SPEEDUP=${5:-3.5}
CRF=${6:-16}

ffmpeg -y -v error \
  -i "$RAW" \
  -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -filter_complex "
[0:v]trim=0:${LOAD_IN},setpts=PTS-STARTPTS[a];
[0:v]trim=${LOAD_IN}:${LOAD_OUT},setpts=(PTS-STARTPTS)/${SPEEDUP}[b];
[0:v]trim=${LOAD_OUT},setpts=PTS-STARTPTS[c];
[a][b][c]concat=n=3:v=1:a=0,fps=30,scale=iw*2:ih*2:flags=neighbor,format=yuv420p[v]
" \
  -map "[v]" -map 1:a -shortest \
  -c:v libx264 -preset slower -crf "$CRF" -profile:v high -level 5.1 \
  -x264-params "keyint=60:min-keyint=30:bframes=3:ref=5" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  "$OUT"

# The bt709 tags are not cosmetic: without them YouTube guesses the colour
# space and the saturated pixel palette comes back shifted after transcode.
#
# The doubling to 4K is deliberate. There is no more detail in it, but YouTube
# allocates bitrate by resolution tier, and hard nearest-neighbour edges are
# exactly what a starved encoder smears. An integer scale with the neighbor
# filter adds no blur of its own, so the upload is the capture, only richer.

# A silent AAC track is included on purpose: some feeds mishandle video-only files.
ffprobe -v error -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 "$OUT"
