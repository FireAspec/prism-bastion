import type {GameConfig, KnowledgeNode, KnowledgeStat, TowerDef, AttackDef, StatusSpec, EffectDef, AbilityDef} from '../contracts';

export const caps: Readonly<Record<KnowledgeStat, number>> = Object.freeze({
  weaponDamage:.15, weaponSpeed:.12, weaponRange:.10, elementDamage:.15,
  statusDuration:.15, shieldDamage:.20, supportRadius:.12, abilityCooldown:.12,
  controlDuration:.10, startingCash:.10, passiveIncome:.15, purchaseDiscount:.08,
  lives:20, bossDamage:.12, revealRadius:.15, xpGain:.10, sealGain:.10,
  waterDamage:.15, waterRange:.10,
});
const globalStats = new Set<KnowledgeStat>(['startingCash','purchaseDiscount','lives','xpGain','sealGain']);
export function knowledgeAllowed(config: GameConfig, modeId: string): boolean {
  return modeId !== 'iron-oath' && config.modes.some(m => m.id === modeId && m.modifiers.allowKnowledge !== false);
}
export function selected(config: GameConfig, ids: readonly string[]): KnowledgeNode[] {
  const wanted = new Set(ids);
  return config.knowledge.filter(n => wanted.delete(n.id));
}
export function bonus(nodes: KnowledgeNode[], stat: KnowledgeStat, tower?: string): number {
  let sum = 0;
  for (const n of nodes) for (const e of n.effects) {
    if (e.stat === stat && Number.isFinite(e.value) && e.value > 0 &&
        (!e.towers || (tower !== undefined && e.towers.includes(tower)))) sum += e.value;
  }
  return Math.min(caps[stat], sum);
}
// GameConfig contains an optional function; preserve it, while copying every data object.
export function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,clone(v)])) as T;
  }
  return value;
}
function enhanceTower(t: TowerDef, nodes: KnowledgeNode[], passive: boolean): void {
  const b = (s: KnowledgeStat) => bonus(nodes,s,t.id);
  const weapon = t.category === 'weapon' || t.category === 'tech';
  const damage = 1 + (weapon ? b('weaponDamage') : t.category === 'element' ? b('elementDamage') : t.category === 'water' ? b('waterDamage') : 0);
  const range = 1 + (weapon ? b('weaponRange') : t.category === 'water' ? b('waterRange') : 0);
  const status = (s: StatusSpec) => {
    const stat = s.kind === 'freeze' || s.kind === 'stun' ? 'controlDuration' : s.kind === 'shred' ? undefined : 'statusDuration';
    if (stat) s.duration *= 1 + b(stat);
  };
  const attack = (a: AttackDef) => {
    a.damage *= damage;
    if (weapon) a.interval = Math.max(.05, a.interval / (1+b('weaponSpeed')));
    a.range *= range;
    a.shieldMultiplier *= 1+b('shieldDamage');
    a.bossMultiplier *= 1+b('bossDamage');
    a.statuses.forEach(status);
  };
  const effect = (e: EffectDef) => {
    if (e.kind === 'aura') {
      e.radius *= (1+b('supportRadius')) * (e.stat === 'detect' ? 1+b('revealRadius') : 1);
    }
    if (passive && ['income','interest','harvest'].includes(e.kind)) {
      e.power *= 1+b('passiveIncome');
      if (e.cap > 0) e.cap *= 1+b('passiveIncome');
    }
    if (e.kind === 'deathBurst') e.power *= damage;
    if (e.status) status(e.status);
  };
  const ability = (a: AbilityDef) => {
    a.cooldown *= 1-b('abilityCooldown');
    if (a.kind === 'nova' || a.kind === 'meteor') a.power *= damage;
  };
  attack(t.attack); t.effects.forEach(effect); t.abilities.forEach(ability);
  for (const path of t.paths) for (const u of path.upgrades) {
    if (u.replaceAttack) attack(u.replaceAttack);
    u.addStatuses?.forEach(status); u.effects?.forEach(effect); u.abilities?.forEach(ability);
  }
}
const sourceConfigs = new WeakMap<GameConfig, GameConfig>();
export function apply(config: GameConfig, ids: string[], modeId: string): GameConfig {
  config = sourceConfigs.get(config) ?? config;
  const out = clone(config);
  sourceConfigs.set(out,config);
  out.knowledgeDiscount = 0;
  if (!knowledgeAllowed(config,modeId)) return out;
  const nodes = selected(config,ids);
  const rules = config.modes.find(m => m.id === modeId)!.modifiers;
  const passive = rules.allowPassiveIncome !== false;
  out.knowledgeDiscount = bonus(nodes,'purchaseDiscount');
  for (const d of out.difficulties) {
    d.startCredits = Math.floor(d.startCredits*(1+bonus(nodes,'startingCash')) + 1e-9);
    if (d.lives > 1 && rules.maxLives !== 1 && modeId !== 'no-leaks') d.lives += Math.floor(bonus(nodes,'lives'));
  }
  out.startCredits = Math.floor(out.startCredits*(1+bonus(nodes,'startingCash')) + 1e-9);
  if (out.startLives > 1 && rules.maxLives !== 1 && modeId !== 'no-leaks') out.startLives += Math.floor(bonus(nodes,'lives'));
  out.towers.forEach(t => enhanceTower(t,nodes,passive));
  return out;
}
export function validate(nodes: KnowledgeNode[], maxPoints: number): string[] {
  const errors: string[] = [];
  const byId = new Map<string, KnowledgeNode>();
  const positions = new Set<string>();
  for (const n of nodes) {
    if (!n.id.trim() || byId.has(n.id)) errors.push(`Invalid or duplicate ID: ${n.id}`);
    byId.set(n.id,n);
    const pos = `${n.branch}:${n.index}`;
    if (positions.has(pos)) errors.push(`Duplicate branch position: ${pos}`);
    positions.add(pos);
    if (!Number.isInteger(n.index) || n.index < 1 || n.index > 30 || !Number.isSafeInteger(n.minLevel) || n.minLevel < 1 ||
        n.pointCost !== 1 || !Number.isSafeInteger(n.sealCost) || n.sealCost < 0) errors.push(`Invalid requirements or cost: ${n.id}`);
    if (!n.effects.length) errors.push(`No effects: ${n.id}`);
    for (const e of n.effects) {
      if (!Object.hasOwn(caps,e.stat) || !Number.isFinite(e.value) || e.value <= 0 || e.value > caps[e.stat] ||
          (e.towers && (!e.towers.length || globalStats.has(e.stat)))) errors.push(`Invalid effect: ${n.id}/${e.stat}`);
    }
  }
  for (const n of nodes) {
    if (new Set(n.requires).size !== n.requires.length) errors.push(`Duplicate prerequisite: ${n.id}`);
    if (n.index > 1 && !n.requires.some(id => {
      const prev = byId.get(id); return prev?.branch === n.branch && prev.index === n.index-1;
    })) errors.push(`Missing previous branch node: ${n.id}`);
    const seen = new Set<string>(); const active = new Set<string>();
    function visit(id: string): void {
      if (active.has(id)) { errors.push(`Cycle reachable from ${n.id}: ${id}`); return; }
      if (seen.has(id)) return;
      const next = byId.get(id);
      if (!next) { errors.push(`Missing prerequisite ${id} for ${n.id}`); return; }
      seen.add(id); active.add(id); next.requires.forEach(visit); active.delete(id);
    }
    visit(n.id);
    if (seen.size > maxPoints) errors.push(`Unreachable within point budget: ${n.id}`);
  }
  return [...new Set(errors)];
}
