/**
 * Honest real-engine replay handoff:
 * npx tsx validation/maps/fracture-bridge/run-replays.ts [--plan oath-no-economy]
 * Exit 0 = all requested plans actually won; 1 = failure; 2 = shared engine pending.
 */
import {candidates, firstVisitTowers, type ReplayAction, type StrategyCandidate} from './strategies';
import type {GameConfig, GameEngine, RunOptions} from '../../../src/contracts';

const STEP = 1 / 60;
const MAX_TICKS = 60 * 180;

function runPlan(config: GameConfig, create: (options: RunOptions) => GameEngine, plan: StrategyCandidate) {
  const engine = create({mapId: 'fracture-bridge', difficulty: 'extreme', modeId: plan.modeId,
    seed: plan.seed, endless: false, unlockedTowers: [...firstVisitTowers],
    players: [{id: 'local', name: 'Проверка', color: '#72d5dc', connected: true}],
    runId: `fracture-${plan.id}-${plan.seed}`, knowledge: []});
  const aliases = new Map<string, string>();
  const executed = new Set<ReplayAction>();
  const receipts: {wave: number; tick: number; action: string; creditsBefore: number; creditsAfter: number}[] = [];

  function perform(action: ReplayAction) {
    const before = engine.getSnapshot();
    const result = action.type === 'place'
      ? engine.dispatch({type: 'place', tower: action.tower, pos: action.pos, actor: 'local'})
      : engine.dispatch({type: 'upgrade', tower: aliases.get(action.alias) ?? '', path: action.path, actor: 'local'});
    if (!result.ok || result.pending) throw new Error(
      `Wave ${action.wave} tick ${action.tick}: rejected ${action.type} ${action.alias}: ${result.reason ?? 'pending'}`);
    if (action.type === 'place') {
      if (!result.entity || aliases.has(action.alias)) throw new Error(`Invalid placement alias ${action.alias}`);
      aliases.set(action.alias, result.entity);
    }
    const after = engine.getSnapshot();
    if (after.credits < 0) throw new Error('Negative credits');
    receipts.push({wave: action.wave, tick: action.tick, action: `${action.type}:${action.alias}`,
      creditsBefore: before.credits, creditsAfter: after.credits});
    executed.add(action);
  }

  for (let wave = 1; wave <= 100; wave++) {
    const state = engine.getSnapshot();
    if (state.phase !== 'build') throw new Error(`Wave ${wave}: expected build, got ${state.phase}`);
    for (const a of plan.actions.filter(a => a.wave === wave && a.tick === 0)) perform(a);
    const started = engine.dispatch({type: 'startWave', actor: 'local'});
    if (!started.ok || started.pending) throw new Error(`Wave ${wave}: start rejected: ${started.reason ?? 'pending'}`);
    let finished = false;
    for (let tick = 1; tick <= MAX_TICKS; tick++) {
      engine.step(STEP);
      const current = engine.getSnapshot();
      if (current.phase === 'defeat') throw new Error(`Lost on wave ${wave}, tick ${tick}; lives=${current.lives}`);
      for (const a of plan.actions.filter(a => a.wave === wave && a.tick === tick)) perform(a);
      if (current.phase === 'build' || current.phase === 'victory') {finished = true; break;}
    }
    if (!finished) throw new Error(`Wave ${wave}: exceeded ${MAX_TICKS} ticks`);
  }
  if (executed.size !== plan.actions.length) throw new Error(`Unexecuted purchases ${executed.size}/${plan.actions.length}`);
  const end = engine.getSnapshot();
  if (end.phase !== 'victory' || end.lives < 1) throw new Error(`No verified victory: ${end.phase}, lives=${end.lives}`);
  return {id: plan.id, verified: true, status: 'won', wave: end.wave, lives: end.lives,
    credits: end.credits, seed: plan.seed, receipts};
}

async function main() {
  const index = process.argv.indexOf('--plan');
  const selected = index >= 0 ? candidates.filter(p => p.id === process.argv[index + 1]) : candidates;
  if (!selected.length) throw new Error(`Unknown plan ${process.argv[index + 1]}`);
  try {
    const [{loadContent}, {createCombat}, {createGame}] = await Promise.all([
      import('../../../src/content/index'), import('../../../src/combat/index'), import('../../../src/engine/index'),
    ]);
    const config = loadContent(); // Throws "pending" in the frozen base.
    const results = selected.map(p => runPlan(config, options => createGame(config, options, createCombat()), p));
    process.stdout.write(JSON.stringify({mapId: 'fracture-bridge', results}, null, 2) + '\n');
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const unavailable = /pending|not implemented|cannot find module|does not provide an export/i.test(reason);
    process.stdout.write(JSON.stringify({mapId: 'fracture-bridge', verified: false,
      status: unavailable ? 'engine-unavailable' : 'failed', candidates: selected.map(p => p.id), reason}, null, 2) + '\n');
    process.exitCode = unavailable ? 2 : 1;
  }
}
void main();
