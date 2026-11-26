# Combat HUD

## Public boundary

`createHUD(root, config, hooks, locale?)` implements the v1 HUD interface. The supplied root must be dedicated to the combat overlay. The HUD reads snapshots, never changes GameState, never runs combat, and never owns the world canvas. Use the knowledge-adjusted run config (not the unmodified catalog) so previews reflect the same data as the engine. All confirmed gameplay intentions go through hooks.command. Shop clicks call chooseTower; the app validates the clicked world position and dispatches place exactly once. Selection and cancellation use select and chooseTower.

The shop renders the entire configured catalog by category, including locked entries and the campaign map required to unlock each one. A full catalog contains 30 entries; missing content is not synthesized. Search uses ID, name and description. A new selection opens the inspector; placing opens the shop. A selected tower shows the actual primary asset, secondary overlay, owner, investment, refund, targeting and three paths of five steps. Buttons use real VisualState assets, not substitute icons. The primary path is the highest tier, lower index on ties. Only the next legal tier is actionable. Disabled controls remain focusable and provide a reason on activation.

## Layout / app ownership

The overlay uses an absolute grid inside a positioned run container. Reserve the same geometry for the world canvas, without drawing underneath the panels:

    .run { position:relative; width:100%; height:100%;
      --pb-hud-header:66px; --pb-hud-rail:clamp(320px,28vw,420px); }
    #game-canvas { position:absolute; top:var(--pb-hud-header); left:0;
      width:calc(100% - var(--pb-hud-rail)); height:calc(100% - var(--pb-hud-header)); }
    #hud { position:absolute; inset:0; pointer-events:none; }

At widths <=1050px use 88px header and 310px rail. Canvas renderer must resize and fit the 1280x720 world to its reserved rectangle. The HUD does not resize or modify another module's DOM. At 1366x768 the reserved rail is approximately 382.5px, leaving approximately 983.5x702px for the canvas. The inspector and catalog scroll independently. Command feedback stays in the rail.

Space starts a build-phase wave or toggles pause in battle; 1/2/3 set speed; Esc cancels placement first, then deselects. Native Enter/Space activate focused buttons once. Text input does not trigger gameplay shortcuts other than Escape. The app must dispose the HUD when leaving the run or route modal keyboard events before the HUD.

## Previews and rules

- Price uses the base cost, run multiplier, knowledge discount (when allowed), strongest in-range discount aura except the target itself, support cap 15%, combined cap 20%. Integer-boundary floating-point noise is ignored. Confirmed amount from the engine remains authoritative. The engine and HUD must use identical rounding.
- A new placement has no position in HUD.update: shop cards show the best possible price through the undiscounted-position price. The app must show the exact price at its placement ghost, and enforce terrain/footprint. The lower bound may not be attainable at a legal placement; the HUD does not assert otherwise.
- The projection applies the primary T3+ replacement then all deltas A/B/C, merges effects and abilities by ID, shows current and future attack stats and changed effects. It is a preview, not a second combat engine; temporary combat buffs, actual DPS and status interactions are not claimed.
- Refund uses the frozen sellRefund on actual invested credits. Crosspaths and team T5 use frozen canUpgrade and a team-wide check. Mode, owner, cooldown and affordability are independent gates. A one-life run does not advertise effective life restoration; barrier activation is blocked in that run. Money ability is blocked if passive income is disallowed.
- Build-phase wave number assumes state.wave is the last completed wave; in wave phase it is the running wave. Map overrides take precedence. Next threat is read from the wave catalog; absent/endless-generated waves are labelled unknown rather than invented. Active bosses show current HP percent, shield and phase estimated from defined HP thresholds; no simulation state is changed.
- Locale lookups use hud.* keys and fall back to Russian. Content names/descriptions remain catalog text. The central localization module should provide English strings and content localization; full English content is not part of this module.
- Solo actions use the supplied player ID if present. In a multi-player run unknown local identity cannot edit towers. Pause/speed/auto require isHost. StartWave is passed once as an intention; the app/host owns ready voting (RoomState is not exposed to HUD).

## Acknowledgement

A command is reserved before invoking the hook. Duplicate clicks/keyboard activation of that pending action are ignored. A pending response does not animate or deduct credits. It is released only when the observable state changes or on a correlated rejection. The return type extends the frozen HUD structurally with optional integration method `settle(requestId, result)` (HUDWithResults). The app should route authoritative result messages to this method with the requestId returned by its hook; a successful result alone waits for the corresponding snapshot. The frozen notify(message) is display-only, not an acknowledgement. A lost result without snapshot is not automatically retried; recreate the HUD on disconnected/restarted sessions, or deliver a correlated rejection. No changes to contracts are needed.

## Acceptance commands

    npm run typecheck
    npx vitest run tests/ui/hud/hud.test.ts
    npm run check
    npx playwright install chromium
    npx tsx tests/ui/hud/browser.ts

The independent unit fixture has 30 synthetic definitions and exercises all 180 permutations, illegal combinations, team T5, ownership, exact refund, discount and immutability. The standalone browser runner uses a Vite-served fixture at 1366x768, checks 30 cards, filter/focus, placement/Escape, 15 upgrade nodes, model and overlay paths, crosspath gates, pending duplicate suppression, rejection, owner/no-sale, disposal and field/rail rectangles. It writes screenshots to test-results/hud/ (not committed). It checks asset paths, not the artistic quality of the real tower SVGs, which requires the integrated catalog and art. The complete app, network and renderer are separate modules; full field/asset/coop visual verification must use the integrated game.

The base commit contains stub app, engine and combat modules. Local checkout was unavailable due to DNS/network restrictions; CI results and browser execution must be recorded separately. Do not treat the test files alone as evidence of a passing run.
