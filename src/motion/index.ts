import type { Timeline } from '../contracts/motion';
export { createDirector, createUIDirector, cueForEvent, cueForUI, sampleCue, GAME_CUES, UI_CUES, EXTRA_CUES, MAX_CUES, MAX_UI_CUES } from './director';
export type { Cue, CueSample, Director, ActiveCue, UIDirector, UIActiveCue } from './director';

export type Ease = NonNullable<Parameters<Timeline['value']>[4]>;
export const MAX_TRACKS = 4096;
export function easing(kind: Ease, fraction: number): number {
  if (!Number.isFinite(fraction)) throw new RangeError('Invalid easing fraction');
  const t = Math.max(0, Math.min(1, fraction));
  switch (kind) {
    case 'linear': return t;
    case 'outCubic': return 1 - (1 - t) ** 3;
    case 'inOutCubic': return t < .5 ? 4*t*t*t : 1 - (-2*t+2)**3/2;
    case 'outBack': return 1 + 2.70158*(t-1)**3 + 1.70158*(t-1)**2;
    default: throw new RangeError('Unknown easing');
  }
}

interface Track { from: number; start: number; requestedFrom: number; to: number; duration: number; ease: Ease }
export interface ManagedTimeline extends Timeline { readonly size: number; dispose(): void }
export function createTimeline(): ManagedTimeline {
  const tracks = new Map<string, Track>();
  let now = 0, disposed = false;
  const read = (track: Track): number => {
    const elapsed = now - track.start;
    if (track.duration === 0 || elapsed >= track.duration - 1e-12) return track.to;
    if (elapsed <= 0) return track.from;
    const p = easing(track.ease, elapsed / track.duration);
    return track.from * (1-p) + track.to*p;
  };
  return {
    get size() { return tracks.size; },
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(now+seconds)) throw new RangeError('Invalid timeline delta');
      if (!disposed) now += seconds;
    },
    value(key, from, to, duration, ease = 'linear') {
      if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(duration) || duration < 0 || !Number.isFinite((to-from)*3)) throw new RangeError('Invalid tween');
      easing(ease,0);
      if (disposed) return to;
      const old = tracks.get(key);
      if (old && old.requestedFrom === from && old.to === to && old.duration === duration && old.ease === ease) return read(old);
      if (!old && tracks.size >= MAX_TRACKS) {
        // Do not restart evicted completed tracks unpredictably: new overflow tracks snap.
        return to;
      }
      const startValue = old ? read(old) : from;
      const track = {from:startValue, start:now, requestedFrom:from,to,duration,ease};
      tracks.set(key, track);
      return read(track);
    },
    cancel(key) { tracks.delete(key); },
    clear() { tracks.clear(); now=0; },
    dispose() { tracks.clear(); disposed=true; now=0; },
  };
}
