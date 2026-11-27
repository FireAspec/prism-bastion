# Progression and knowledge (v1)

## Entry points

`createProgression(config)` implements the frozen `ProgressionService`. Operations return a new profile on success and the original profile on refusal. Persist the returned profile atomically; never persist the receipt separately. `getEconomy()` returns independent economy data. No battle currency is touched.

- XP is absolute. `xpToLevel` derives prestige level from the sum of the quadratic costs. Earned points are capped at 150; free points are reconciled from level and distinct purchased nodes. Unknown saved node IDs are preserved and count as spent points until respec. A historical unlocked node is treated as paid on migration.
- `reward` consumes terminal results only. The medal/best-wave key is `mapId:difficulty:modeId` (exported `medalKey`); medals store clear counts. `claimedRuns` is permanent and includes eligible terminal defeats even if they award zero XP. Victory requires the configured last wave; defeat uses the number of *completed* waves, strictly below the last wave. Invalid IDs, digest, rounds, eligibility and out-of-range waves are refused. No reward is based on kill count, income or player count.
- `terminalResult(snapshot, eligible, digest)` refuses build/wave snapshots and post-standard endless snapshots. For a defeat it subtracts one from the active wave. The app/host must deliver the initial standard victory once even when the engine immediately transitions to endless; the run ID stays fixed. The v1 result alone cannot distinguish an exit from a defeat if an integration incorrectly constructs a terminal result. Do not construct one for exit/restart/autosave.
- `rewardForRun(profile,result,startKnowledge)` accepts the recipient's personal start-of-run knowledge. The v1 `reward` fallback uses the profile's current knowledge because `RunResult` has no loadout field. Persist the recipient's start loadout beside run metadata, or prevent mid-run respec. XP/seal bonuses use personal rather than team knowledge; battle bonuses use the unique team union. In strict mode neither applies. The defeat fraction is capped at 35% before the XP knowledge bonus.
- `canCompleteCampaign` checks the eligible recipient's own prerequisites and standard victory, not the host's profile. Call campaign completion only when it returns true; campaign owns unlocking technologies/nodes, not XP, seals, medals or run claims. An eligible guest may earn currency and a medal even when their story prerequisites are missing. The host must compute eligibility from joined-before-25% and connected-for-at-least-half-completed-waves; v1 exposes only the final boolean.
- Import and reconnect must preserve all `claimedRuns`; serialize updates per profile. A replay against an older backup that predates the award cannot be detected by a purely local v1 profile without merging the newer claim ledger. Persistence owns backup merging, save atomicity and migration; do not truncate the ledger.

## Knowledge

`buy` verifies prior nodes, derived level, available points and seals before returning a new profile. First three respecs cost zero, later ones cost 200 seals; historical payments remain. `validateCatalog` checks ID/position collisions, effects, prerequisites, cycles, and transitive point reachability. Content modules own the full 150-node inventory and exact per-index price/level rules.

`applyKnowledge` deep-copies the data (preserving the optional endless callback), adjusts base and replacement attacks, statuses, effects, abilities and difficulty fields. Reapplying to a previously returned config uses the original config in the same process. For serialized configs always reload raw content. Damage/speed/range are category-restricted; scoped effects are filtered by tower ID before summing and clamping. Speed increases rate (interval divided by 1+bonus); ability cooldown is reduced by the capped fraction. Status and control duration are separate. Aura detection radius receives both applicable radius bonuses. Passive income scales power and positive caps for income/interest/harvest; no knowledge is applied when strict. Damage-bearing nova/meteor/deathBurst use the category multiplier; the v1 ability/effect definitions have no shield/boss multiplier fields. Combat retains its own control and aura caps.

Costs and `StatDelta` remain unchanged. Knowledge discount is stored separately (cap 8%); engine must apply the combined discount cap of 20% and compute invested from actual debits. Sale ratio is never changed. Extreme and one-life mode modifiers are preserved; knowledge does not enable a second life. `combineKnowledge` filters unknown IDs and returns each known ID once in catalog order; caps are applied when producing the run config, not by discarding legitimate nodes. The host validates personal loadouts; the union is not a purchasable personal loadout.

## Initial economy arithmetic

The following values are for five first standard wins per group at easy, normal, hard, extreme respectively, without knowledge. Each reward is rounded down separately.

| Group | Difficulty | XP per win | Seals per win |
|---|---|---:|---:|
| 1 | easy | 262 | 56 |
| 2 | normal | 600 | 120 |
| 3 | hard | 1215 | 243 |
| 4 | extreme | 2295 | 442 |

Total: 21,860 XP, 4,305 seals, level 19, 54 points earned, 875 XP into level 19. Level 51 requires 275,625 XP. The specified per-index seal price sums to 6,170 per branch and 30,850 for all five. These are arithmetic checks, not evidence for the target 35–65 hours; the independent economy simulator must assess real playtime and purchase ordering.

## Verification

`npx vitest run tests/progression` is the intended repository command. The isolated tests exercise the frozen contract with fixture data, including first/repeat rewards, duplicate delivery after JSON round-trip, defeat, eligibility, XP boundaries and prestige, purchase/respec, every knowledge stat, immutable configuration, scope/cap, strict mode, terminal adapter, story prerequisites and baseline economy. Full repository CI and end-to-end app/host/persistence wiring are separate integration checks.
