import type { EnemyState, GameConfig, GameEvent, GameState, RenderPreferences, StatusKind, Vec } from '../../contracts';
import type { EntityMotion, MotionSample } from '../../contracts/motion';
import { pointOnLane } from '../../contracts/geometry';

export type EnemyEffectKind = 'hit' | 'layerBreak' | 'shieldBreak' | 'kill' | 'leak' | 'bossPhase' | 'split';
export interface EnemyEffect { id: number; kind: EnemyEffectKind; target: string; pos: Vec; angle: number; age: number; duration: number; color: string; layer?: number; }
export interface EnemyTail { id: string; defId: string; pos: Vec; sample: MotionSample; }
export interface EnemyAppearance { layer: number; shield: boolean; statuses: readonly StatusKind[]; phase: number; color: string; }
export interface EnemyMotion extends EntityMotion {
  reset(state: GameState): void;
  setPreferences(value: RenderPreferences): void;
  effects(): EnemyEffect[];
  tails(): EnemyTail[];
  appearance(id: string): EnemyAppearance | undefined;
}
const profiles = {
  scarlet: ['roll', 2.5, 3, '#e95b62'], amber: ['roll', 3.4, 3, '#e6a13c'], lemon: ['hover', 7, 4, '#e7de65'],
  jade: ['heavy', 1.8, 2, '#60b98a'], azure: ['roll', 3.8, 3, '#5bb8df'], violet: ['hover', 2.7, 3, '#aa84df'],
  iron: ['heavy', 1.6, 1, '#a4b7c0'], glass: ['hover', 4, 3, '#a8e5e8'], cloak: ['hover', 2.9, 3, '#8c86b0'],
  regrow: ['pulse', 2, 2, '#8ed49a'], shield: ['heavy', 2, 1, '#83d9e7'], split: ['pulse', 2.8, 2, '#ed9d6a'],
  ruby: ['heavy', 2, 2, '#dc5474'], glacier: ['hover', 1.7, 2, '#b3e9ff'], copper: ['roll', 2.2, 2, '#c58351'],
  obsidian: ['heavy', 1.2, 1, '#827d9f'], dart: ['hover', 6, 5, '#e6c96a'], swarm: ['hover', 8, 3, '#e5b1ea'],
  aegis: ['heavy', 1.4, 1, '#7da7dd'], royal: ['pulse', 1.7, 2, '#d8b45b'], hollow: ['hover', 4, 3, '#c1a6da'],
  prismatic: ['pulse', 1.9, 2, '#e4b3df'], juggernaut: ['heavy', 0.9, 1, '#b4a096'], herald: ['pulse', 1.2, 2, '#dfb16b'],
  'boss-carapace': ['heavy', 0.8, 1, '#bfb59a'], 'boss-brood': ['pulse', 1.1, 2, '#e2a2a4'], 'boss-mirror': ['pulse', 0.9, 1, '#b3dce8'],
  'boss-chrono': ['heavy', 1.2, 1, '#d7bf79'], 'boss-tempest': ['pulse', 1.0, 2, '#8bc6e5'], 'boss-eclipse': ['heavy', 0.7, 1, '#d2a9dc'],
} as const;
export const ENEMY_MOTION_IDS = Object.keys(profiles);
type Profile = (typeof profiles)[keyof typeof profiles];
const profile = (id: string): Profile => Object.hasOwn(profiles, id) ? profiles[id as keyof typeof profiles] : profiles.scarlet;
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const zero = (): MotionSample => ({ offset: { x: 0, y: 0 }, scale: 1, rotation: 0, glow: 0, opacity: 1 });
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const finitePos = (p?: Vec): p is Vec => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const hash = (s: string) => { let n = 2166136261; for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967296; };
const duration: Record<EnemyEffectKind, number> = { hit: .18, layerBreak: .42, shieldBreak: .48, kill: .35, leak: .38, bossPhase: .9, split: .4 };
interface Track { enemy: EnemyState; angle: number; targetAngle: number; cycle: number; spawn: number; hit: number; hitAngle: number; phasePulse: number; gone: number; terminal?: 'kill' | 'leak'; phase: number; broken: Set<number>; }

