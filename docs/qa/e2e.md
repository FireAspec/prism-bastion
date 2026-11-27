# E2E acceptance: browser, desktop and cooperative play

## Scope and current evidence

Base: `65ae156626cab219a9d8a6e7e6a63f8b4663d1f7`. This suite owns only
`tests/e2e/**`, `playwright.config.ts` and this document. The foundation
commit has explicit pending implementations for the host, engine, combat,
content, menus, persistence and progression. These are prerequisites, not
successful game tests.

Status definitions:

- **PASS:** the real test was executed and all assertions passed.
- **FAIL:** a test ran and an assertion, unexpected exception, startup,
  cleanup or timeout failed.
- **UNAVAILABLE:** a known prerequisite is missing, an explicit foundation
  stub remains, Windows is not the runner, or a reviewed visual baseline
  does not exist. The JSON report includes an unavailable annotation and
  the list reporter shows a skipped test. Set PB_E2E_REQUIRE_ALL=1 to turn
  every unavailable case into a failure for release gating.
- **NOT RUN:** no execution evidence. This is not PASS or a runtime FAIL.

At initial publication: repository paths and foundation stubs were
inspected; the branch was created from the specified base. The checkout
and dependency installation were unavailable in the execution environment,
so npm run check, Playwright, Windows builds, screenshots, WebSocket
game sessions and VPN sessions have **NOT RUN** status. No baseline or
screen capture is claimed or committed. Re-run after integration.

## Running

Node 22.12+ and the repository lockfile are required. From the integrated
checkout:

```sh
npm ci
npx playwright install chromium
npm run check
npm run test:e2e
npm run test:e2e -- --project=network
npm run test:e2e -- --project=1366x768
npm run test:e2e -- --project=1920x1080
```

Playwright's default server starts Vite at 127.0.0.1:41772 with strictPort.
It does not reuse another process. PB_E2E_URL permits an explicitly
managed **Vite dev** server, not a mock or production build lacking test
pages. Browser projects use separate contexts and native viewport sizes,
device scale factor 1. The network project needs no browser. Reports:
test-results/e2e-report.json and test-results/e2e/. Artifacts are
disposable; do not commit reports, traces, profiles or session tokens.

PowerShell Windows release-run example (after dependencies and build):

```powershell
npm run desktop:build
$env:PB_E2E_ELECTRON_ENTRY = "."
npm run test:e2e -- --project=windows-desktop
Remove-Item Env:PB_E2E_ELECTRON_ENTRY
```

PB_E2E_ELECTRON_EXE can select an installed Electron executable. Use
a development build with the real Electron main and preload. The
desktop test verifies the temporary profile path before touching the
UI. If the app overrides userData, the test fails safely; do not disable
sandbox, context isolation, navigation restrictions or web security.
Packaged installer and portable EXE still require manual smoke checks.

For release gating in PowerShell:

```powershell
$env:PB_E2E_REQUIRE_ALL = "1"
npm run test:e2e
Remove-Item Env:PB_E2E_REQUIRE_ALL
```

## Test inventory

| Scenario | Evidence asserted |
| --- | --- |
| 2 and 4 WS peers | unique player IDs/tokens, local host identity, real snapshots, start budget, identical shared wallet/lives/owners/tiers |
| Last-money race | spend actual place commands down to one affordable tower; two independent sockets race for different valid positions; exactly one accepted; no negative balance |
| Foreign actions | other player cannot sell, upgrade or change targeting; guest cannot pause |
| Sell and replay | floor(0.70 × invested) returned; duplicate seq rejected; ledger unchanged |
| Mismatch | incompatible digest rejected before welcome, socket closes |
| Reconnect | same player ID and ledger with resume token, connected flags, ping/pong |
| Host loss | explicit host process shutdown, peer close events, port no longer accepts connections; browser app exposes reconnect/loss message |
| Duplicate rewards | terminal RunResult over real WS, same result re-delivered after reconnect, real progression and save store reject second award |
| Browser lobby | normal app form, real outbound join frame, player appears on host, actual client wallet agrees with host, visible disconnect status |
| Campaign | exactly 20 unique map cards, first available/final locked on fresh profile, four difficulty choices; imported completed-campaign fixture opens every map and checkpoints its ID |
| Battle | actual pointer placement, first upgrade, credit change, keyboard speed, start/pause, exit/save/reload/resume, retained tower and run ID |
| Save | export/import round-trip, malformed JSON must not replace profile |
| Knowledge | 150 nodes in catalog; prerequisites, one paid purchase, reload and free respec preserve paid ID |
| Art | all 450 upgrade image files decode, unique keys/URLs, all 90 T5 files have different SHA-256 payloads |
| Visual | captures at 1366×768 and 1920×1080, T5 gallery pixel regression against reviewed baselines |
| Accessibility | keyboard focus/Enter, reduced-motion and colorblind settings, EN selection, reload persistence |
| Desktop | Windows native app, real preload and IPC room creation, real remote peer, shutdown and port cleanup |

The short terminal fixture in short-config.ts keeps the production
engine, combat, host, protocol, wallet, persistence and progression.
It explicitly reduces the normal run to one wave with one fast enemy.
This permits deterministic terminal/re-delivery testing without claiming
that a full normal campaign was completed. The short-run fixture is
not used for the purchase race. The campaign and knowledge UI fixtures
are imported by the application's real profile importer, in isolated
browser contexts; no network messages or app commands are intercepted.
All network transport is loopback WS between a separately launched
Node host process and independent client sockets. The browser guest
uses the production CoopClient, not an injected window.prismDesktop.

