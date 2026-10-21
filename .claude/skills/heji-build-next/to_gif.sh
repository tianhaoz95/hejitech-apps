#!/usr/bin/env bash
# Turn a screen recording (.mov/.mp4/.webm) into a small looping GIF for a review site.
#
#   .claude/skills/heji-build-next/to_gif.sh in.mov out.gif            # 420px wide, 12 fps
#   .claude/skills/heji-build-next/to_gif.sh in.mov out.gif 360 10     # width, fps
#   START=2 DURATION=8 .claude/skills/heji-build-next/to_gif.sh in.mov out.gif   # trim first
#
# Two-pass ffmpeg (palettegen → paletteuse) keeps colours clean. Aim for under ~4 MB: shorten the
# clip, lower the width or fps if it's bigger. The report is committed, so size matters.
set -euo pipefail

IN="${1:?usage: to_gif.sh <in.mov> <out.gif> [width] [fps]}" OUT="${2:?usage: to_gif.sh <in.mov> <out.gif> [width] [fps]}"
W="${3:-420}" FPS="${4:-12}"
command -v ffmpeg >/dev/null || { echo "!! ffmpeg is required (brew install ffmpeg)" >&2; exit 1; }

TRIM=()
[ -n "${START:-}" ] && TRIM+=(-ss "$START")
[ -n "${DURATION:-}" ] && TRIM+=(-t "$DURATION")
FILTER="fps=$FPS,scale=$W:-1:flags=lanczos"
PAL="$(mktemp -t heji-gif-palette).png"
trap 'rm -f "$PAL"' EXIT

ffmpeg -v error -y ${TRIM[@]+"${TRIM[@]}"} -i "$IN" -vf "$FILTER,palettegen=stats_mode=diff" "$PAL"
ffmpeg -v error -y ${TRIM[@]+"${TRIM[@]}"} -i "$IN" -i "$PAL" -lavfi "$FILTER [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 "$OUT"
echo "$OUT  $(du -h "$OUT" | cut -f1)"
