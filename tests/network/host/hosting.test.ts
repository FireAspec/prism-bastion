import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type {
  ClientMessage, GameCommand, GameConfig, GameEngine, GameEvent, GameState,
  HostOptions, RunOptions, ServerMessage, TowerState,
} from '../../../src/contracts';
import { startHost } from '../../../src/network/host';
import type { LocalHostHandle } from '../../../src/network/host';

// The protocol module is independently delivered. Exercise the real transport,
// host and command boundary with a local wire double, not the base stub.
vi.mock('../../../src/network/protocol', () => ({
  parseClient: (raw: string): ClientMessage => JSON.parse(raw) as ClientMessage,
  encode: (value: unknown) => JSON.stringify(value),
}));
const clock = vi.hoisted(() => ({ offset: 0 }));
vi.mock('node:perf_hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('node:perf_hooks')>();
  return { ...actual, performance: { now: () => actual.performance.now() + clock.offset } };
});

const config: GameConfig = {
  version: 1, contentVersion: 'test', contentDigest: 'fixture-digest',
  towers: [], enemies: [], waves: [], campaign: [],
  maps: [{
    id: 'test-map', name: 'Test', description: '', difficulty: 1, campaignIndex: 0,
    recommendedDifficulty: 'normal', waveOverrides: {}, lanes: [[{ x: 0, y: 0 }, { x: 100, y: 0 }]],
    pathWidth: 10, blocked: [], water: [], theme: 'garden', background: '',
  }],
  modes: [
    { id: 'standard', name: 'Standard', description: '', modifiers: {}, requiresClear: false },
    { id: 'iron-oath', name: 'Iron', description: '', modifiers: { allowKnowledge: false }, requiresClear: false },
  ],
  difficulties: [{
    id: 'normal', name: 'Normal', rounds: 2, lives: 10, startCredits: 100,
    towerCostMul: 1, enemyHpMul: 1, roundRewardBase: 0, roundRewardStep: 0, popCashMul: 1, rewardMul: 1,
  }],
  knowledge: ['a', 'b'].map((id, i) => ({
    id, branch: 'ballistics' as const, index: i + 1, name: id, description: '',
    requires: [], minLevel: 1, pointCost: 1 as const, sealCost: 1, effects: [], icon: '',
  })),
  economy: {
    xpCurve: [200, 40, 5], maxRewardLevel: 51, pointsPerLevel: 3,
    mapXP: [250, 400, 600, 900], mapSeals: [80, 120, 180, 260], modeReward: {},
    firstClearXP: 1.5, repeatXP: .65, repeatSeals: .35, defeatXP: .35, respecCost: 200,
  },
  knowledgeDiscount: 0, startCredits: 100, startLives: 10, sellRatio: .7,
};
const run: RunOptions = {
  mapId: 'test-map', difficulty: 'normal', seed: 7, endless: false, modeId: 'standard',
  unlockedTowers: [], players: [], runId: 'fixture-run', knowledge: ['a'],
};
const options: HostOptions = { port: 0, name: 'Test room', maxPlayers: 4, password: 'private' };
function fixture(options: RunOptions): GameEngine {
  const state: GameState = {
    version: 1, options: structuredClone(options), phase: 'build', time: 0,
    rules: {
      incomeMul: 1, startingCashMul: 1, enemyHpMul: 1, enemySpeedMul: 1, towerCostMul: 1,
      sellAllowed: true, maxLives: 10, allowAbilities: true, allowPassiveIncome: true, maxTowers: 60,
      maxTier: 5, weather: 'none', allowKnowledge: true, rounds: 2, roundRewardBase: 0,
      roundRewardStep: 0, popCashMul: 1,
    },
    tick: 0, rng: 7, nextEntity: 1, nextEvent: 1, credits: 100, lives: 10, wave: 0,
    waveTime: 0, spawnCursor: [], paused: false, speed: 1, autoStart: false,
    towers: [], enemies: [], events: [], projectiles: [], strikes: [],
    stats: { spent: 0, earned: 0, kills: 0, damage: 0, leaks: 0, abilities: 0, cashSubunits: 0 },
  };
  let paid = false;
  function event(kind: GameEvent['kind'], amount?: number): void {
    state.events.push({ id: state.nextEvent++, time: state.time, kind, amount });
  }
  return {
    getSnapshot: () => structuredClone(state),
    drainEvents: () => state.events.splice(0),
    dispatch(command: GameCommand) {
      if (command.type === 'place') {
        if (state.credits < 70) return { ok: false, reason: 'insufficient' };
        state.credits -= 70;
        const t: TowerState = {
          id: 't' + state.nextEntity++, defId: command.tower, owner: command.actor ?? '',
          pos: command.pos, tiers: [0, 0, 0], targeting: 'first', invested: 70, cooldown: 0,
          abilityCooldowns: {}, memory: {}, damageDealt: 0, kills: 0, generated: 0,
        };
        state.towers.push(t); event('place');
        if (command.tower === 'event-storm') {
          for (let i = 0; i < 1000; i++) event('hit');
        }
        return { ok: true, entity: t.id, amount: 70 };
      }
      if (command.type === 'pause') state.paused = command.value;
      if (command.type === 'speed') state.speed = command.value;
      if (command.type === 'autoStart') state.autoStart = command.value;
      if (command.type === 'startWave') {
        if (state.phase !== 'build') return { ok: false };
        state.phase = 'wave'; state.wave++; event('waveStart'); paid = false;
      }
      // Deliberately permissive about ownership: the host must reject foreign actions.
      if (command.type === 'sell') state.towers = state.towers.filter(t => t.id !== command.tower);
      return { ok: true };
    },
    step(dt) {
      if (state.paused) return;
      state.time += dt; state.tick++;
      if (state.phase === 'wave' && !paid) {
        paid = true; state.credits += 5; state.stats.earned += 5;
        event('layerBreak'); event('income', 5); event('waveEnd');
        state.phase = state.wave >= 2 ? 'victory' : 'build';
      }
    },
    reassignOwner(from, to) {
      for (const t of state.towers) if (t.owner === from) t.owner = to;
      return { ok: true };
    },
  };
}

