# Combat module (contract v1)

## Entry points and integration

`createCombat(): CombatModule` supplies `resolveTower`, `step` and `activate`.
`damageEnemy(state, config, enemyId, packet)` is the shared direct-damage entry point.
`supportAt(state, config, targetTower)` exports strongest applicable support bonuses; the engine can use its `discount` when pricing purchases.
`enemySpeedMultiplier(enemy, enemyDef)` exports status-, boss-phase- and spawn-aware path speed scaling. The engine advances `progress` and `pos` after the combat tick; combat never moves enemies forward.

The engine must call `combat.step` once each fixed tick **after spawning, before path movement, leaks and wave completion**. `state.time` is the authoritative clock; snapshots include every cooldown, timer, status, paid layer and entity. No module-global mutable simulation state exists. Events are animation cues and never trigger combat calculations. Rendering and audio consumers must not feed those events back into `damageEnemy`.

Wave-end `income` and `interest` effects and reward `(rewardBase + rewardStep * wave)` belong **only to the engine**. Combat does not pay them or respond to `waveEnd` render events. Effects are available via `resolveTower` for engine calculation: apply the mode's `allowPassiveIncome` and `incomeMul`/`popCashMul`, cap interest at `effect.cap`, pay once per wave. For modes `iron-oath`, skip harvest and all other non-layer income even though combat abilities are still legal. `supportAt().discount` must not change the 70% invested-refund rule.

The source `TowerDef` is always cloned. The highest T3+ replacement on the main branch chooses the weapon's mode; secondary T1/T2 replacements never overwrite it. All deltas then apply A→B→C, T1→T5 within each branch. Late effects/abilities replace matching IDs; added statuses merge per kind, retaining the stronger potency, longer duration and higher stack limit. Ties choose the lower-index main branch. `secondaryOverlay` retains the highest visual of the other purchased branch. Unsupported/illegal tier triplets throw.

## Attack interpretation

| Mode | Simulation contact |
| --- | --- |
| `shot` | Simulated projectile, swept collision along each tick's segment; `pierce` unique victims |
| `cone` | Multiple independent pellets distributed in a frontal 0.7 radian sector |
| `beam` | Straight geometric ray, exact segment radius, limited unique pierce victims |
| `chain` | First aimed enemy followed by up to `chains` new unique nearest victims within `chainRadius` |
| `splash` | Moving shell, one impact and one radial damage application per victim |
| `ring` | Periodic centered circular contact |
| `mortar` | Delayed ballistic impact at fixed aimed ground position, radial contact |
| `mine` | Short periodic land contact, excludes flying enemies |
| `drone` | Bounded virtual drone-origin shots, `count` independent projectiles, no render-driven damage |
| `pulse` | Area pulse centered at tower |
| `tide` | Area wave with per-victim bounded pushback |
| `melee` | Bounded close-radius sweep |

`count` drives independent projectiles, rays, chains or local pulses (cone uses its count as pellets). Direct projectiles live within a range-based lifetime; **each projectile has its own hit-target set**, so piercing cannot repeat the same enemy. Hits are computed from world coordinates and route progress, never from canvas pixels. Attack rate is bounded below by 0.05 s. Windup stores contact as a `StrikeState` and resolves by simulation time. Echoes use the same strike mechanism with a single scheduled replay and cannot schedule further echoes. All live ordnance is held in the snapshot arrays.

## Damage, statuses, boss phases and income

1. Raw packet damage gets the target's boss multiplier, elemental resistance clamped to 0–80%, then `mark` (10%), wet/electric (20%) and cold/kinetic (10%). Tower and support bonuses are already compiled into the attack packet.
2. Shield removes up to `raw × shieldMultiplier` shield points; the raw portion consumed by shield is deducted **once**. Any remainder loses `max(0, armor − armorPierce − strongestShred)`. Positive HP penetration always does at least 1 point.
3. For each outer-to-inner layer, the crossing threshold is `maxHp × (1 − cumulativeLayerHP / def.hp)`. A crossing from above to at/below triggers one payment at most, guarded by `paidLayers`. `bounty` is **not** awarded again at death. `credit` from frozen runtime accumulates hundredths (`cashSubunits`), including `incomeMul × popCashMul`; its `income` event records actual whole-credit payout.
4. HP zero marks death, stats and `kill` exactly once. DoT, chains, executions, splash, death bursts and abilities all enter the same function. Death bursts propagate through an iterative bounded work queue, never call back recursively. The parent's children and phase summons are quotas in `enemy.memory`; an overfull field postpones rather than discards them. Live children ≤ 1800 and generation ≤ 3. Death grants no extra bounty.
5. Boss thresholds process once per phase and store their phase marker; shields, phase-speed factor and delayed spawn quotas remain in `memory`. The engine must use `enemySpeedMultiplier` to apply `combat:phaseSpeed`. Boss rewind uses personal 2 s protection, displacement factors and a 90-pixel hard cap.

