import type {EconomyConfig, GameConfig, Profile, RunResult, RewardReceipt, GameState} from '../contracts';
import type {ProgressionService} from '../contracts/progression';
import {apply, bonus, clone, knowledgeAllowed, selected, validate} from './knowledge';

export function xpToLevel(xp: number, economy: EconomyConfig): number {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new RangeError('Invalid absolute XP');
  const [a,b,c] = economy.xpCurve;
  if (![a,b,c].every(n=>Number.isSafeInteger(n)&&n>=0) || a+b+c<=0) throw new RangeError('Invalid XP curve');
  // Sum L=1..level-1, using closed form and binary search for prestige levels.
  const threshold = (level: number) => {
    const n = level-1;
    return a*n + b*n*(n+1)/2 + c*n*(n+1)*(2*n+1)/6;
  };
  let low=1, high=2;
  while (threshold(high) <= xp) high *= 2;
  while (high-low > 1) {
    const mid = Math.floor((low+high)/2);
    if (threshold(mid) <= xp) low=mid; else high=mid;
  }
  return low;
}
export function medalKey(result: Pick<RunResult,'mapId'|'difficulty'|'modeId'>): string {
  return `${result.mapId}:${result.difficulty}:${result.modeId}`;
}
/** Convert only terminal snapshots; a defeat's active wave was not completed. */
export function terminalResult(state: Pick<GameState,'phase'|'options'|'rules'|'wave'|'time'>, eligible: boolean, contentDigest: string): RunResult | null {
  if (state.phase !== 'victory' && state.phase !== 'defeat') return null;
  const rounds = state.rules.rounds;
  if (state.wave > rounds || (state.phase === 'victory' && state.wave !== rounds)) return null;
  const {runId,mapId,modeId,seed,difficulty} = state.options;
  return {runId,mapId,modeId,seed,difficulty,rounds,won:state.phase==='victory',
    wave:state.phase==='victory'?rounds:Math.max(0,state.wave-1),eligible,durationSeconds:state.time,contentDigest};
}
/** Story completion is separate from currency; evaluate the recipient's own profile. */
export function canCompleteCampaign(config: GameConfig, profile: Profile, result: RunResult): boolean {
  const node = config.campaign.find(n=>n.mapId===result.mapId);
  return result.eligible && result.won && result.modeId==='standard' && !!node &&
    !profile.completedNodes.includes(node.id) && node.prerequisites.every(id=>profile.completedNodes.includes(id));
}
const unique = (ids: string[]) => [...new Set(ids)];
const floorReward = (n: number) => Math.floor(n + Number.EPSILON * Math.max(1,n) * 4);

