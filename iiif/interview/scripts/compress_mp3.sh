#!/bin/bash

# Loop through all .mp3 files in the current directory
for file in *.mp3; do
  ffmpeg -i "$file" -ac 1 -ar 48000 -q:a 2 "_compressed/${file%.mp3}.mp3"
done