Burn and poison stack only by kind/source, capped by status `maxStacks` and tick every **0.25 simulated seconds**; fractional elapsed time survives save/load. No UI frame can add a DoT tick. Applying another status refreshes only up to the max duration, without cumulatively extending time. `freeze`/`stun` give ordinary enemies temporary full hard control followed by 0.35 s protection; boss hard control lasts at most 0.5 s, uses a minimum control factor of 0.15 and has two seconds of subsequent protection. Slows never drop ordinary walking speed under 25%. `reveal` pierces cloak, strongest `shred` weakens armor, strongest `mark` is 10% more damage. Bosses never become permanently stuck.

`executeBelow` executes a non-boss at or under the configured fraction of max HP by preparing enough raw damage to traverse shields and armor through the **ordinary packet formula**. Bosses instead receive a bounded bonus (up to 50%) and never execute outright. No unbounded multiplier or direct mutation to HP bypasses layer accounting.

## Effect semantics and limits

| Effect | Operational rule |
| --- | --- |
| `aura` | Highest positive stat per other supporting tower (not additive), per stat; caps: damage .4, speed .5, discount .15; no self support |
| `income` | Declarative wave-end amount consumed by engine only |
| `interest` | Declarative wave-end fraction consumed by engine only, capped by `cap` |
| `charge` | Adds up to `min(cap, power × idle / duration)` to next firing damage; resets when fired |
| `focus` | Adds `power × seconds` while locked to the same target, max `cap`; breaks on a target switch |
| `deathBurst` | On death of an infected enemy, one radius burst per owning tower/effect, iterative propagation |
| `copy` | Nearest different, genuinely attacking donor; its resolved **attack only** scaled to `power ≤ 1`, no statuses/effects, no copy-of-copy, no abilities/economy |
| `portal` | One target every `interval`, rewind `power` pixels; individual immunity prevents perpetual looping |
| `barrier` | Once per wave, restore `power` lives up to original `maxLives`; disabled at a one-life limit |
| `harvest` | One best eligible nearby harvester per kill, with per-tower/effect per-wave `cap`; disabled in iron-oath |
| `trap` | Bounded periodic local damage/status pulse on contact; no unlimited placed trap entities |
| `echo` | Exactly one delayed damage copy, `power ≤ 1`, up to `cap` unique chain targets; echoes never echo |

Active `nova`, `meteor`, `overclock`, `rewind`, `barrier`, `mint` consume a saved per-ability cooldown and emit a single event. `nova` damages a local circle; `meteor` is an aimed delayed radius impact; `overclock` temporarily increases tower rate; `rewind` obeys personal enemy immunity; `barrier` respects life cap; `mint` pays once via `credit`. In `iron-oath` combat actives remain available and mint is rejected; in `no-actives` all activations are rejected. All abilities require an active unpaused wave.

## Tests and integration expectations

`npm test -- tests/combat` exercises all twelve attack modes, all twelve effect kinds, nine statuses, six ability kinds, the 30×3 specialization matrix, six 5–2 crosspaths, death splitting, armor and shield ordering, DoT and layered income, phase and hard-control behavior, harvest restrictions, chain uniqueness and event/render independence. The fixtures are fully executable against local contract objects and do not import unfinished content or engine stubs.

At the frozen base commit all actual thirty tower content exports and the engine are stubs; passing isolated fixtures **does not** establish balance or end-to-end playability. During integration, rerun these tests against the populated catalog, verify boss movement uses `enemySpeedMultiplier`, verify engine single ownership of wave-end income/rewards, cap initial wave spawning at 1800 as well as child spawning, and exercise deterministic co-op snapshot round-trips. The combat module does not implement tower placement legality, purchase/sell logic, wave generation or render/audio playback.
