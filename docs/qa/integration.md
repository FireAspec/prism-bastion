# Headless integration acceptance

Base: 65ae156626cab219a9d8a6e7e6a63f8b4663d1f7. Contract v1. Reproduction seed: 710031.

## Run

From repository root with the pinned dependencies installed (`npm ci`):

```sh
npm exec -- vitest run tests/integration
npm run check
node scripts/check-game.mjs
```

The last command attempts both the focused integration suite and the normal project check, prints their individual exit status, and returns nonzero if either fails. No acceptance tests are marked skip or todo. A missing implementation is a failure, not a pass.

## Coverage

| Area | Reproduction / assertions |
|---|---|
| Upgrade legality | Explicit 64-state oracle, all 216 triples and 648 outgoing edges; 30 actual towers × 64 legal states × 3 attempted commands (5,760 edges); 180 final cross-path permutations; invalid mutations leave economy and towers intact. |
| Content | Exact inventory, 450 adjacent pure-path gameplay comparisons, 480 primary SVG references, 180 overlay references, 90 T5 behavior signatures (distinct within each tower), deterministic resolution, no mutation of definitions. Byte-distinct SVGs are not proof of visual quality. |
| T5 | Two players, duplicate specialization denied, different specialization allowed, unauthorized sale denied, legitimate sale releases slot. |
| Economy | Purchase at 80, upgrade at 40, invested 120, resale 84, loss 36; strongest aura plus doctrine capped at 20%; invalid placement and insufficient funds are atomic. |
| Modes | Four difficulty presets × ten modes × four player counts; budgets, HP, rule flags, weather, wave reward fields and limits. |
| Campaign | All 20 progression steps, exact tower unlock sets before/after each first clear, locked next-but-one map, losses and duplicate clears. |
| Knowledge | 150 purchased nodes across five branches, 19 stat probes with cap and duplicate suppression, each actual node's declared observable effect, no charge for repurchase after reset, reward idempotency and eligibility. |
| Combat | Seeded single-wave run bounded to 1,200 fixed ticks, pause freeze, event uniqueness, three paid layers, final credits 887, replay equality; half-cash fractional balance, regeneration, reload, no repeated payout. |

## Status at preparation

* Verified via repository API: base commit exists. Its engine, combat, content, campaign, modes, progression and persistence entry points throw pending errors. The base combat module also lacks the damageEnemy export.
* Executed locally against the frozen contract snapshot, not a repository checkout: strict TypeScript compilation of all eight contract files succeeded; a Node assert reproduction of the finite rule oracle passed all 216 states, 648 edges and 11 refund cases. This is not a Vitest or game simulation result.
* Direct git clone/ls-remote blocked by DNS resolution of github.com in the shell. Repository API access was available for source inspection and publication. The complete npm dependency tree and a working checkout were not available locally.
* The new Vitest suite, full typecheck, npm run check, and actual game fixture execution have **not** been run. No passing result is claimed for them. Run them on the integrated branch before approval. No production defect is established by an unexecuted case.

## Reproducible failure / investigation cases

| Case | Expected | Base / pending |
|---|---|---|
| catalog.test.ts / exact inventory | 30 tower definitions and validator with no errors | loadContent throws Content registry pending |
| engine.test.ts / team-wide T5 | second owner's duplicate denied, then accepted after owner sale | createGame / createCombat throw pending errors |
| engine.test.ts / fractional payout | 50 subunits after first layer, 50 after regen/reload, final +1 credit and 50 subunits | damageEnemy unavailable on base; persistence pending |
| progression.test.ts / normal / iron-oath | 60 rounds, 1 life, no passive income, no sale, no knowledge; combat abilities allowed | resolveRules throws Rules pending |
| progression.test.ts / campaign progression | first map only initially, final set has all 30 towers | createCampaign throws Campaign service pending |
| progression.test.ts / 150 nodes | all purchased in branch order; 30,850 seals total | createProgression throws Progression pending |
| engine.test.ts / bounded fixture | victory, 150 lives, 887 credits, 3 layerBreak events and 1 kill | engine and combat pending |

## Integration notes

The fixture supplies a one-round normal difficulty and deliberately rich starting credits for the command matrix. Engine must consume the supplied GameConfig, not a global mutable catalog. Asset checks assume public-relative or root-relative art paths. Knowledge speed is tested as increased attacks per second (interval divided by 1.12), cooldown as a 12% reduction; if integration settles different semantics, reconcile explicitly with the rules before changing the oracle. The synthetic stat nodes intentionally exceed caps and bypass normal purchase; actual node purchases and effects are tested separately.

The suite does not establish map winnability, subjective artwork quality, 4K rendering, all co-op network failure modes, all status combinations, or performance in late waves. Those require dedicated replay, UI, network and asset QA modules. No production source, frozen interface, package manifest or CI configuration is changed here.