type MessageType = ServerMessage['type'];
type Of<T extends MessageType> = Extract<ServerMessage, { type: T }>;
class Client {
  readonly messages: ServerMessage[] = [];
  readonly ws: WebSocket;
  constructor(port: number) {
    this.ws = new WebSocket('ws://127.0.0.1:' + port);
    this.ws.on('message', raw => this.messages.push(JSON.parse(raw.toString()) as ServerMessage));
    this.ws.on('error', () => undefined);
  }
  async open(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.ws.once('open', resolve); this.ws.once('error', reject);
    });
  }
  send(value: ClientMessage): void { this.ws.send(JSON.stringify(value)); }
  async wait<T extends MessageType>(type: T, predicate: (value: Of<T>) => boolean = () => true): Promise<Of<T>> {
    const start = Date.now();
    while (Date.now() - start < 3000) {
      const match = this.messages.find(m => m.type === type && predicate(m as Of<T>));
      if (match) return match as Of<T>;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for ' + type + ': ' + this.messages.map(m => m.type).join(','));
  }
  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise<void>(resolve => { this.ws.once('close', resolve); this.ws.terminate(); });
  }
  async cmd(seq: number, command: Extract<ClientMessage, { type: 'command' }>['command']) {
    const before = this.messages.length;
    this.send({ type: 'command', seq, command });
    const started = Date.now();
    while (Date.now() - started < 3000) {
      const result = this.messages.slice(before).find(m => m.type === 'result' && m.seq === seq);
      if (result?.type === 'result') return result.result;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('No command result');
  }
}
let host: LocalHostHandle | undefined;
const clients: Client[] = [];
async function setup(maxPlayers: 2 | 3 | 4 = 4, modeId = 'standard') {
  const createEngine = vi.fn(fixture);
  host = await startHost({ ...options, maxPlayers }, { ...run, modeId }, { config, createEngine });
  return { host, createEngine };
}
async function connect(port: number, changes: Partial<Extract<ClientMessage, { type: 'join' }>> = {}) {
  const c = new Client(port); clients.push(c); await c.open();
  c.send({ type: 'join', protocolVersion: 1, contentDigest: config.contentDigest,
    name: 'Player', password: options.password, knowledge: ['a', 'b', 'b', 'unknown'], ...changes });
  return c;
}
async function player(port: number, changes: Partial<Extract<ClientMessage, { type: 'join' }>> = {}) {
  const c = await connect(port, changes);
  return { c, welcome: await c.wait('welcome') };
}
async function launch(c: Client) {
  c.send({ type: 'start' }); await c.wait('room', m => m.room.started);
}
const place = { type: 'place' as const, tower: 'needle', pos: { x: 50, y: 50 } };

afterEach(async () => {
  vi.restoreAllMocks();
  await host?.stop(); host = undefined;
  await Promise.all(clients.splice(0).map(c => c.close()));
  clock.offset = 0;
});

