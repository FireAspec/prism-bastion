# UI motion — module 86

## Boundary and integration

`createUIMotion(settings)` implements the frozen `UIMotion` contract with Web Animations API. It also exposes `cancel(element?)` and `reduced`. The host can use `UIAnimator` for the full confirmation/counter lifecycle. No dependencies or changes to the contract. The module takes only DOM elements, settings, authoritative numeric targets, command results and receipts; it never writes to `GameState` or `Profile` and never calls the engine directly.

```ts
import {UIAnimator} from '../ui-motion';
import '../ui-motion/motion.css';
const motion = new UIAnimator(root, profile.settings);
// key must identify the logical action (e.g. runId:place:tower:position or runId:upgrade:entity:path:tier)
const key = 'upgrade:t7:A:2';
const text = {pending: 'Ожидание сервера', accepted: 'Улучшение куплено', rejected: 'Покупка отклонена'};
motion.submit(key, button, () => hooks.command(command), text);
// After the host result and its matching authoritative snapshot/event are reconciled:
motion.confirm(key, requestId, result);
motion.counter(creditElement, snapshot.credits);
// On replacement of a pending control:
motion.bind(key, newButton);
// Before replacing the screen, not after rendering:
motion.changeScreen();
// Every settings change:
motion.setSettings(profile.settings);
// On app teardown:
motion.dispose();
```

The caller keeps the mapping from server seq/requestId to logical key. A pending command is locked until a matching terminal result. Do not clear a pending command on a mere timeout: reconcile with the host first, then call `rejectUnresolved(key)` only if failure is known. If the transport cannot supply requestId, the command remains locked until this reconciliation. A synchronous solo success is authoritative immediately. A 300 ms debounce per successful key suppresses immediate repeated clicks; it is independent of animation duration. A different deliberate action should have a different key. `idle` from `submit` means no action sent (detached control or debounced). `bind` is only for replacing a pending control. The host owns localization, actual navigation, command dispatch and authoritative state; do not call `play('purchase')` on intent alone. The host should also enforce idempotency independently; the UI guard is not a security boundary.

For knowledge purchases and respec, map the progression service's returned `ok`/`reason` to a `CommandResult` and publish the returned profile through the normal host path. Pass `'unlock'` or `'respec'` to `submit` as the final argument. Do not infer success from a clicked button. For reward use `reward(runId, receipt, {reward,level,medal}, localizedMessage, medalEarned)` after progression returns. `medalEarned` is calculated by the caller from authoritative profiles (the receipt lacks medal IDs). Duplicate receipts and already displayed run IDs are ignored. Display XP, level, points and seals through separate `counter` elements. For a multi-level receipt one level-up animation represents the final level. Use a plain dedicated counter text node/element without `aria-live` and without nested focusable content; pass a formatter if desired.

Transitions: purchase 300 ms; reject 240 ms; unlock 340 ms; levelUp 440 ms; reward 320 ms; open 220 ms; close 150 ms; select 180 ms; respec 260 ms. WAAPI effects use no persistent fill and cancel rather than queue. The caller owns semantic selected/expanded/hidden attributes, and must guard stale callbacks when changing screen. Visual states are data attributes with distinct outline patterns and symbols; `aria-busy` and one throttled polite live region support AT. Do not put live regions on each hit/counter. `reducedMotion` or OS reduced motion immediately cancels effects and settles counters. `changeScreen()` cancels effects/announcements, but does not release unresolved purchase locks. The root removal observer disposes the module; explicit disposal is preferable, especially if an app keeps a hidden root mounted. Screen owners must remove their own click handlers. The UIAnimator keeps only one RAF for all counters, and a burst deadline of 240 ms; retargeting does not restart the active burst. The counter never predicts income or spends currency. No external assets or network calls.

## Preview and checks

From the repository root after installing its dependencies:

- `npm run dev` then open `http://127.0.0.1:5173/src/ui-motion/preview.html` (isolated interactive fixture, not production HUD).
- `npm run dev` then open `http://127.0.0.1:5173/tests/animations/ui/qa.html` for browser assertions; the page reports PASS/FAIL.
- `npx vitest run tests/animations/ui/motion.test.ts` for isolated mocked WAAPI tests.
- `npm run check` for repository integration.

Local verification used TypeScript 5.8.3 with strict, ES2022 and DOM libs against the embedded frozen contract. Browser assertions ran in real headless Chromium with compiled JS embedded into the HTML because local HTTP navigation was restricted. The full repository check and Vitest runner are not available in the isolated environment; no claim of integration pass. Test fixture values are not a production progression calculation. The preview includes representative cards, not a new tower art catalog. Actual host wiring and full network reconciliation belong to app/HUD/knowledge/menu integration; neither their files nor frozen interfaces were changed.
