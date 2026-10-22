# Simulation module

Entry points: `createGame(config, options, combat)` and
`restoreGame(config, snapshot, combat)` from `src/engine/index.ts`.
The engine is deterministic, headless, and has no browser, audio, or network
dependency. It owns the run state, transactions, spawning, path movement,
leaks, wave rewards, and passive/interest economy. Damage, layer payments,
status application, projectile/strike contact, abilities and enemy deaths are
delegated to the injected `CombatModule`.

## State and tick order

1. `build` initially: purchase, upgrade, sell, change priority; `startWave`
   increments the wave number, opens its spawn cursors, and emits `waveStart`.
2. Each `1/60`-second simulation tick: spawn due groups, call
   `combat.step`, move surviving enemies along the actual arc length of their
   lane, apply leaks, check defeat, then check wave completion.
3. A wave ends only after **all** group cursors reach their counts **and** all
   enemies (including combat-spawned children) have left the live array.
   `waveEnd`, calculated round reward, passive income and interest run once;
   the engine returns to `build` or starts the next wave when auto-start is on.
4. The selected difficulty uses the first 40/60/80/100 curated waves (or the
   `rounds` partial mode override). The final wave emits `victory` once;
   standard runs become terminal, while endless runs may continue on the
   remaining curated waves and the catalog's endless generator after wave 100.
   Defeat freezes further simulation and reward allocation.

Each call to `step(realSeconds)` accepts at most 250 ms of wall-time work.
`speed=1|2|3` changes the number of complete fixed steps, never the tick
duration. Headless callers can process arbitrarily long runs with successive
`step(0.25)` calls. Solo pause suspends the entire simulation clock.
Between waves, idle rendering time is not counted as combat time.

The internal fractional render-frame accumulator is not part of the frozen
v1 `GameState`. For bit-for-bit save/replay validation, checkpoint on a
complete 1/60-second step; restoring between two sub-tick frame fractions may
discard **less than one** pending simulation tick. A future contract revision
could serialize the accumulator independently of `stats.cashSubunits`.

## Commands and authority

All purchases are sequential and immediately committed against one shared
wallet; insufficient balance changes nothing. Solo accepts an absent actor
and assigns the first player as owner. In multiplayer, `place` requires an
existing player ID, and upgrade/sell/target/ability require the matching
`tower.owner`. Only `actor: 'server'` may execute multiplayer `startWave`,
`pause`, `speed`, and `autoStart`. The network host must derive this
authority itself, **never** trust an actor supplied by a remote client.

`reassignOwner` is a host-only method. Its signature has no caller or
disconnection timestamp; therefore the host must authorize it and enforce
the 30-second disconnected-owner grace period before invoking it.

Legal crosspath combinations use frozen `canUpgrade`; exactly one branch
may exceed tier 2, and only two branches may be nonzero. Tier 5 for a
particular tower type and branch is exclusive across the whole team, until
that tower is sold. Base and upgrade prices use
`ceil(originalCost * towerCostMul * (1 - discount))`, minimum 1.
The strongest nearby non-self support discount is capped at 15%; knowledge
discount at 8%; combined discount at 20%. All actual paid prices accumulate
in `invested`; selling refunds `sellRefund(invested)`, exactly
`floor(0.7 * invested)`, independently of current discounts or tower income.

Placement checks the complete circular footprint: world bounds, all lane
segments plus half the declared path width, blocked polygon intersections,
water intersections for land towers, containment within a water polygon for
water towers, and other construction circles. Touching an edge without
overlap is valid. `either` towers work on land or water, but never on paths
or blocked obstacles.

## Economy and mode boundaries

Difficulty supplies base lives, starting credits, enemy health, tower cost,
round limit, and round reward formula. Partial mode modifiers override
those fields, followed by configured knowledge and fixed player scaling:
cash and enemy health ×1/1.25/1.50/1.75 for one through four players.
The engine validates and locks these rules at creation. The caller must
pass an already resolved content configuration from the progression service;
when a mode forbids knowledge, it must not preapply knowledge-derived attack
bonuses to that configuration.

Round `n` pays only
`(roundRewardBase + n * roundRewardStep) * incomeMul`.
`WaveDef.reward` is informational and is never paid on top. Farm
`income` effects and capped `interest` effects are paid once at wave end;
interest is based on the current pre-reward balance to prevent same-round
compounding between support towers. Passive `barrier` heals toward
`rules.maxLives` only when that limit is greater than 1.

Every fractional payment passes through the frozen `credit` helper, which
retains hundredths in `stats.cashSubunits`. Combat owns the paid-layer
crossing logic and must call `credit(state, layerCash * popCashMul *
incomeMul)` exactly once per layer ID; it must retain `paidLayers` across
regeneration and save/restore. `EnemyDef.bounty` is **not** a second reward.
Harvest uses the same combat-owned payment path and caps.

In iron-oath, the engine disables sell, knowledge discount, passive economy
and one-life barrier. It supplies combat with a private filtered catalog
where no base/upgrade `income`, `interest`, `harvest`, `barrier`,
`mint` or barrier ability is accessible. In no-leaks, farms remain legal,
but barrier cannot add lives beyond one. Active ability enforcement otherwise
belongs to `combat.activate`, using the same immutable filtered catalog.
Weather interpretation (`blackout`, alternating wet/dry every five waves)
is a combat/render concern: `state.rules.weather` and `state.wave` are
deterministic inputs, rather than a second wall-clock simulation.

## Snapshots, events, integration

- Engine-owned options and catalog data are copied at creation; `getSnapshot`
  and `drainEvents` return independent deep copies, safe for renderer mutation.
- `restoreGame` restores active enemies, paid-layer flags, projectiles,
  strikes, cooldowns, wave cursors, RNG, economy and pending events. It
  verifies essential invariants and rederives rules from the selected run.
- Entity and event IDs are monotonically increasing. An undrained event
  queue keeps at most the newest 16,384 events, protecting memory in
  unattended headless runs. The app should drain once per frame and fan out
  the **same** batch to render/audio/network consumers. If an app does not
  drain for extremely long periods, historical cosmetic events are discarded.
- Combat may mutate the passed `GameState`, but may not replace the rules,
  add bonus wave payouts, increment the wave, or silently promote owners.
  Content modules should expose independent or immutable definitions.
- Unknown/malformed run settings, incompatible restored rules and invalid
  spawn group definitions are rejected; terminal runs cannot purchase or
  accrue rewards. Host-side protocol validation and profile/digest migration
  remain the responsibility of their own modules.

## Verification

`tests/engine/simulation.test.ts` uses local deterministic combat doubles,
not the pending combat module. Coverage includes:

- Seed and save/restore equivalence, frozen pause, exact 1×/3× step counts,
  render-delta clamping, independent state/events;
- timed multi-lane groups, map overrides, arc-length turns, slow/stun,
  leaks and terminal defeat;
- complete 40/60/80/100-wave victory cycles, single endless milestone;
- geometry boundaries and water-only placement, locked towers, atomic
  purchase race, exact affordability;
- multiplayer ownership, server-only global commands, transfer;
- all six 5–2–0 permutations, forbidden crosspaths, T5 team uniqueness,
  sale slot release, tier cap and actual discounted refund;
- one-credit layer payments in half-cash, fractional carry through save,
  capped passive/interest once per wave, strict economy and barrier rules,
  all four player health/cash multipliers.

Integration acceptance still requires the real combat, content, mode,
progression, network and UI modules; tests here intentionally do not
claim projectile-contact, full-map balance or multiplayer socket QA.