describe('authoritative host', () => {
  it('serializes two simultaneous purchases and rejects replay and foreign commands', async () => {
    const { host, createEngine } = await setup(2);
    const a = await player(host.port), b = await player(host.port);
    await launch(a.c);
    expect(createEngine).toHaveBeenCalledTimes(1);
    expect(createEngine.mock.calls[0][0].players).toHaveLength(2);
    expect(createEngine.mock.calls[0][0].knowledge).toEqual(['a', 'b']);
    const result = await Promise.all([a.c.cmd(1, place), b.c.cmd(1, place)]);
    expect(result.filter(r => r.ok)).toHaveLength(1);
    expect(host.snapshot()?.credits).toBe(30);
    const tower = host.snapshot()!.towers[0];
    const loser = tower.owner === a.welcome.playerId ? b : a;
    const winner = loser === a ? b : a;
    expect((await winner.c.cmd(1, place)).reason).toBe('duplicate-seq');
    expect((await loser.c.cmd(2, { type: 'sell', tower: tower.id })).reason).toBe('not-owner');
    expect((await loser.c.cmd(3, { type: 'upgrade', tower: tower.id, path: 0 })).reason).toBe('not-owner');
    expect((await loser.c.cmd(4, { type: 'target', tower: tower.id, targeting: 'near' })).reason).toBe('not-owner');
    expect((await loser.c.cmd(5, { type: 'ability', tower: tower.id, ability: 'x' })).reason).toBe('not-owner');
    expect((await b.c.cmd(10, { type: 'speed', value: 3 })).reason).toBe('host-only');
    expect((await b.c.cmd(11, { type: 'pause', value: true })).reason).toBe('host-only');
    expect((await b.c.cmd(12, { type: 'startWave' })).reason).toBe('not-ready');
    expect(host.snapshot()?.towers).toHaveLength(1);
  });

  it('fixes four slots, rejects wrong credentials and a fifth or late join', async () => {
    const { host, createEngine } = await setup();
    const bad = await connect(host.port, { password: 'wrong' });
    expect((await bad.wait('error')).code).toBe('wrong-password');
    const wrong = await connect(host.port, { contentDigest: 'wrong' });
    expect((await wrong.wait('error')).code).toBe('incompatible');
    const a = await player(host.port);
    const b = await player(host.port), c = await player(host.port), d = await player(host.port);
    expect(new Set([a, b, c, d].map(p => p.welcome.playerId)).size).toBe(4);
    const extra = await connect(host.port);
    expect((await extra.wait('error')).code).toBe('room-full');
    b.c.send({ type: 'start' });
    expect((await b.c.wait('error')).code).toBe('host-only');
    await launch(a.c);
    expect(createEngine.mock.calls[0][0].players).toHaveLength(4);
    const late = await connect(host.port);
    expect((await late.wait('error')).code).toBe('started');
    for (const p of [a, b, c, d]) {
      const snap = await p.c.wait('snapshot');
      expect(snap.state.options.players).toHaveLength(4);
    }
  });

  it('preserves the owner and seq on reconnect, then permits a local claim after 30 seconds', async () => {
    const { host } = await setup();
    const a = await player(host.port), b = await player(host.port);
    await launch(a.c);
    const forged = { ...place, actor: a.welcome.playerId };
    expect((await b.c.cmd(1, forged)).ok).toBe(true);
    expect(host.snapshot()?.towers[0].owner).toBe(b.welcome.playerId);
    await b.c.close();
    await a.c.wait('room', m => m.room.players.some(p => p.id === b.welcome.playerId && !p.connected));
    expect(host.claimAbandoned(b.welcome.playerId).ok).toBe(false);
    const resumed = await player(host.port, { resumeToken: b.welcome.resumeToken });
    expect(resumed.welcome.playerId).toBe(b.welcome.playerId);
    expect((await resumed.c.cmd(1, place)).reason).toBe('duplicate-seq');
    expect(host.snapshot()?.towers[0].owner).toBe(b.welcome.playerId);
    await resumed.c.close();
    await vi.waitFor(() => expect(host.room().players.find(p => p.id === b.welcome.playerId)?.connected).toBe(false));
    clock.offset += 31_000;
    expect(host.claimAbandoned(b.welcome.playerId).ok).toBe(true);
    expect(host.snapshot()?.towers[0].owner).toBe(a.welcome.playerId);
    expect(host.ownershipChanges()).toHaveLength(1);
    expect(host.claimAbandoned(b.welcome.playerId).ok).toBe(false);
    clock.offset += 90_000;
    const expired = await connect(host.port, { resumeToken: b.welcome.resumeToken });
    expect((await expired.wait('error')).code).toBe('invalid-resume');
  });

  it('uses all-ready for guest wave start; keeps one payment through reconnect', async () => {
    const { host } = await setup();
    const a = await player(host.port), b = await player(host.port);
    await launch(a.c);
    a.c.send({ type: 'ready', value: true }); b.c.send({ type: 'ready', value: true });
    await b.c.wait('room', m => m.room.ready.length === 2);
    expect((await b.c.cmd(1, { type: 'startWave' })).ok).toBe(true);
    await a.c.wait('snapshot', m => m.state.credits === 105);
    await b.c.close();
    await vi.waitFor(() => expect(host.room().players.find(p => p.id === b.welcome.playerId)?.connected).toBe(false));
    const resumed = await player(host.port, { resumeToken: b.welcome.resumeToken });
    await resumed.c.wait('snapshot', m => m.state.credits === 105);
    expect((await resumed.c.cmd(1, { type: 'startWave' })).reason).toBe('duplicate-seq');
    expect(host.snapshot()?.stats.earned).toBe(5);
    expect((await a.c.cmd(2, { type: 'startWave' })).ok).toBe(true);
    const result = await resumed.c.wait('runResult');
    expect(result.result).toMatchObject({ eligible: true, won: true, runId: run.runId });
    expect(host.snapshot()?.credits).toBe(110);
  });

  it('clears knowledge in iron-oath and limits commands to 30 per second', async () => {
    const { host, createEngine } = await setup(2, 'iron-oath');
    const a = await player(host.port), b = await player(host.port);
    await launch(a.c);
    expect(createEngine.mock.calls[0][0].knowledge).toEqual([]);
    // Send in one burst to avoid measuring the test runner's scheduling speed.
    for (let seq = 1; seq <= 31; seq++) b.c.send({ type: 'command', seq, command: place });
    const last = await b.c.wait('result', m => m.seq === 31);
    expect(last.result.reason).toBe('rate-limit');
    expect(host.snapshot()?.towers).toHaveLength(1);
  });

  it('drops snapshots under reported backpressure and sends fresh state on recovery', async () => {
    const { host } = await setup();
    const a = await player(host.port), b = await player(host.port);
    await launch(a.c);
    const before = await a.c.wait('snapshot');
    const get = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'bufferedAmount')!.get!;
    const spy = vi.spyOn(WebSocket.prototype, 'bufferedAmount', 'get').mockImplementation(function (this: WebSocket) {
      return this.url === '' ? 4096 : get.call(this);
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    const count = a.c.messages.filter(m => m.type === 'snapshot').length;
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(a.c.messages.filter(m => m.type === 'snapshot')).toHaveLength(count);
    spy.mockRestore();
    const next = await a.c.wait('snapshot', m => m.seq > before.seq + 2);
    expect(next.state.options.players).toHaveLength(2);
    await b.c.wait('snapshot', m => m.seq >= next.seq);
  });

  it('bounds event batches, increments snapshot seq and rejects binary or malformed input', async () => {
    const { host } = await setup();
    const a = await player(host.port); await player(host.port); await launch(a.c);
    const before = await a.c.wait('snapshot');
    expect((await a.c.cmd(1, { ...place, tower: 'event-storm' })).ok).toBe(true);
    const storm = await a.c.wait('snapshot', m => m.seq > before.seq && m.events.some(e => e.kind === 'hit'));
    expect(storm.events).toHaveLength(256);
    expect(new Set(storm.events.map(e => e.id)).size).toBe(256);
    expect(Buffer.byteLength(JSON.stringify(storm))).toBeLessThanOrEqual(2 * 1024 * 1024);
    const next = await a.c.wait('snapshot', m => m.seq > storm.seq);
    expect(next.events).toEqual([]);
    const malformed = new Client(host.port); clients.push(malformed); await malformed.open();
    malformed.ws.send('{');
    expect((await malformed.wait('error')).code).toBe('invalid-message');
    const binary = new Client(host.port); clients.push(binary); await binary.open();
    binary.ws.send(Buffer.from('binary'));
    expect((await binary.wait('error')).code).toBe('invalid-message');
    const oversized = new Client(host.port); clients.push(oversized); await oversized.open();
    const closed = new Promise<number>(resolve => oversized.ws.once('close', resolve));
    oversized.ws.send('x'.repeat(16 * 1024 + 1));
    expect(await closed).toBe(1009);
  });

  it('stops idempotently, exposes final state, and releases the TCP port', async () => {
    const { host } = await setup();
    const a = await player(host.port); await player(host.port); await launch(a.c);
    const first = host.stop(), second = host.stop();
    expect(first).toBe(second);
    await first;
    expect((await a.c.wait('error')).code).toBe('host-stopped');
    expect(host.snapshot()?.options.runId).toBe(run.runId);
    const replacement = await startHost({ ...options, port: host.port }, run, { config, createEngine: fixture });
    try { expect(replacement.port).toBe(host.port); } finally { await replacement.stop(); }
  });
});