export function createEnemyMotion(config?: Pick<GameConfig, 'enemies' | 'maps'>): EnemyMotion {
  const defs = new Map(config?.enemies.map(d => [d.id, d]));
  const maps = new Map(config?.maps.map(m => [m.id, m]));
  const tracks = new Map<string, Track>();
  let particles: (EnemyEffect & { born: number })[] = [], clock = 0, lastEvent = -1, run: string | undefined, tick = -1, disposed = false;
  let prefs: RenderPreferences = { reducedMotion: false, quality: 'high', colorblind: false };
  const limit = () => prefs.quality === 'low' ? 64 : 192;
  const tailLimit = () => prefs.quality === 'low' ? 40 : 120;
  const clone = (e: EnemyState): EnemyState => ({ ...e, pos: { ...e.pos }, statuses: e.statuses.map(s => ({ ...s })), memory: { ...e.memory }, paidLayers: [...e.paidLayers] });
  function heading(e: EnemyState, s: GameState, t?: Track): number {
    const lane = maps.get(s.options.mapId)?.lanes[e.lane];
    if (lane && lane.length > 1) {
      const a = pointOnLane(lane, Math.max(0, e.progress - 3)), b = pointOnLane(lane, e.progress + 8);
      if (Math.hypot(b.x - a.x, b.y - a.y) > .01) return Math.atan2(b.y - a.y, b.x - a.x);
    }
    if (t && t.enemy.lane === e.lane && e.progress > t.enemy.progress) {
      const dx = e.pos.x - t.enemy.pos.x, dy = e.pos.y - t.enemy.pos.y, length = Math.hypot(dx, dy);
      if (length > .01 && length <= 100) return Math.atan2(dy, dx);
    }
    return t?.targetAngle ?? 0;
  }
  function add(e: EnemyState, s: GameState, baseline = false): Track {
    const angle = heading(e, s);
    const t: Track = { enemy: clone(e), angle, targetAngle: angle, cycle: hash(e.id) * Math.PI * 2, spawn: -Infinity, hit: -Infinity, hitAngle: 0, phasePulse: -Infinity, gone: Infinity, phase: 0, broken: new Set(baseline ? e.paidLayers : []) };
    tracks.set(e.id, t); return t;
  }
  function reset(s: GameState) {
    if (disposed) return;
    tracks.clear(); particles = []; clock = s.time; run = s.options.runId; tick = s.tick; lastEvent = s.nextEvent - 1;
    for (const e of s.enemies) add(e, s, true);
  }
  function sync(s: GameState): boolean {
    if (disposed) return false;
    if (run !== s.options.runId) { reset(s); return false; }
    if (s.tick < tick) return false;
    clock = Math.max(clock, s.time); tick = s.tick;
    particles = particles.filter(p => clock - p.born < p.duration);
    const live = new Set<string>();
    for (const e of s.enemies) {
      live.add(e.id); const t = tracks.get(e.id);
      if (!t || t.terminal) { add(e, s); continue; }
      for (const layer of t.enemy.paidLayers) t.broken.add(layer);
      t.targetAngle = heading(e, s, t); t.enemy = clone(e); t.gone = Infinity;
    }
    for (const [id, t] of tracks) if (!live.has(id) && !Number.isFinite(t.gone)) t.gone = clock;
    return true;
  }
  function push(event: GameEvent, kind: EnemyEffectKind, t: Track | undefined, angle: number, time: number) {
    if (!finitePos(event.pos) || !event.target) return;
    const d = duration[kind], age = Math.max(0, clock - time);
    if (age >= d) return;
    const def = t && defs.get(t.enemy.defId);
    const color = (kind === 'layerBreak' && event.layer !== undefined ? def?.layers[event.layer]?.color : undefined) ?? (t ? profile(t.enemy.defId)[3] : '#d9edf1');
    if (particles.length >= limit()) particles.shift();
    particles.push({ id: event.id, kind, target: event.target, pos: { ...event.pos }, angle, age, born: time, duration: d, color, layer: event.layer });
  }
  function trimTails() {
    const gone = [...tracks].filter(([, t]) => Number.isFinite(t.gone));
    for (let i = 0; i < gone.length - tailLimit(); i++) tracks.delete(gone[i][0]);
  }
  function consume(events: GameEvent[], s: GameState) {
    if (!sync(s)) return;
    for (const e of [...events].sort((a, b) => a.id - b.id)) {
      if (!Number.isSafeInteger(e.id) || e.id <= lastEvent || e.id >= s.nextEvent || !Number.isFinite(e.time)) continue;
      lastEvent = e.id;
      if (!e.target || e.time > s.time + .001 || clock - e.time > 1) continue;
      const t = tracks.get(e.target), time = e.time;
      const angle = t && finitePos(e.pos) && Math.hypot(e.pos.x - t.enemy.pos.x, e.pos.y - t.enemy.pos.y) > .01 ? Math.atan2(e.pos.y - t.enemy.pos.y, e.pos.x - t.enemy.pos.x) : hash(String(e.id)) * Math.PI * 2;
      switch (e.kind) {
        case 'spawn': if (t) t.spawn = time; break;
        case 'hit': if (t) { t.hit = time; t.hitAngle = angle; } push(e, 'hit', t, angle, time); break;
        case 'layerBreak':
          if (t && e.layer !== undefined) { if (t.broken.has(e.layer)) break; t.broken.add(e.layer); }
          push(e, 'layerBreak', t, angle, time); break;
        case 'shieldBreak': push(e, 'shieldBreak', t, angle, time); break;
        case 'bossPhase': if (t) { t.phase++; t.phasePulse = time; } push(e, 'bossPhase', t, angle, time); break;
        case 'kill': case 'leak':
          if (t && !t.terminal) { t.terminal = e.kind; t.gone = time; }
          push(e, e.kind, t, angle, time);
          if (e.kind === 'kill' && t && (defs.get(t.enemy.defId)?.children.length || ['glass','split','royal','prismatic'].includes(t.enemy.defId))) push(e, 'split', t, angle, time);
          break;
      }
    }
    trimTails();
  }
  function update(realSeconds: number, s: GameState) {
    const previous = clock;
    if (!sync(s)) return;
    const dt = s.paused ? 0 : clamp(Number.isFinite(realSeconds) ? realSeconds : 0, 0, .25) * s.speed;
    // A snapshot may advance farther than one local frame. Never advance twice.
    clock = Math.max(clock, previous + dt);
    particles = particles.filter(p => clock - p.born < p.duration);
    for (const [id, t] of tracks) {
      const p = profile(t.enemy.defId);
      t.angle += angleDelta(t.angle, t.targetAngle) * (1 - Math.exp(-12 * dt));
      const frozen = t.enemy.statuses.some(x => x.remaining > 0 && (x.kind === 'freeze' || x.kind === 'stun'));
      if (!frozen) t.cycle = (t.cycle + dt * p[1]) % (Math.PI * 2);
      if (clock - t.gone >= (t.terminal ? duration[t.terminal] : .12)) tracks.delete(id);
    }
    trimTails();
  }
  function sample(id: string): MotionSample {
    const t = tracks.get(id); if (!t) return zero();
    const p = profile(t.enemy.defId), reduced = prefs.reducedMotion, wave = Math.sin(t.cycle), active = t.enemy.statuses.filter(s => s.remaining > 0).map(s => s.kind);
    const spawn = clamp((clock - t.spawn) / .24), hit = 1 - clamp((clock - t.hit) / .18), phase = 1 - clamp((clock - t.phasePulse) / .9);
    const end = Number.isFinite(t.gone) ? clamp((clock - t.gone) / (t.terminal ? duration[t.terminal] : .12)) : 0;
    const frozen = active.includes('freeze') || active.includes('stun');
    const offset = reduced || frozen ? { x: 0, y: 0 } : { x: -Math.cos(t.hitAngle) * hit * 3, y: (p[0] === 'hover' ? -p[2] * (1 + wave) / 2 : 0) - Math.sin(t.hitAngle) * hit * 3 };
    return { offset, rotation: t.angle + (reduced || frozen ? 0 : p[0] === 'roll' ? wave * .24 : p[0] === 'heavy' ? wave * .055 : 0), scale: reduced ? 1 : (0.75 + .25 * spawn) * (1 + (p[0] === 'pulse' ? wave * .045 : 0) - hit * .06) * (1 - end * .2), opacity: (reduced ? 1 : spawn) * (1 - end), glow: clamp((reduced ? 0 : hit * .38 + phase * .28) + (active.length ? .12 : 0)) };
  }
  function appearance(id: string): EnemyAppearance | undefined {
    const t = tracks.get(id); if (!t) return undefined;
    const def = defs.get(t.enemy.defId), paid = new Set(t.enemy.paidLayers);
    // Paid shells stay removed even when HP regenerates. This is presentation only.
    let layer = 0; while (paid.has(layer) && layer < (def?.layers.length ?? 256)) layer++;
    const phase = def?.boss?.phases.filter(p => t.enemy.hp / Math.max(1, t.enemy.maxHp) <= p.atHealth).length ?? t.phase;
    return { layer, phase: Math.max(phase, t.phase), shield: t.enemy.shield > 0, statuses: [...new Set(t.enemy.statuses.filter(s => s.remaining > 0).map(s => s.kind))].sort(), color: def?.layers[layer]?.color ?? profile(t.enemy.defId)[3] };
  }
  return { reset, consume, update, sample, appearance, setReducedMotion(value) { prefs = { ...prefs, reducedMotion: value }; }, setPreferences(value) { prefs = { ...value }; particles = particles.slice(-limit()); trimTails(); }, effects: () => particles.map(({ born, ...p }) => ({ ...p, age: Math.max(0, clock - born), pos: { ...p.pos } })), tails: () => [...tracks].filter(([, t]) => Number.isFinite(t.gone)).slice(-tailLimit()).map(([id, t]) => ({ id, defId: t.enemy.defId, pos: { ...t.enemy.pos }, sample: sample(id) })), dispose() { disposed = true; tracks.clear(); particles = []; } };
}
