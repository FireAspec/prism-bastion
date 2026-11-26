import type { GameState, Vec } from '../../contracts';

export const INTERPOLATION_MS = 125;
interface Frame { at: number; state: GameState }
const blend = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t });

/** Only visual positions are delayed; all discrete state is taken from the latest snapshot. */
export class SnapshotBuffer {
  private frames: Frame[] = [];
  private seq = -1;
  private eventId = -1;
  clear(): void { this.frames = []; this.seq = this.eventId = -1; }
  resetInterpolation(): void { this.frames = this.frames.slice(-1); }
  latest(): GameState | null { return this.frames.at(-1)?.state ?? null; }
  accept(seq: number, state: GameState, at: number): boolean {
    const last = this.latest();
    if (!Number.isSafeInteger(seq) || seq < 0 || seq <= this.seq ||
      (last && (last.options.runId !== state.options.runId || state.tick < last.tick))) return false;
    this.seq = seq;
    this.frames.push({at: Math.max(at, this.frames.at(-1)?.at ?? at), state});
    while (this.frames.length > 2 && (this.frames[1].at < at-500 || this.frames.length > 16)) this.frames.shift();
    return true;
  }
  events<T extends {id:number}>(events: T[]): T[] {
    const fresh: T[] = [];
    for (const event of [...events].sort((a,b)=>a.id-b.id)) {
      if (event.id > this.eventId) { this.eventId = event.id; fresh.push(event); }
    }
    return fresh;
  }
  sample(now: number): GameState | null {
    const latest = this.latest();
    if (!latest) return null;
    const target = now - INTERPOLATION_MS;
    let a = this.frames[0], b = a;
    for (const frame of this.frames) {
      b = frame;
      if (frame.at >= target) break;
      a = frame;
    }
    const t = a === b || b.at === a.at ? 1 : Math.max(0, Math.min(1,(target-a.at)/(b.at-a.at)));
    const result = structuredClone(latest);
    if (latest.paused || latest.phase !== 'wave') return result;
    function positions<T extends {id:string;pos:Vec}>(current:T[], older:T[], newer:T[]): void {
      const left = new Map(older.map(e=>[e.id,e])), right = new Map(newer.map(e=>[e.id,e]));
      for (const e of current) {
        const p=left.get(e.id), q=right.get(e.id);
        if (p && q) e.pos = blend(p.pos,q.pos,t);
      }
    }
    positions(result.enemies,a.state.enemies,b.state.enemies);
    positions(result.projectiles,a.state.projectiles,b.state.projectiles);
    return result;
  }
}
