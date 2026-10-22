# Difficulty and challenge modes — module 37

## Public interface and ownership

The v1 frozen contract is unchanged. The module owns `src/modes/**`, and exposes:

```ts
getDifficulties(): DifficultyDef[];
getModes(): ModeDef[];
resolveRules(modeId: string, difficulty: Difficulty, players: number): RuleModifiers;
```

The following additive helpers stay within the same module; none requires a contract change:

```ts
applyKnowledgeLives(rules: RuleModifiers, lifeBonus: number): RuleModifiers;
startingCredits(difficulty: Difficulty | Pick<DifficultyDef, 'startCredits'>, rules: RuleModifiers): number;
roundReward(rules: RuleModifiers, wave: number): number;
modeRewardMultiplier(modeId: string): number;
canGrantIncome(modeId: string, source: IncomeSource): boolean;
awardIncome(state: GameState, source: IncomeSource, baseAmount: number): number;
awardRoundReward(state: GameState, wave: number): number;
canActivateAbility(modeId: string, kind: AbilityDef['kind']): boolean;
waveWeather(rules: RuleModifiers, wave: number, seed: number): 'clear' | 'wet' | 'fog';
```

All getters return fresh objects; mode overrides are **partial** and never replace an entire difficulty preset. Unknown mode/difficulty, invalid number of players, negative credit, and invalid wave/seed inputs fail explicitly. One selected mode per run; mode stacking and paid boosts are not supported.

## Run difficulty — independent of map group

| Difficulty | Waves | Lives | Start | Tower cost | Enemy HP | Completed wave `n` | Meta reward |
|---|---:|---:|---:|---:|---:|---:|---:|
| easy | 40 | 200 | 1,000 | ×0.85 | ×0.85 | 100 + 5n | ×0.70 |
| normal | 60 | 150 | 900 | ×1 | ×1 | 80 + 4n | ×1 |
| hard | 80 | 100 | 850 | ×1.10 | ×1.10 | 60 + 3n | ×1.35 |
| extreme | 100 | 1 | 850 | ×1.20 | ×1.20 | 50 + 2n | ×1.70 |

`MapDef.difficulty` (1–4) only describes map geometry. **Do not pass it to `resolveRules`**, nor use it to select wave counts, lives, HP, prices, or meta-reward difficulty. The selected `RunOptions.difficulty` is authoritative. Each difficulty selects a prefix of the shared 100-wave program; the final wave is 40/60/80/100 respectively.

The mode-specific meta reward multipliers are: standard 1.00; half-cash 1.60; no-leaks 1.70; iron-oath 2.25; short-supply 1.45; blackout 1.40; stormfront 1.45; overdrive 1.50; low-tech 1.50; no-actives 1.35. Progression applies **both** the difficulty's `rewardMul` and `modeRewardMultiplier(modeId)` exactly once. Other first-clear/repeat/knowledge rules are owned by progression; do not round intermediate products.

## Mode restrictions — integration matrix

The cells below describe the requested restrictions; engine/combat/progression must enforce them during authoritative simulation, not only in the UI. All unspecified properties retain the selected difficulty defaults.

| Mode | Sell | Extra income¹ | Knowledge | Combat active | Money active | Tower cap | Max upgrade tier | Weather / changes |
|---|---|---|---|---|---|---:|---:|---|
| standard | ✓ | ✓ | ✓ | ✓ | ✓ | 60 | 5 | clear |
| half-cash | ✓ | ✓, ×0.5 | ✓ | ✓ | ✓, ×0.5 | 60 | 5 | clear; start ×0.5 |
| no-leaks | ✓ | ✓ | ✓ except extra lives | ✓ | ✓ | 60 | 5 | clear; **1 life** |
| iron-oath | **no** | **no** | **no** | **yes** | **no** | 60 | 5 | clear; **1 life**, no defeat continue |
| short-supply | ✓ | ✓ | ✓ | ✓ | ✓ | **12** | 5 | clear |
| blackout | ✓ | ✓ | ✓ | ✓ | ✓ | 60 | 5 | fog; reveal important |
| stormfront | ✓ | ✓ | ✓ | ✓ | ✓ | 60 | 5 | wet/clear, flips every 5 waves |
| overdrive | ✓ | ✓, ×1.10 | ✓ | ✓ | ✓, ×1.10 | 60 | 5 | clear; enemy speed ×1.35 |
| low-tech | ✓ | ✓ | ✓ | ✓ if learned at T1–T3 | ✓ if learned at T1–T3 | 60 | **3** | clear |
| no-actives | ✓ | ✓ except abilities | ✓ | **no** | **no** | 60 | 5 | clear |

¹ *Extra income* is farms/production (`income` effects), interest, harvest, money-producing abilities, and other bonuses; it is **not** paid enemy layers or the normal end-of-round reward. `IncomeSource` is `layer | round | farm | interest | harvest | income-ability | bonus`. Strict `iron-oath` allows only `layer` and `round`. `canGrantIncome` fails closed for an unknown source. `canActivateAbility('iron-oath', kind)` is **true** for `nova`, `overclock`, `meteor`, `rewind`, `barrier` and **false** for `mint`.

