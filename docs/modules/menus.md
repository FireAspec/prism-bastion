# Menu UI

`createMenus(root, config, hooks, locale?)` implements the frozen `MenuUI` boundary. It owns only its own section and imports scoped menu styles. No storage, reward mutations, simulation, network connection or save loop occurs here.

- `show` receives the latest profile, optional run snapshot and authoritative reward receipt. `hide` preserves map/difficulty/mode selection. `dispose` removes the owned section. The app owns route transitions and must hide the menu after accepting a start.
- Campaign cards are sorted by `campaignIndex` and grouped by geometry difficulty. Selectable locked cards expose prerequisites using campaign node IDs. Challenge modes require completion of that node. Selection of a map never replaces the run difficulty or silently resets a locked challenge. All cards use the catalog background with geometry fallback (lanes, water, blocked polygons).
- `menuRules` merges difficulty and partial mode overrides for an indicative solo preview; app/engine own authoritative rules and knowledge. XP/seal figures are estimates before knowledge; only a receipt is a confirmed amount.
- The app must pass the updated profile when displaying a result. `firstClear` describes a medal tuple, not a campaign node. New technology display compares the run's initial tower list with updated profile availability; in guest reconnect cases this cannot identify exact newly earned towers when the host's loadout differs. In that case the current availability is still displayed; an exact per-player unlock receipt would require extending the boundary. No receipt or duplicate receipt never implies a new award.
- Hooks: start emits one `RunOptions` (solo, non-endless) per accepted display; a new random run ID/seed is generated only on click. Resume requires a build/wave snapshot. Settings are handed to app with a copied value. Export/import are disabled when hooks are absent. Co-op and knowledge route through their no-argument hooks; doctrine selection belongs to KnowledgeUI. App should re-show after profile import to refresh the displayed profile. English interface strings are included; catalog names/descriptions remain supplied by content. `menus.campaign` can be provided by LocaleCatalog.

## Verification

- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM,DOM.Iterable src/ui/menus.ts`
- `npx vitest run tests/ui/menus/menus.test.ts` (requires installed repository dependencies).
- `python tests/ui/menus/browser_check.py` (requires Python Playwright, Chromium and `tsc` on PATH; optional `CHROMIUM_PATH` and `PB_MENU_PREVIEW`). This compiles the production module and exercises it in a real browser with a deliberately synthetic catalog, not the game's real maps.
- Browser checks: 20 cards, keyboard start, lock explanation, locked challenge, independent difficulty and back navigation, duplicate start prevention, one-life override, first/repeat/duplicate/absent receipt, settings motion/language, routing and disposal. No server/network needed.

Integration still needs the real content registry, localization, progression service, persistence and app. Check full `npm run check`, Electron packaging, native 4K and co-op reconnect with those modules; isolated UI assertions do not prove those systems work.
