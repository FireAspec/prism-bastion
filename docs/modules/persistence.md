# Profile and save storage (v1)

`createSaveStore(storage)` implements the frozen `SaveStore` interface. `defaultProfile()` creates an independent level-one profile with zero XP, seals, points and claims and exactly the four initial towers. Settings default to Russian, high quality, windowed, full master volume, music 70%, effects 80%. No function in this module calculates or grants rewards.

## Integration

```ts
import {createSaveStore, makeSaveEnvelope, checkResume} from './persistence';
const saves = createSaveStore(localStorage);
const saved = saves.load();
const profile = saved.profile;
const resume = checkResume(saved, config);
// Only call restoreGame(config, resume.run, combat) when resume.ok is true.
// Otherwise show resume.reason; keep the profile and original saved run.
saves.save(makeSaveEnvelope(profile, engine.getSnapshot(), config));
```

The frozen `SaveEnvelope` has `contentVersion` but no digest; `PersistedSave` adds optional `contentDigest` without altering the contract. `makeSaveEnvelope` captures both values. The app must use it for new saves and call `checkResume` before restoring a run. A legacy save with no digest is still readable but its run is not resumable until compatibility is established externally. Unknown profile IDs remain intact; unknown run IDs (tower, enemy, map, mode, difficulty, knowledge) or incompatible digest/lane/layer index return a readable refusal. Loading does not overwrite an incompatible run. A new run may replace it only through an explicit save.

Rewards belong to `ProgressionService.reward`. The application should persist the updated profile, including its `claimedRuns` ledger, and the run snapshot in one save before presenting a successful reward as durable. Import is replacement, not reward replay or profile merging. A replacement that drops any current claim ID is rejected (`ledger`), including an ordinary save with a stale profile. Reimporting the same result is inert. Offline data is not cryptographically authenticated: deliberately edited saves, copying profiles across independent installations, intentional reset or loss of both copies cannot be prevented from changing progress. The reward service must still consult the ledger for every result, including endless/co-op.

## Writes and recovery

Keys: `prism-bastion.save` (current), `prism-bastion.save.backup` (last valid envelope). All fields are validated before the first write. For updates, copy the last valid envelope to backup, then replace current with the complete new envelope using one `setItem`. On first save, write the new envelope to both keys. An interruption before the current write preserves the last committed state; on the first write the new backup is recoverable. If current is damaged, read backup without overwriting it; `recoveredFromBackup` reports this on the returned `LocalSaveStore`. The next successful save repairs current. The latest changes after the previous backup may be lost if current becomes unreadable. If both copies fail, `load` and ordinary `save` throw `corrupt`, never silently reset. A valid explicit external `import` can restore both damaged copies; no ledger can be recovered from unreadable data. Unknown future schema versions fail closed and are not overwritten, even when an older backup exists. Explicit `reset` removes the two keys only; it is intentionally destructive and must require confirmation in UI.

`SaveError.code`: `invalid`, `size`, `version`, `storage`, `corrupt`, `ledger`. Handle these at the application boundary and show a localized message. The caller retains its in-memory profile if a write fails. Two localStorage writes are not a multi-key transaction or a disk fsync. Assumes one authoritative writer (app/host), not concurrent tabs; the app should serialize saves. Quota/access failure is reported rather than clearing old data. A backup consumes extra quota; 2 MiB is an input limit, not a promise that a browser will accept two copies.

## Validation and migration

Bounded JSON: at most 2 MiB UTF-8 per envelope, 48 nesting levels, 300,000 visited values, 50,000 entries per generic array, 60 towers, 1,800 enemies, 4 players. Reject non-finite numbers (including overflowing JSON exponent), unsafe object keys, malformed shapes, invalid enum/tier/owner, duplicate entity or paid-layer IDs, negative currencies and invalid cash remainder. Preserve actual invested cost, owner, RNG, paid layers, projectile and strike states, wave cursors, event IDs and all other frozen fields. Strings are data only; no executable import. Unknown fields are retained within the same limits. Content-specific consistency is checked by `checkResume`; the engine remains responsible for simulation invariants.

Supported migration: v0 envelope/profile with matching field names; missing fields are filled from defaults, and the legacy combat snapshot is discarded because paid-layer accounting and fractional cash cannot be inferred. Missing savedAt/contentVersion use explicit legacy placeholders. Old/incomplete economy fields reconcile absolute XP and level using the specified v1 curve, with 3 points per level up to level 51 minus unlocked nodes; purchased IDs are retained and unlocked legacy nodes are treated as already paid. Complete v1 balances are preserved as stored (economy tuning can change the curve). Unknown IDs are not filtered. A missing ledger in a legacy profile cannot reconstruct past run IDs. Unsupported future versions must be exported by a compatible app; do not force a downgrade. No reward is generated during migration.

## Tests

`npx vitest run tests/persistence/persistence.test.ts` exercises defaults, complete snapshots, all 150 knowledge IDs, migration, validation, size/depth limits, quota/interruption on either write, corruption recovery, ledger rollback, repeated import, digest/tower mismatch and reset. `npm run check` is the repository-wide integration check.
