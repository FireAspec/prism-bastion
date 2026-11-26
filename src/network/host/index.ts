import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import { PROTOCOL_VERSION } from '../../contracts';
import type {
  ClientMessage, CommandResult, GameAction, GameEngine, GameEvent, GameState,
  HostOptions, PlayerInfo, RoomState, RunOptions, RunResult, ServerMessage,
} from '../../contracts';
import type { HostDependencies, HostHandle } from '../../contracts/coop';
import { parseClient, encode } from '../protocol';

const INPUT_BYTES = 16 * 1024;
const SNAPSHOT_BYTES = 2 * 1024 * 1024;
const EVENT_LIMIT = 256;
const RESUME_MS = 120_000;
const ABANDON_MS = 30_000;
const JOIN_MS = 5_000;
const HEARTBEAT_MS = 15_000;
const COLORS = ['#f4be62', '#55bdda', '#9de18a', '#c4a4f4'];
const fail = (reason: string): CommandResult => ({ ok: false, reason });
const digest = (value: string) => createHash('sha256').update(value).digest();
const token = () => randomBytes(32).toString('hex');
const loopback = (address?: string) =>
  address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';

interface Peer {
  socket: WebSocket;
  local: boolean;
  slot?: Slot;
  joinedBy: number;
  alive: boolean;
  sent: number;
  traffic: number[];
}
interface Slot {
  player: PlayerInfo;
  token: string;
  peer?: Peer;
  disconnectedAt?: number;
  seq: number;
  commands: number[];
  knowledge: string[];
  completedOnline: number;
  result?: RunResult;
}
export interface OwnershipChange {
  from: string; to: string; at: number;
}
/** Local application-only extensions; no corresponding network commands. */
export interface LocalHostHandle extends HostHandle {
  snapshot(): GameState | null;
  claimAbandoned(playerId: string): CommandResult;
  ownershipChanges(): OwnershipChange[];
}

function takeRate(entries: number[], now: number, max: number): boolean {
  while (entries.length && entries[0] <= now - 1000) entries.shift();
  if (entries.length >= max) return false;
  entries.push(now);
  return true;
}

function lanAddress(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return '127.0.0.1';
}

function rawText(raw: RawData): string {
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  return Buffer.from(raw as ArrayBuffer).toString('utf8');
}

