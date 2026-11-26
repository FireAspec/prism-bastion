# Audio (module 66)

## Runtime

`createAudio(settings): PrismAudio` implements the frozen `AudioSystem` v1. It creates no audio context before `unlock()`; call unlock directly on a pointer/key gesture and retry on another gesture if the device is unavailable. All synthesis is local, deterministic and independent of game RNG. No CDN, third-party recordings, or new runtime dependency.

| Track | Tempo / duration | Arrangement |
| --- | --- | --- |
| menu | 76 BPM / 50.5 s | soft bell and plucked beacon motif |
| build | 84 BPM / 45.7 s | brighter moving arpeggio |
| wave | 112 BPM / 34.3 s | bass pulses, percussion and syncopation |
| boss | 104 BPM / 36.9 s | lower register, altered harmony, low drums |
| victory / defeat / end | 5 s each | ascending / descending / neutral resolution |

The first four are sixteen-bar loops with a varied second phrase. End tracks play once. The mixer crossfades scenes in 650 ms. Master (0–1) is independent of music and SFX; zero master stops SFX and sets master gain to zero immediately. A dynamics compressor follows the master. One mono PCM buffer per track/cue is cached; all sources are disconnected on completion/dispose. Maximum two simultaneous music sources, fourteen SFX sources, nine total voices before low-priority combat cues are refused. Combat cues use a global 46 ms spacing and per-family cooldowns; critical cues can displace combat voices. At most one cue per family per batch. Ordinary hit/kill/income are not layered with paid-layer cues to prevent repeated noise. The cache is finite (7 music tracks and 23 cue definitions, below 18 MiB PCM even if all are rendered), and the recent ID window is 4096 slots (32 KiB).

## App integration

Use one instance for the app; pass each authoritative event batch once to all consumers. `consume` deduplicates monotonic IDs within a sliding 4096-ID window and rejects older IDs, including muted/pre-unlock events. Out-of-order recent IDs are accepted once, but older scene events cannot roll back the scene. `waveStart`, `waveEnd`, `bossPhase`, `victory`, `defeat` update the scene. App must call `setScene('boss')` as soon as boss presence is known from snapshot (a phase event may occur later), and choose the correct menu/build/wave/end scene on loading a snapshot. Do not overwrite boss with wave on every render. Consume victory/defeat before the generic end scene for the correct stinger.

The frozen interface has no pause, run identity or rejected/ready event. The returned `PrismAudio` extends it locally without touching contracts:

- `beginRun(nextEvent = 0)` once for a new run or a loaded snapshot, passing the first event ID that should be audible; on restore use `snapshot.nextEvent` if historical events are not to be played. Do not call on ordinary reconnect to the same run; retain the instance and its dedup window. If no prior instance exists, begin at the authoritative cursor. Never mix event IDs from different runs.
- `setPaused(true)` on pause or disconnect: cancel current effects, duck music to 32%, consume incoming IDs silently. `setPaused(false)` on resume/reconnect. Music continues softly; game time does not affect musical tempo. Call unlock again on a user gesture if the audio context was suspended externally.
- `notify('reject')` only after confirmed command rejection; `notify('ready')` on a cooldown transition, not each frame. Successful purchases/abilities are triggered by events, not speculative UI commands.
- The event contains element and visual keys, not tower definition ID. Nine families (needle/heavy/mechanical/fire/frost/electric/acid/energy/water) are selected by element/visual keys. Generic kinetic is the fallback; a complete 30-tower identity mapping requires an app-side source-to-definition lookup or a future contract extension.

`dispose()` is idempotent, cancels all connected voices and closes the context; an in-flight unlock will not restart a disposed instance.

## QA

Run `npm exec vitest run tests/audio/audio.test.ts` and `npm run check` in the full checkout. Local isolated strict TypeScript 5.8.3 compilation of the production sources against the embedded frozen contract succeeded. Nine scenarios also passed in Node using a small local Vitest-compatible assertion runner and the included mock WebAudio context (not the actual Vitest package). Native Chromium navigation was blocked by the environment, and full npm check could not be executed without a network clone/dependencies. All seven tracks and 23 cue recipes were rendered to PCM and checked for finite samples, quiet boundaries and peak headroom; previews were exported separately. The first uncached music scene is synthesized synchronously, so benchmark transition hitch on the target Windows machine; cached changes do not repeat synthesis. The audible balance, click-free real WebAudio transitions and 20-minute low-volume listening acceptance still require manual verification on speakers/headphones in the integrated app. This is not a claim that the whole game passes QA.

Manual acceptance: open the supplied preview audio or run the preview generator, then start the game; verify silence until gesture, master at zero, repeated event IDs, pause/reconnect, 60 towers at 3x, boss transition, one-shot victory/defeat, and 20 minutes at low master volume. Check performance and actual output on Windows, and adjust arrangement/mix only after listening.
