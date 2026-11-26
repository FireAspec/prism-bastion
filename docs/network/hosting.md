# Cooperative hosting

## Starting and stopping

The Node/Electron main process owns the host. The renderer must not import
the host module or receive Node privileges.

```ts
import { startHost } from '../../network/host';

const host = await startHost(
  { port: 43127, name: 'Beacon room', maxPlayers: 4, password: roomPassword },
  runOptions,
  { config, createEngine: options => createEngineForRun(options) },
);
// Local host client connects to ws://127.0.0.1:<host.port>.
// Guests connect to host.invite or an explicitly selected LAN address.

// On explicit shutdown, stop the network and preserve the final snapshot.
await host.stop();
const state = host.snapshot();
if (state && (state.phase === 'build' || state.phase === 'wave')) {
  saveUnfinishedRun(state);
}
```

The example uses application-provided createEngineForRun and saveUnfinishedRun.
Port 0 asks the OS to allocate a port, useful in tests. The listener binds IPv4
on all interfaces; the invite uses the first non-loopback IPv4 interface.
For a different adapter (virtual LAN included), the application should offer
its addresses separately. The first new connection must be from loopback:
the application joins locally before exposing the invite. Subsequent local
connections are ordinary guests. No remote client can reserve the owner slot.
There is no host migration or automatic NAT traversal.

The returned LocalHostHandle is structurally compatible with HostHandle v1.
Its additional methods are trusted-process methods, not renderer IPC or
new client messages:

- snapshot(): detached authoritative state, or null before start. After stop,
  returns the captured final state; events are transient and not persisted.
- claimAbandoned(playerId): transfers the disconnected player's existing
  towers to the host through GameEngine.reassignOwner after 30 seconds.
  No money is created or refunded. No arbitrary owner or recipient accepted.
- ownershipChanges(): detached bounded audit of the local transfers (from,
  to, epoch milliseconds). A room update and subsequent authoritative snapshot
  expose the change. The frozen RoomState has no ownership-event field.
- stop(): idempotent; clears timers, sends host-stopped and closes sockets,
  force-closes remaining connections after 250 ms, releases the TCP port.

Disk writes, normal profile rewards, campaign prerequisites and persistence
are owned by the application. The host supplies the state and run result;
it does not create a second save store or apply profile currency.

## Room and run

The password and content digest are checked before entry. Each slot has a
random 256-bit resume token, not broadcast in RoomState. The host slot
uses the first provided player ID if present, otherwise a random ID.
Other IDs are server-generated. Player count is 2–4 at start, limited by
maxPlayers. A disconnected lobby slot is reserved for 120 seconds, then
released; after start no slots can be added or replaced. Resuming requires
the correct password, digest and token, with no active competing connection.
The host slot always requires loopback, even on reconnect. The client must
retain its token and monotonically increasing command counter across
reconnect; protocol v1 does not negotiate a replacement counter.

Only the host may send start. At least two connected players are required.
Start is the explicit host override; it need not wait for lobby ready flags.
Once running, a guest may request startWave only if all roster members
are connected and ready; the host can override. Ready flags clear at
wave start or when a player disconnects. Pause, speed and autoStart are
host-only. Any player may place a legal tower; only its current owner
may sell, upgrade, target or activate it. No actor from the network is
trusted. Synchronous dispatch serializes purchases against one engine
wallet. Engine rules decide affordability, placement, global T5 slots,
upgrade legality, sale refund, waves, damage, paid layers and income.
The host never replays commands or directly awards combat credits.

At start, the room supplies a fixed player roster, the host's unlocked
tower set intersected with the catalog, and a sorted union of known
knowledge IDs. Duplicate and unknown IDs do not contribute. The host's
knowledge originates in the local run options, not its wire hello.
Iron-oath and modes with allowKnowledge=false use an empty set.
The createEngine dependency must apply progression caps and player-count
rules exactly once when constructing the engine, using these RunOptions.
The host must not reapply bonuses or alter the engine's effective config.
The contract does not accept a modified config in createEngine; the
application factory is the integration point for applyKnowledge and
resolveRules.

The roster is present before wave one. The host counts waveEnd events
once by increasing event ID, recording which players are connected.
A victory/defeat result is issued once per run and cached per slot for
reconnect; eligibility requires connection at least half of completed
waves. The application deduplicates profile claims by runId. The host
does not infer prerequisites from a guest's knowledge or grant persistent
tower unlocks. A resumed player sees current authoritative state, including
any tower transfer that occurred during disconnection.

## Transport bounds

The server uses the shared parseClient/encode protocol entry points.
Binary frames and malformed input are rejected; ws enforces a 16 KiB
inbound frame/message limit. The host handles at most 30 command attempts
per second per slot and bounds other messages to 90 per second per socket.
Sequence numbers are safe nonnegative integers and must strictly increase.
Rejected new sequence numbers are consumed, including rate-limited
commands, so resending them cannot become a successful purchase.
Unauthenticated connections are capped and expire after five seconds.
Ping/pong detects stalled connections. Password contents are never logged.
The room password is compared with a constant-time digest comparison.
Plain ws is not encrypted; use a trusted LAN or a trusted VPN.
This is not a public competitive server or a defence against a compromised
local host.

The simulation receives bounded elapsed real time from a monotonic clock;
the engine controls fixed-step simulation and speed. The host drains engine
events once, maintains at most 256 recent events, and distributes a common
snapshot roughly every 100 ms with an increasing sequence. The newest
events survive overflow. A payload must fit within 2 MiB; events are
trimmed before an oversized state is considered a fatal hosting error.
A blocked peer skips snapshots instead of queuing them, and excessive
buffering of reliable control messages terminates that peer. Events are
cosmetic delivery, not a second source of damage or currency; a missed
event does not alter simulation. All peers recover from a later full
snapshot. No replay buffer grows indefinitely.

## Verification

Run the isolated host suite after installing the repository dependencies:

```sh
npm ci
npx vitest run tests/network/host/hosting.test.ts
npm run check
```

The suite uses real ws clients on localhost (two and four), with isolated
engine and wire codec doubles. It checks shared-wallet contention,
duplicate sequence, spoofed actor, forbidden owner actions and global
controls, room limits, digest/password, reconnect and expiry, local
abandonment transfer, readiness, fixture layer income, iron-oath knowledge,
command rate, simulated socket backpressure, event bounds, invalid frames
and shutdown/port reuse. The clock offset simulates the 30/120-second
windows without waiting. The protocol double deliberately allows a forged
actor in one test to check the host's own actor substitution.

The base commit's protocol and engine are placeholders. The suite verifies
host behavior, not the production protocol's schema or combat's actual
layer-payment and T5 algorithms. Integration must run the real protocol,
engine, progression factory and application save path, including a real
remote LAN client and maximum-size state. A real guest/client must preserve
the sequence counter across reconnect. Actual network pressure is covered
by a deterministic buffer simulation in the suite, not a throttled
external-network benchmark.