export async function startHost(
  options: HostOptions, run: RunOptions, dependencies: HostDependencies,
): Promise<LocalHostHandle> {
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535 ||
      ![2, 3, 4].includes(options.maxPlayers) ||
      typeof options.name !== 'string' || !options.name.trim() || options.name.length > 24 ||
      typeof options.password !== 'string' || Buffer.byteLength(options.password) > 1024) {
    throw new Error('Invalid hosting options');
  }
  const config = dependencies.config;
  if (config.version !== 1 || !config.contentDigest) throw new Error('Invalid content version');
  const mode = config.modes.find(m => m.id === run.modeId);
  if (!mode || !config.maps.some(m => m.id === run.mapId) ||
      !config.difficulties.some(d => d.id === run.difficulty)) throw new Error('Invalid run options');

  const baseRun = structuredClone(run);
  const known = new Set(config.knowledge.map(n => n.id));
  const towerIds = new Set(config.towers.map(t => t.id));
  const cleanKnowledge = (ids: string[]) => Array.from(new Set(ids.filter(id => known.has(id)))).sort();
  const knowledgeAllowed = run.modeId !== 'iron-oath' && mode.modifiers.allowKnowledge !== false;
  const passwordHash = digest(options.password);
  const roomId = randomUUID();
  const hostId = baseRun.players[0]?.id || randomUUID();
  const slots = new Map<string, Slot>();
  const peers = new Set<Peer>();
  const ready = new Set<string>();
  const audit: OwnershipChange[] = [];
  const maxPlayers = options.maxPlayers;
  const roomName = options.name;
  let engine: GameEngine | undefined;
  let frozenRun: RunOptions | undefined;
  let finalState: GameState | null = null;
  let stopping: Promise<void> | undefined;
  let closing = false;
  let snapshotSeq = 0;
  let completedWaves = 0;
  let lastWaveEvent = -1;
  let resultIssued = false;
  let events: GameEvent[] = [];
  let clock: ReturnType<typeof setInterval> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const room = (): RoomState => {
    const players = Array.from(slots.values(), s => ({ ...s.player }));
    const knowledge = knowledgeAllowed
      ? cleanKnowledge(Array.from(slots.values()).flatMap(s => s.knowledge)) : [];
    return {
      id: roomId, name: roomName, hostId, players, ready: [...ready],
      started: engine !== undefined, protocolVersion: PROTOCOL_VERSION,
      contentDigest: config.contentDigest,
      options: { ...structuredClone(frozenRun ?? baseRun), players,
        knowledge: frozenRun ? [...frozenRun.knowledge] : knowledge,
        unlockedTowers: [...new Set(baseRun.unlockedTowers.filter(id => towerIds.has(id)))] },
    };
  };
  const server = new WebSocketServer({
    host: '0.0.0.0', port: options.port, maxPayload: INPUT_BYTES,
    perMessageDeflate: false, clientTracking: true,
  });

  function sendRaw(peer: Peer, payload: string, snapshot = false): boolean {
    const ws = peer.socket;
    if (ws.readyState !== WebSocket.OPEN) return false;
    if (snapshot && (peer.sent > 0 || ws.bufferedAmount > 0)) return false;
    if (ws.bufferedAmount + Buffer.byteLength(payload) > SNAPSHOT_BYTES + INPUT_BYTES) {
      ws.terminate();
      return false;
    }
    peer.sent++;
    try {
      ws.send(payload, error => {
        peer.sent--;
        if (error) ws.terminate();
      });
      return true;
    } catch {
      peer.sent--;
      ws.terminate();
      return false;
    }
  }
  function send(peer: Peer, message: ServerMessage): boolean {
    return sendRaw(peer, encode(message));
  }
  function broadcast(message: ServerMessage): void {
    const payload = encode(message);
    for (const slot of slots.values()) if (slot.peer) sendRaw(slot.peer, payload);
  }
  function broadcastRoom(): void { broadcast({ type: 'room', room: room() }); }
  function reject(peer: Peer, code: string, message: string, disconnect = false): void {
    send(peer, { type: 'error', code, message });
    if (disconnect) peer.socket.close(1008, code);
  }
  function snapshot(): GameState | null {
    if (!engine) return null;
    const state = engine.getSnapshot();
    // The engine owns all gameplay values; connection flags are presentation only.
    state.options.players = Array.from(slots.values(), s => ({ ...s.player }));
    state.events = [];
    return state;
  }
  function pushSnapshots(): void {
    const state = snapshot();
    if (!state) return;
    issueResult(state);
    const seq = ++snapshotSeq;
    let batch = events.splice(0);
    let payload: string;
    for (;;) {
      try {
        payload = encode({ type: 'snapshot', seq, state, events: batch });
        if (Buffer.byteLength(payload) <= SNAPSHOT_BYTES) break;
      } catch (error) {
        if (!batch.length) throw error;
      }
      if (!batch.length) throw new Error('Snapshot exceeds wire limit');
      batch = batch.slice(Math.ceil(batch.length / 2));
    }
    for (const slot of slots.values()) {
      if (slot.peer) sendRaw(slot.peer, payload, true);
    }
  }
  function allReady(): boolean {
    return slots.size >= 2 && Array.from(slots.values())
      .every(s => s.player.connected && ready.has(s.player.id));
  }
  function startRun(): void {
    if (engine) throw new Error('Already started');
    if (slots.size < 2 || Array.from(slots.values()).some(s => !s.player.connected)) {
      throw new Error('At least two connected players are required');
    }
    const options = room().options;
    // createEngine resolves player-count rules and applies capped knowledge once.
    const created = dependencies.createEngine(structuredClone(options));
    frozenRun = structuredClone(options);
    engine = created;
    ready.clear();
    broadcastRoom();
    collectEvents();
    pushSnapshots();
  }
  function collectEvents(): void {
    if (!engine) return;
    let terminal: 'victory' | 'defeat' | undefined;
    for (const event of engine.drainEvents()) {
      if (event.kind === 'waveStart' && ready.size) {
        ready.clear();
        broadcastRoom();
      }
      if (event.kind === 'victory' || event.kind === 'defeat') terminal = event.kind;
      if (event.kind === 'waveEnd' && event.id > lastWaveEvent) {
        lastWaveEvent = event.id;
        completedWaves++;
        for (const slot of slots.values()) if (slot.player.connected) slot.completedOnline++;
      }
      events.push(event);
      if (events.length > EVENT_LIMIT) events.shift();
    }
    if (terminal && !resultIssued) issueResult(engine.getSnapshot(), terminal);
  }
  function issueResult(state: GameState, terminal = state.phase): void {
    if (!resultIssued && (terminal === 'victory' || terminal === 'defeat')) {
      resultIssued = true;
      for (const slot of slots.values()) {
        const result: RunResult = {
          runId: state.options.runId, mapId: state.options.mapId,
          modeId: state.options.modeId, difficulty: state.options.difficulty,
          won: terminal === 'victory', wave: state.wave, rounds: state.rules.rounds,
          seed: state.options.seed, contentDigest: config.contentDigest,
          durationSeconds: state.time,
          // Roster is fixed before the first wave, so the early-presence condition holds.
          eligible: completedWaves > 0 && slot.completedOnline * 2 >= completedWaves,
        };
        slot.result = result;
        if (slot.peer) send(slot.peer, { type: 'runResult', result });
      }
    }
  }
  function command(slot: Slot, seq: number, action: GameAction): CommandResult {
    const withinRate = takeRate(slot.commands, performance.now(), 30);
    if (!Number.isSafeInteger(seq) || seq < 0 || seq <= slot.seq) {
      return fail(withinRate ? 'duplicate-seq' : 'rate-limit');
    }
    // Consume even rejected intentions; never let a replay become a later purchase.
    slot.seq = seq;
    if (!withinRate) return fail('rate-limit');
    if (!engine) return fail('not-started');
    const id = slot.player.id;
    if (action.type === 'pause' || action.type === 'speed' || action.type === 'autoStart') {
      if (id !== hostId) return fail('host-only');
    }
    if (action.type === 'startWave' && id !== hostId && !allReady()) return fail('not-ready');
    if (action.type === 'upgrade' || action.type === 'sell' ||
        action.type === 'target' || action.type === 'ability') {
      const tower = engine.getSnapshot().towers.find(t => t.id === action.tower);
      if (!tower) return fail('unknown-tower');
      if (tower.owner !== id) return fail('not-owner');
    }
    // The protocol accepts GameAction, not GameCommand. Never trust a wire actor.
    const result = engine.dispatch({ ...action, actor: id });
    if (result.ok && action.type === 'startWave') {
      ready.clear();
      broadcastRoom();
    }
    collectEvents();
    return result;
  }
  function join(peer: Peer, message: Extract<ClientMessage, { type: 'join' }>): void {
    if (peer.slot) return reject(peer, 'already-joined', 'Already joined', true);
    if (message.protocolVersion !== PROTOCOL_VERSION ||
        message.contentDigest !== config.contentDigest) {
      return reject(peer, 'incompatible', 'Protocol or content mismatch', true);
    }
    if (!timingSafeEqual(digest(message.password), passwordHash)) {
      return reject(peer, 'wrong-password', 'Incorrect room password', true);
    }
    let slot: Slot | undefined;
    if (message.resumeToken !== undefined) {
      slot = Array.from(slots.values()).find(s => s.token === message.resumeToken);
      if (!slot || slot.peer || slot.disconnectedAt === undefined ||
          performance.now() - slot.disconnectedAt >= RESUME_MS ||
          (slot.player.id === hostId && !peer.local)) {
        return reject(peer, 'invalid-resume', 'Resume slot unavailable', true);
      }
    } else {
      if (engine) return reject(peer, 'started', 'Only reconnect is allowed', true);
      const first = !slots.has(hostId);
      if (first && !peer.local) return reject(peer, 'host-not-ready', 'Host must join locally first', true);
      if (slots.size >= maxPlayers) return reject(peer, 'room-full', 'Room is full', true);
      const name = message.name.trim();
      if (!name || name.length > 24) return reject(peer, 'invalid-name', 'Invalid name', true);
      const usedColors = new Set(Array.from(slots.values(), s => s.player.color));
      slot = {
        player: { id: first ? hostId : randomUUID(), name,
          color: COLORS.find(c => !usedColors.has(c)) ?? COLORS[0], connected: true },
        token: token(), seq: -1, commands: [], completedOnline: 0,
        knowledge: knowledgeAllowed ? cleanKnowledge(first ? baseRun.knowledge : message.knowledge ?? []) : [],
      };
      slots.set(slot.player.id, slot);
    }
    slot.player.connected = true;
    slot.peer = peer;
    slot.disconnectedAt = undefined;
    peer.slot = slot;
    send(peer, { type: 'welcome', playerId: slot.player.id, resumeToken: slot.token, room: room() });
    broadcastRoom();
    if (engine) {
      // The next global snapshot includes the complete state; do not replay old events.
      if (slot.result) send(peer, { type: 'runResult', result: slot.result });
    }
  }
  function receive(peer: Peer, message: ClientMessage): void {
    if (message.type === 'join') return join(peer, message);
    if (!peer.slot) return reject(peer, 'join-required', 'Join the room first', true);
    const slot = peer.slot;
    if (slot.peer !== peer) return;
    switch (message.type) {
      case 'ping': send(peer, { type: 'pong', at: message.at }); break;
      case 'ready':
        if (message.value) ready.add(slot.player.id); else ready.delete(slot.player.id);
        broadcastRoom();
        break;
      case 'start':
        if (slot.player.id !== hostId) return reject(peer, 'host-only', 'Only host may start');
        if (engine) return reject(peer, 'started', 'Run already started');
        if (slots.size < 2 || Array.from(slots.values()).some(s => !s.player.connected)) {
          return reject(peer, 'not-ready', 'At least two connected players are required');
        }
        startRun();
        break;
      case 'command': {
        const result = command(slot, message.seq, message.command);
        send(peer, { type: 'result', seq: message.seq, result });
        break;
      }
    }
  }
  function drop(peer: Peer): void {
    peers.delete(peer);
    const slot = peer.slot;
    if (!slot || slot.peer !== peer) return;
    slot.peer = undefined;
    slot.player.connected = false;
    slot.disconnectedAt = performance.now();
    ready.delete(slot.player.id);
    if (!closing) broadcastRoom();
  }
  function sweep(now: number): void {
    for (const peer of peers) {
      if (!peer.slot && now >= peer.joinedBy) peer.socket.terminate();
    }
    if (!engine) {
      let changed = false;
      for (const [id, slot] of slots) {
        if (slot.disconnectedAt !== undefined && now - slot.disconnectedAt >= RESUME_MS) {
          slots.delete(id);
          ready.delete(id);
          changed = true;
        }
      }
      if (changed) broadcastRoom();
    }
  }
  function claimAbandoned(playerId: string): CommandResult {
    if (closing || !engine || playerId === hostId) return fail('invalid-claim');
    const slot = slots.get(playerId);
    if (!slot || slot.player.connected || slot.disconnectedAt === undefined ||
        performance.now() - slot.disconnectedAt < ABANDON_MS) return fail('not-abandoned');
    if (!engine.getSnapshot().towers.some(t => t.owner === playerId)) return fail('no-towers');
    const result = engine.reassignOwner(playerId, hostId);
    if (result.ok) {
      audit.push({ from: playerId, to: hostId, at: Date.now() });
      if (audit.length > 256) audit.shift();
      broadcastRoom();
    }
    return result;
  }
  function stop(reason = 'host-stopped'): Promise<void> {
    if (stopping) return stopping;
    closing = true;
    if (clock) clearInterval(clock);
    if (heartbeat) clearInterval(heartbeat);
    stopping = (async () => {
      try { finalState = snapshot(); } catch { finalState = null; }
      for (const peer of peers) {
        try {
          reject(peer, reason, reason === 'host-stopped' ? 'Host stopped the room' : 'Host simulation stopped');
        } catch { /* Closing must not depend on encoding. */ }
        peer.socket.close(1001, reason);
      }
      const force = setTimeout(() => {
        for (const peer of peers) peer.socket.terminate();
      }, 250);
      try {
        await new Promise<void>((resolve, rejectClose) => server.close(error => {
          if (error) rejectClose(error); else resolve();
        }));
      } finally { clearTimeout(force); peers.clear(); }
    })();
    return stopping;
  }
  function fatal(): void { void stop('host-failure').catch(() => undefined); }

  server.on('connection', (socket, request) => {
    if (closing || peers.size >= maxPlayers * 2 + 4) { socket.terminate(); return; }
    const peer: Peer = { socket, local: loopback(request.socket.remoteAddress),
      joinedBy: performance.now() + JOIN_MS, alive: true, sent: 0, traffic: [] };
    peers.add(peer);
    socket.on('error', () => socket.terminate());
    socket.on('pong', () => { peer.alive = true; });
    socket.on('close', () => {
      try { drop(peer); } catch { fatal(); }
    });
    socket.on('message', (raw, binary) => {
      if (closing) return;
      if (!takeRate(peer.traffic, performance.now(), 90)) { socket.close(1008, 'rate-limit'); return; }
      let message: ClientMessage;
      try {
        if (binary) throw new Error('Binary frame');
        message = parseClient(rawText(raw));
      } catch {
        try { reject(peer, 'invalid-message', 'Invalid client message', true); }
        catch { socket.terminate(); }
        return;
      }
      try { receive(peer, message); } catch { fatal(); }
    });
  });
  await new Promise<void>((resolve, rejectListen) => {
    const error = (err: Error) => { server.off('listening', listening); rejectListen(err); };
    const listening = () => { server.off('error', error); server.on('error', fatal); resolve(); };
    server.once('error', error);
    server.once('listening', listening);
  });

  let last = performance.now();
  let nextSnapshot = last + 100;
  clock = setInterval(() => {
    if (closing) return;
    try {
      const now = performance.now();
      const elapsed = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      sweep(now);
      if (engine) {
        engine.step(elapsed);
        collectEvents();
        if (now >= nextSnapshot) {
          nextSnapshot = now - (now - nextSnapshot) % 100 + 100;
          pushSnapshots();
        }
      }
    } catch { fatal(); }
  }, 1000 / 60);
  heartbeat = setInterval(() => {
    for (const peer of peers) {
      try {
        if (!peer.alive) { peer.socket.terminate(); continue; }
        peer.alive = false;
        if (peer.socket.readyState === WebSocket.OPEN) peer.socket.ping();
      } catch { peer.socket.terminate(); }
    }
  }, HEARTBEAT_MS);

  const address = lanAddress();
  const bound = server.address();
  if (!bound || typeof bound === 'string') { await stop(); throw new Error('No TCP port'); }
  return {
    address, port: bound.port, invite: 'ws://' + address + ':' + bound.port,
    room, stop: () => stop(),
    snapshot: () => closing ? (finalState && structuredClone(finalState)) : snapshot(),
    claimAbandoned, ownershipChanges: () => structuredClone(audit),
  };
}