Host startup has a 15-second deadline, normal socket waits are bounded,
host shutdown has a 5-second deadline and forced kill is treated as
failure. The host listens on an OS-selected port in the Node harness,
with no hardcoded conflicting port. Windows uses an available port
and fails if another process wins the bind. The suite checks the port
after shutdown. A failed case can leave traces and screenshots for
debugging, but not a listening host intentionally.

## UI contracts and test hooks

Existing menu selectors: #menus [data-focus=campaign|map-ID|start|
difficulty-ID|back|settings|resume|knowledge|coop|export], with the
actual file input for profile import. Existing HUD selectors:
#hud [data-action=buy-ID|upgrade-ENTITY-PATH-TIER|start|pause|speed2|exit],
.pb-hud-credit, #game-canvas. Lobby uses real name/address/port/password
form inputs and submit; host room ready/back controls use data-focus.

Knowledge UI integration needs the following stable, non-privileged
selectors on real controls: knowledge-node-ID, knowledge-buy,
knowledge-close, knowledge-respec, knowledge-respec-confirm. These
are data-testid values, not command endpoints. Locked node controls
must expose disabled semantics for this acceptance. If a different
accessible DOM pattern is used, adapt the tests and document it.
Missing selector integration is explicitly unavailable until resolved.

Canvas placement assumes an aspect-preserving centered 1280×720
world; if the renderer uses a different viewport transform, expose the
read-only viewport geometry or equivalent testable DOM metadata, not
a privileged command dispatch. Do not add an API that grants credits,
changes ownership, forces victory, disables validation, bypasses
networking, or applies profile rewards outside the normal game.

The Vite-only gallery route is /tests/e2e/gallery.html?tier=5. It imports
the actual content and uses each upgrade's real asset path. It is not
an alternate game runtime. Tests verify decoded image dimensions and
unique content; byte inequality alone does not prove good art.
No game or desktop source needs to be changed by this module.

## Visual review

Capture tests attach actual PNG files only after navigation, assertions,
and (for the gallery) image decoding. At first successful execution,
inspect every T5 row, first and last map, 1366×768 HUD and menu, and
1920×1080 captures. Review outlines, transparent padding, distinctive
silhouettes, readable costs, clipped text, keyboard focus, color
indicators, and all six cross-path combinations in the renderer.
The gallery regression compares static T5 art, not attack animation.

After a human review, generate baselines explicitly:
```powershell
$env:PB_E2E_CREATE_BASELINES = "1"
npm run test:e2e -- --grep "T5 visual regression" --update-snapshots
Remove-Item Env:PB_E2E_CREATE_BASELINES
```
Review the generated files before committing them beneath tests/e2e.
Use the same OS, browser version, fonts and device scale for comparison.
No approved baseline means unavailable, not a pixel regression pass.
Native 4K, Windows DPI 100/150/200%, high/low quality, T5 attack/contact
at 1×/3× and reduced-motion visual behavior still need the renderer
and motion integration review; a settings checkbox test alone does
not certify animation accessibility.

## Manual LAN/VPN and packaged Windows acceptance

1. On two separate Windows computers install the same build and compare
   content digest and version. Start from disposable test profiles.
   For remote play use a trusted virtual LAN such as Radmin VPN on
   different physical networks. Use the VPN IPv4 address of the host,
   not localhost. Allow inbound traffic only on the chosen trusted
   network/profile and application port; do not turn off the firewall.
2. Host creates a password-protected room, guest enters the address,
   port and password. Record version/digest, player count, OS,
   network type, approximate latency, and whether this is LAN or VPN.
   Repeat with four actual clients when available.
3. Both players build and upgrade their own towers; compare credits,
   lives, tower owner and tiers. Race for the last purchase, try
   another owner's sale, and check exactly one debit/refusal.
   Verify host-only pause, speed, and team readiness.
4. Disconnect one guest for less than 120 seconds; reconnect and
   verify same slot, tower ownership and money. In a separate run,
   wait beyond 120 seconds and check expired-token behavior. If
   supported, verify abandoned tower reassignment after 30 seconds
   only by the host, with an audit event.
5. Attempt to join with a different content build, then repeat with
   matching content and a wrong password. Verify readable rejection.
6. Complete a real run, record XP/seals/claimedRuns, reconnect after
   result and restart the app. Check no second reward. Check saved
   host run and guest disconnect reason when host exits mid-wave.
7. Start and stop rooms repeatedly. Check no residual listener
   on the chosen port (PowerShell Get-NetTCPConnection -LocalPort
   <port> -State Listen), clean exit and readable connection errors.
8. Repeat title/settings/battle at 1366×768 and 1920×1080, and at
   native 4K if available. Exercise keyboard-only flow, colorblind
   shapes and indicators, reduced motion, and T5 attacks at 1×/3×.
   Install and update packaged EXE/installer while keeping profile,
   then export and import it; check that no Node or network access
   is required for solo play.

Record actual screenshots and per-case PASS/FAIL/UNAVAILABLE, build
hash, date, and failure details. A loopback run proves neither LAN
firewall behavior nor real remote Internet/VPN connectivity.
