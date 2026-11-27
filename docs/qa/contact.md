# Contact QA (contract v1)

Base: `65ae156626cab219a9d8a6e7e6a63f8b4663d1f7`. Scope: independent validation only; no production combat, renderer, engine or shared contract changes.

## Run

- `npm ci` (from repository root, using existing lockfile).
- `npx vitest run tests/contact/oracle.test.ts` — independent geometry and trace-audit tests.
- `npx tsx validation/contact/run.ts` — integration gate; writes `validation/contact/results/report.json` and `traces.json`. Optional first argument changes output folder. Nonzero exit for a failed or blocked case. Do not commit output traces automatically.
- Open `validation/contact/replay.html` in a browser and select the generated `traces.json`. Use Previous/Next, frame slider, or 2/6/60 frames per second. The origin label distinguishes combat/engine data from diagnostic fixtures. Select `validation/contact/fixture.json` to exercise the viewer without a combat implementation.
- `npm run check` — project-wide gate.

## Coverage and assumptions

The projection/chord oracle independently finds the first swept segment/circle contact; it supports relative linear motion. A simulation tick runs combat before enemy movement, so straight-projectile checks use the pre-combat position. A moving target fixture explicitly sets the next position between ticks. A sector uses the target centre, range and full arc in degrees. Fixtures use a deterministic seed, no armour, no damage modifiers, no random target ties except overlapping candidates, no DoT or passive rewards. World points are checked within the declared enemy + projectile radius for straight direct attacks, enemy radius for melee. Homing/mortar/splash require separate contact information; the generic sweep audit does not apply to those. Events do not carry projectile or strike IDs, so multiple candidates from one source are matched permissively; a false positive can be hidden by overlapping candidates. Proposals: add optional projectile/strike IDs, contact tick and exact impact centre to events, without changing v1 in this module.

The 38 integration scenarios cover 24 positive/negative AttackMode cases plus fast/slow straight shots, transverse escape, turning target, melee range/arc escape, externally removed target, overlapping pierce, splash radius, shield/multiple layers, shield-only, layer restoration without repeat payment, pause/3x/JSON restore, and freeze. The layer restoration scenario is a prescribed HP reset, not a test of the real regeneration algorithm. Target movement in direct combat fixtures is prescribed, not a proof of actual engine path traversal. The restore case simulates serializing the authoritative snapshot; real WebSocket reconnect and duplicate delivery still require the host/client integration suite. The freeze scenario checks early damage and bounded progress, not every control rule. The replay paints event points and projectile segments at the recorded coordinates; it is not a pixel measurement of the game's renderer. Final visual acceptance requires recording real renderer frames and comparing the rendered contact centre in world coordinates to the event point, including 1x/3x, reduced motion and reconnect. No synthetic trace is accepted as proof of gameplay.

## Verification at base

- GitHub read of the exact base confirms `createCombat()` throws `Combat module pending`, and `createGame()` / `restoreGame()` throw `Simulation module pending`.
- Local TypeScript 5.8.3 strict compilation against the embedded v1 contract and exact fetched stubs succeeded. The repository specifies a different TypeScript version; this is not a full repository build.
- Ten independent assertions corresponding to the Vitest suite passed via Node assert on compiled source. Vitest dependencies unavailable in local environment; native Vitest invocation remains unverified.
- Integration runner executed against the exact base stubs: 0 passed, 0 failed, 38 blocked. Expected nonzero exit. No actual combat contact confirmed.
- Chromium diagnostic replay was exercised with the explicitly constructed fixture: file import, next/previous, seek, playback, event details. This is a diagnostic UI test, not a game screenshot.
- Full npm check unavailable without a complete checkout and installed dependencies.

## Handoff

Integrate only the allowed paths. After combat and engine are merged, rerun the integration gate, keep minimal reproducible traces for failures, and resolve false positives/contract ambiguities with the owning module. Then run actual renderer and network acceptance. Do not treat blocked cases as passes.
