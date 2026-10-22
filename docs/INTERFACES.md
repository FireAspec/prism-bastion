# Интерфейсы модулей и правила интеграции

Контракт v1 — src/contracts/index.ts, coop.ts, progression.ts, rules.ts, geometry.ts, runtime.ts, story.ts. В самостоятельных модулях эти файлы не редактируются. Изменение схемы оформляется предложением в собственной документации с совместимым адаптером внутри своего каталога и рассматривается при интеграции.

Сигнатуры entry points:
- src/engine/index.ts: createGame(config, options, combat):GameEngine; restoreGame(config, snapshot, combat):GameEngine.
- src/combat/index.ts: createCombat():CombatModule; дополнительно damageEnemy(state,config,id,packet):void для тестируемого единого расчёта урона.
- src/content/towers/<id>.ts: getTower():TowerDef. Всегда возвращать новую независимую копию или глубоко неизменяемую исходную структуру, которую resolveTower копирует.
- src/content/maps/<id>.ts: getMap():MapDef. Файлы лежат отдельно, без общего редактируемого списка.
- src/content/enemies.ts:getEnemies():EnemyDef[]; bosses.ts:getBosses():EnemyDef[]; waves.ts:getWaves():WaveDef[], getWaveSet(difficulty:Difficulty):WaveDef[], getEndlessWave(wave,seed,enemies):WaveDef.
- src/campaign/index.ts:createCampaign(nodes?:CampaignNode[]):CampaignService; src/content/campaign.ts:getCampaign():CampaignNode[].
- src/modes/index.ts:getModes():ModeDef[], getDifficulties():DifficultyDef[], resolveRules(modeId,difficulty,players):RuleModifiers. Доступ к нормальной жизни/доходу проверяет engine/combat.
- src/progression/index.ts:createProgression(config):ProgressionService; src/content/economy.ts:getEconomy():EconomyConfig; src/content/knowledge/<branch>.ts:getKnowledge():KnowledgeNode[].
- src/persistence/index.ts:createSaveStore(storage:Storage):SaveStore; defaultProfile():Profile. Профиль сам по себе не начисляет награду за каждый render.
- src/render/index.ts:createRenderer(canvas,config):GameRenderer.
- src/ui/hud.ts:createHUD(root,config,hooks,locale?):HUD.
- src/ui/menus.ts:createMenus(root,config,hooks,locale?):MenuUI.
- src/ui/lobby.ts:createLobby(root,config,hooks,locale?):LobbyUI.
- src/ui/knowledge.ts:createKnowledgeUI(root,config,hooks,locale?):KnowledgeUI.
- src/audio/index.ts:createAudio(settings):AudioSystem; src/localization/index.ts:createLocale(language):LocaleCatalog.
- src/network/protocol/index.ts:parseClient(raw:string):ClientMessage;parseServer(raw:string):ServerMessage;encode(message):string. Неверные входные данные отклоняются с исключением/типизированной ошибкой до обработки.
- src/network/host/index.ts:startHost(options,run,dependencies):Promise<HostHandle>. dependencies.createEngine отделяет Node сервер от UI и даёт изолированную тестовую симуляцию.
- src/network/client/index.ts:createCoopClient():CoopClient. Только стандартный WebSocket в renderer, без Node privileges.
- src/content/index.ts:loadContent():GameConfig, validateContent(config):string[]. Генератор scripts/generate-content.mjs обнаруживает модули tower/map/knowledge, создаёт каталог, проверяет ID и ресурсы. manifest поддерживает дополнения, digest включает нормализованные игровые данные и ключи ресурсов.
- src/art/index.ts:enemyArt(id):string,mapArt(id):string,worldArtRoot:string. Боссам соответствует public/art/bosses/<id>.svg; рядовым — public/art/enemies/<id>.svg; MapDef.background указывает public/art/maps/<id>/background.svg.

Конфигурация неизменяема внутри забега; engine хранит изменяемые сущности. getSnapshot() возвращает независимый снимок; drainEvents() очищает очередь после доставки всем потребителям. Отрисовка/звук/сеть получают один и тот же пакет событий от app, каждый потребитель не вызывает drainEvents сам. История событий не растёт без ограничения. В solo pause замораживает бой и таймеры; меню продолжает работать. На поражении новые урон/награды прекращаются.

Один host приложения владеет requestAnimationFrame, DOM-корнями, жизненным циклом, настройками, сохранением и маршрутизацией команд. HUD, меню, лобби, знания владеют только переданным root; renderer — только canvas. app создаёт отдельные roots: #game-canvas, #hud, #menus, #lobby, #knowledge. dispose каждого модуля удаляет свои обработчики, таймеры и audio nodes. Начатый run не пересоздаётся из-за обновления интерфейса.

Единственный владелец package.json/package-lock.json/tsconfig/Vite/desktop CI — desktop/build. Другие модули используют существующие зависимости; дополнительные зависимости предлагают в собственной документации. При интеграции build scripts контент-генератора и network host добавляются один раз. В independent тестах использовать локальные маленькие fixture-конфиги; не ожидать готовых чужих реализаций. Запускать свои тесты и общий check; если общий тест падает из-за чужой заглушки, указать это с точной командой и сохранить рабочую локальную проверку. Не отключать тесты, strict или типизацию ради зелёной сборки.

Дополнительные entry points:
- src/motion/index.ts:createTimeline():Timeline.
- src/render-animations/towers/index.ts:createTowerMotion():EntityMotion.
- src/render-animations/enemies/index.ts:createEnemyMotion():EntityMotion.
- src/ui-motion/index.ts:createUIMotion(settings):UIMotion.
Контракты motion/progression/coop входят в общий frozen boundary. Renderer использует EntityMotion.sample для transform, не создаёт другую физику снарядов. Все credit начисляются через frozen runtime.credit(state,amount), чтобы дробный остаток half-cash и сохранение работали одинаково в engine/combat. В кооперативе синхронный UIHooks.command может вернуть pending=true и requestId: это только ожидание, не подтверждённая покупка. Успешная анимация запускается после ServerMessage.result с ok=true и соответствующего события/snapshot. Повторная отправка и отказ не запускают успешный эффект.