/** Pass the personal start-of-run loadout to rewardForRun when it is available. */
export interface RunProgressionService extends ProgressionService {
  rewardForRun(profile: Profile, result: RunResult, startKnowledge: readonly string[]): {profile: Profile; receipt: RewardReceipt};
}
export function createProgression(config: GameConfig): RunProgressionService {
  const e = clone(config.economy);
  const [a,b,c] = e.xpCurve;
  if (![a,b,c].every(n=>Number.isSafeInteger(n)&&n>=0) || a+b+c<=0) throw new RangeError('Invalid XP curve');
  const earned = (level: number) => Math.max(0, Math.min(level,e.maxRewardLevel)-1)*e.pointsPerLevel;
  const normalize = (profile: Profile): Profile => {
    const p = clone(profile);
    p.level = xpToLevel(p.xp,e);
    p.knowledgeUnlocked = unique(p.knowledgeUnlocked);
    p.knowledgePaid = unique([...p.knowledgePaid,...p.knowledgeUnlocked]);
    p.claimedRuns = unique(p.claimedRuns);
    p.knowledgePoints = Math.max(0,earned(p.level)-p.knowledgeUnlocked.length);
    return p;
  };
  const fail = (profile: Profile, reason: string) => ({profile,ok:false,reason});
  function rewardForRun(profile: Profile, result: RunResult, startKnowledge: readonly string[]) {
    const level = xpToLevel(profile.xp,e);
    const receipt: RewardReceipt = {xp:0,seals:0,points:0,levelBefore:level,levelAfter:level,firstClear:false,duplicate:false};
    const noop = () => ({profile,receipt});
    if (profile.claimedRuns.includes(result.runId)) { receipt.duplicate=true; return noop(); }
    const map = config.maps.find(m=>m.id===result.mapId);
    const mode = config.modes.find(m=>m.id===result.modeId);
    const difficulty = config.difficulties.find(d=>d.id===result.difficulty);
    const modeMul = Object.hasOwn(e.modeReward,result.modeId) ? e.modeReward[result.modeId] : undefined;
    if (!result.runId.trim() || typeof result.won !== 'boolean' || result.eligible !== true || result.contentDigest!==config.contentDigest ||
        !map || !mode || !difficulty || modeMul===undefined || !Number.isFinite(modeMul) || modeMul<=0 ||
        !Number.isFinite(result.durationSeconds) || result.durationSeconds<0 ||
        !Number.isInteger(result.wave) || result.wave<0 || result.rounds!==(mode.modifiers.rounds ?? difficulty.rounds) ||
        result.rounds<=0 || result.wave>result.rounds || (result.won ? result.wave!==result.rounds : result.wave===result.rounds)) return noop();
    const p = normalize(profile);
    const nodes = knowledgeAllowed(config,result.modeId) ? selected(config,startKnowledge) : [];
    const base = e.mapXP[map.difficulty-1]*difficulty.rewardMul*modeMul;
    const seals = e.mapSeals[map.difficulty-1]*difficulty.rewardMul*modeMul;
    const key=medalKey(result);
    if (result.won) {
      receipt.firstClear = !(p.medals[key]>0);
      receipt.xp = floorReward(base*(receipt.firstClear?e.firstClearXP:e.repeatXP)*(1+bonus(nodes,'xpGain')));
      receipt.seals = floorReward(seals*(receipt.firstClear?1:e.repeatSeals)*(1+bonus(nodes,'sealGain')));
      p.medals[key] = (p.medals[key] ?? 0)+1;
    } else if (result.wave>=10) {
      receipt.xp = floorReward(base*e.defeatXP*(result.wave/result.rounds)*(1+bonus(nodes,'xpGain')));
    }
    if (!Number.isSafeInteger(p.xp+receipt.xp) || !Number.isSafeInteger(p.seals+receipt.seals)) throw new RangeError('Reward exceeds profile range');
    p.xp+=receipt.xp; p.seals+=receipt.seals;
    p.level=xpToLevel(p.xp,e);
    receipt.levelAfter=p.level; receipt.points=earned(p.level)-earned(level);
    p.knowledgePoints=Math.max(0,earned(p.level)-p.knowledgeUnlocked.length);
    p.bestWave[key]=Math.max(p.bestWave[key] ?? 0,result.wave);
    p.completedRuns++;
    p.claimedRuns.push(result.runId);
    return {profile:p,receipt};
  }
  return {
    xpToNext(level) {
      if (!Number.isSafeInteger(level)||level<1) throw new RangeError('Invalid level');
      return a+b*level+c*level*level;
    },
    buy(profile,nodeId) {
      const n = config.knowledge.find(k=>k.id===nodeId);
      if (!n) return fail(profile,'unknown-node');
      const p=normalize(profile);
      if (p.knowledgeUnlocked.includes(nodeId)) return fail(profile,'already-unlocked');
      if (n.requires.some(id=>!p.knowledgeUnlocked.includes(id))) return fail(profile,'prerequisites');
      if (p.level<n.minLevel) return fail(profile,'level');
      if (p.knowledgePoints<n.pointCost) return fail(profile,'points');
      const cost=p.knowledgePaid.includes(nodeId)?0:n.sealCost;
      if (!Number.isSafeInteger(cost)||cost<0||p.seals<cost) return fail(profile,'seals');
      p.seals-=cost; p.knowledgePoints-=n.pointCost;
      p.knowledgeUnlocked.push(nodeId); if (!p.knowledgePaid.includes(nodeId)) p.knowledgePaid.push(nodeId);
      return {profile:p,ok:true};
    },
    respec(profile) {
      const p=normalize(profile);
      const cost=p.respecCount<3?0:e.respecCost;
      if (p.seals<cost) return fail(profile,'seals');
      p.seals-=cost; p.respecCount++; p.knowledgeUnlocked=[]; p.knowledgePoints=earned(p.level);
      return {profile:p,ok:true};
    },
    reward(profile,result) { return rewardForRun(profile,result,profile.knowledgeUnlocked); },
    rewardForRun,
    applyKnowledge:apply,
    combineKnowledge(loadouts,modeId) {
      return knowledgeAllowed(config,modeId) ? selected(config,loadouts.flat()).map(n=>n.id) : [];
    },
    validateCatalog(nodes) { return validate(nodes,earned(e.maxRewardLevel)); },
  };
}
