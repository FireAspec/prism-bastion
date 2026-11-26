# Audio assets

Music and effects are original procedural compositions in `src/audio/synthesis.ts`. No audio file is fetched by the runtime. Export listenable WAV files with `node --experimental-strip-types tests/audio/render-previews.mjs audio-previews` from the repository root. This separate QA export is not required for the game build. The SFX reel plays one cue every two seconds in the order documented by the script.