`no-leaks` and `iron-oath` share a one-life cap but are intentionally different: the former retains farm income, knowledge (except extra lives), sale, passive effects and every active; the latter forbids selling, all extra income, knowledge and money actives. The strict-mode prohibition on continuing after defeat applies if the engine later adds a continue flow; v1 `GameAction` currently has no continue command.

## Authoritative integration rules

### Engine

1. Resolve selected difficulty, mode, and fixed player count (integer 1–4). The co-op factors are `1, 1.25, 1.5, 1.75`, applied to the **shared starting wallet** and enemy HP, not wave counts or layer/round cash. `startingCredits(selectedDifficulty, rules)` floors the final product once. When the progression system has modified a `DifficultyDef` for legal starting-cash knowledge, pass that *updated definition object* to `startingCredits`.
2. For allowed life knowledge, use `applyKnowledgeLives` once on the run-local rules before initializing state. This adds at most 20 lives **only if** `rules.maxLives > 1 && rules.allowKnowledge`; it leaves a cap of 1 unchanged. Healing/refunds/resume must respect the run's final `maxLives`. Never let profile changes mid-run recompute rules.
3. A purchase checks current team tower count against `maxTowers`, proposed path tier against `maxTier`, and discount-adjusted actual price against the shared wallet. A sale checks `sellAllowed`. No new free towers or above-cap T5s; the existing `sellRefund` contract remains the sole 70% rule.
4. Pay completed wave `n` using **one** `awardRoundReward(state, n)` invocation; never also pay `WaveDef.reward`. Only execute at the authoritative wave-end transition, guarded by simulation phase/state to avoid paying again after restore or reconnect. `roundReward` is the read-only preview of that same formula.
5. Before starting each wave (and for preview), call `waveWeather(state.rules, wave, state.options.seed)`. `fog` is permanent in blackout; stormfront's first wet/clear block depends on the lowest bit of seed, then flips at waves 6, 11, 16, etc. Clients merely display the authoritative value. Neither local date/time nor animation frame time participates.

### Combat

1. Pay each *newly broken layer* once with `awardIncome(state, 'layer', layer.cash)`; preserve `EnemyState.paidLayers` across all save/snapshot/reconnect operations. `awardIncome` applies `popCashMul × incomeMul` for layers and `incomeMul` for every other permitted income source, then calls the frozen `runtime.credit` once. **Do not** round 0.5 to 0 or 1 first, and do not separately pay `EnemyDef.bounty` on death.
2. Route the income from farms, interest, harvest, production bonuses, and monetary abilities through `awardIncome` with the corresponding source. Denied payments yield zero **without mutating** credits, events, or fractional remainder. Do not create a second income path from effects or UI animations.
3. Before activating any ability, use both `rules.allowAbilities` and `canActivateAbility(modeId, ability.kind)`. `iron-oath` keeps damage/control actives usable; only `mint` is prohibited. `no-actives` rejects all manually activated abilities. Passive effects continue according to their own rules.
4. Apply `rules.enemySpeedMul` for overdrive consistently during movement. Fog/reveal and wet status effects belong to combat and rendering, not to the mode-data module. World weather should be sampled from `waveWeather`, without local RNG/time.

### Progression and UI

1. Only present additional challenge modes on a map after its standard clear (`ModeDef.requiresClear`). A standard clear on **any** selected difficulty can advance the story. Mode and difficulty are stored as fixed `RunOptions` for the run.
2. `iron-oath` must pass an **empty** knowledge set to run-specific progression application; `allowKnowledge=false` is a simulation invariant. Deduplicate co-op players' knowledge IDs and apply normal caps in all other modes.
3. Medal/reward key includes map, **selected difficulty**, and mode. Use the difficulty's `rewardMul` and the mode multiplier; map group determines only its separate `mapXP`/`mapSeals` base. Do not count wave cash, child kills, players, or endless waves as extra meta payouts.
4. Show the mode's complete description, including the special life, income and ability exclusions. Display wet/clear change one block ahead for stormfront and show fog/reveal affordances without obscuring navigation.

## Validation

Unit tests in `tests/modes/modes.test.ts` cover:

- All 160 combinations of 4 difficulties × 10 modes × 4 team sizes, deterministic repeated resolution and defensive data copies.
- Exact lives/rounds/costs/HP/wave rewards and meta multipliers, with map group excluded.
- The no-leaks / iron-oath difference, allowed combat active vs monetary active, strict knowledge life caps, tower/tier caps, and no-actives.
- Positive and denied income through frozen `runtime.credit`, half-credit persistence, a genuine wave payout, seeded five-wave weather transitions, and invalid inputs.

Integration in the independent engine, combat, wave, renderer, and progression branches is pending. These tests use only frozen contracts and local test doubles; they are **not** replay evidence for any map, and do not prove every mode is winnable. Only a merged playable simulation can establish that with recorded, replayable clears.
