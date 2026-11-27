# Balance QA and deterministic replay

## Status and acceptance boundary

Frozen base: 65ae156626cab219a9d8a6e7e6a63f8b4663d1f7. At that commit createGame, createCombat, loadContent and validateContent throw pending errors. No gameplay victory or balance correction can be justified from that base.

| Coverage | Required | Verified at baseline |
|---|---:|---:|
| First-arrival standard, recommended difficulty, solo | 20 | 0 |
| Release gate, solo | 200 | 0 |
| Expanded, solo | 800 | 0 |
| Release gate, scaling 2 and 4 | 400 | 0 |
| Expanded, scaling 2 and 4 | 1600 | 0 |

This is a blocked release gate, not a failure of every map. The strategy search is heuristic; exhausted strategies are not a proof of impossibility. No tuning changes are proposed without measured evidence.

## Running on the integrated checkout

Install existing dependencies using npm ci. Node >=22.12 and the existing tsx dependency are required. No new package or contract changes.

- `npx vitest run tests/balance` — isolated fixture tests.
- `npm run check` — existing repository-wide checks.
- `node --import tsx scripts/run-balance.mjs --map lantern-garden --mode standard` — first campaign map smoke test.
- `node --import tsx scripts/run-balance.mjs --scope gate --players 1` — required 200 cells.
- `node --import tsx scripts/run-balance.mjs --scope expanded --players 1 --output validation/replays/expanded` — 800 cells.
- `node --import tsx scripts/run-balance.mjs --scope gate --players 2,4 --output validation/replays/coop` — 400 cells using a common wallet and owned towers.
- `node --import tsx scripts/run-balance.mjs --scope expanded --players 2,4 --output validation/replays/coop-expanded` — 1600 cells.
- `node --import tsx scripts/run-balance.mjs --verify validation/replays/<record>.json` — verifies one saved record against its exact content digest.

Use --seed for an additional independent run, --strategy to isolate a policy and --limit to bound simulation ticks. Use a separate output directory per seed or matrix; report.json is the latest report for that directory. A filtered run does not pass the complete gate. The full search executes all eight policies per cell and replays each finished attempt; it can be expensive. A tick limit, missing content, or a command mismatch is not a defeat.

## Evidence format and verification

The runner uses the real engine and combat factories through their public APIs, fixed batches of at most 15 simulation ticks, no manual state mutation and no additional credits. The engine is the authority on placement, costs, ownership, upgrades and abilities. Only accepted synchronous commands are recorded. Actual command result entity and amount, tick, game time and wave are compared during replay. The final snapshot excluding the transient event queue is canonicalized and hashed with SHA-256. Content digest and run options must match. Verified wins must end at the configured round with positive lives. Boss checkpoints are recomputed during replay.

The standard profile is the four initial towers plus unlocks from previously completed campaign nodes. Challenge profiles include the reward of the current map after its first clear. Knowledge is empty. The runner checks initial difficulty and common-wallet scaling, including fractional starting credits, and key mode restrictions. Multiplayer here means headless simulation with two or four actors; it does not replace the network transport/reconnect suite.

The strategy bank varies boss damage, crowd damage/control, income, coverage, upgrades and available tower subset. It samples paths and candidate positions; land/water/blocked polygons and footprint are filtered, with the engine performing final legality checks. Candidate grid and finite search budgets can miss a solution. Estimates of damage, aura value, economy and placement are ranking heuristics only; confirmed results depend on simulation, not these estimates.

## Reports and tuning

Each record includes the options (seed, difficulty, mode, unlocked towers, knowledge and roster), actions, result, final digest, content digest and before-boss checkpoints. Each matrix cell records all attempted policies, their verified win/defeat or error, and the artifact filename. Not-run cells are explicit. The CLI exits nonzero unless every cell of the requested full matrix has a verified win. A blocked preflight also exits nonzero.

- Dominating builds: report.analysis.finalBuildFrequency counts cells with each final build among verified wins. This is a screening statistic, not proof of dominance; compare same-map, mode, difficulty and seed results and consider strategy selection bias.
- Farm necessity: report.analysis.farmComparison pairs the no-farms policy with other policies for each cell. A verified no-farm win disproves necessity for that specific cell; no-farm failure does not establish necessity. No-farm forbids economic towers and monetary upgrades or abilities.
- Half-cash and iron-oath: report.analysis.budgets contains each attempt's final credits, earned/spent, fractional remainder and boss checkpoints. Iron-oath is the no-passive-income case, not a zero-pop-income mode.
- T5: report.analysis.t5 records actual purchased T5s at each boss-wave start for verified wins. No T5 in a checkpoint is not proof of unaffordability. Low-tech intentionally disallows T5.
- Any future tuning proposal must include content digest, affected cell, measured result, reproducible commands, precise proposed field changes and a before/after rerun; keep changes to other owners' content outside this branch.

## Checks performed for this branch

The frozen base package and public entry points were read. An isolated JavaScript harness ran the published fixture assertions with a substitute hash adapter (not Node crypto): seven tests passed; the SHA-256 test was skipped. The fixture checks matrix counts, profile unlocks, scaling assertions, accepted/rejected action recording, tamper rejection, stall/limit handling and geometry. They are not gameplay evidence. The normal Vitest suite and npm run check were not run: the local shell could not resolve github.com to clone the checkout; dependencies and full working tree are unavailable. The actual headless matrix remains unexecuted. Run the commands above in an integrated checkout and review report.json before release.

The module is a draft pending real engine/combat/content integration, real replay evidence and the normal Node test suite.
