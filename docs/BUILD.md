# Windows desktop

## Build

Node 22.12+ (development only), npm and Windows x64. Run `npm ci`, `npm run check`, `npm run desktop:test`, then `npm run desktop:pack`. The pack command builds Vite with its existing relative base, bundles the Node host into dist/desktop/host.cjs and uses Electron Builder for x64 portable and per-user NSIS targets. The player does not need Node, npm, or internet. No updater or signing credentials are configured. Unsigned executables may trigger SmartScreen.

`npm run desktop:dev` builds and opens the local renderer with Electron. It intentionally starts no dev HTTP server; rerun after source changes. The separate existing `npm run dev` is unchanged for web development. Build tools Electron 45.5.0 and electron-builder 26.18.0 are exact development dependencies. The npm-generated package-lock.json includes their transitive dependencies. The build script invokes the local installed tools. First build requires package downloads; runtime does not.

## DesktopBridge

The five frozen methods are available only to the local top-level renderer. Context isolation and sandbox are enabled; no raw IPC, filesystem, child process, Node integration or shell is exposed. CSP denies remote HTTP requests, frames and external scripts; WebSocket connections are permitted for the LAN protocol. All permissions are denied. The Node host starts only on startHost; input is validated and requests serialized. Stop the host on room leave and before application shutdown. If startup fails, the renderer receives a rejected promise. No password is logged by the bridge.

Normal application instances share one profile and use a single-instance lock. `--test-multi-instance` uses a temporary separate profile for local testing (changes do not persist). The normal host port is 43127; use a different port for simultaneous hosts. LAN IPs are returned alongside loopback. Firewall setup may be needed; no automatic firewall or NAT changes.

## Verification

The base commit contains pending implementations of content registry, engine, combat, progression and network host. Their real integration, successful host startup, save-on-host-stop, and playable solo are not established by this module. The Windows CI builds, runs the existing checks, exercises standalone host-controller tests, then smoke-tests the unpacked app, portable EXE and NSIS-installed app in a Cyrillic path. The smoke test checks rejected malformed IPC, not successful multiplayer. `npm run content:validate` is strict; CI explicitly reports when the base registry stub prevents it from running. After integration the validator is mandatory.

Manual release checklist: launch both actual EXE targets with networking disconnected; play solo and reload a save; verify assets and no terminal; install to a Cyrillic path; create and join a room from two instances, play a wave and stop the host; verify exit releases the listening port and no child process remains; upgrade and retain the profile. Confirm all tests on Windows and record actual results before release.
