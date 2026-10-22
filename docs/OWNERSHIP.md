# Владение модулями

Каждый модуль имеет отдельную область изменения. Общий контракт src/contracts/ фиксирован до интеграции. Изменения вне своей области требуют отдельного интеграционного решения.

|№|Модуль|Файлы|
|---:|---|---|
|01|Симуляция, команды и боевые кредиты|`src/engine/**`, `tests/engine/**`, `docs/modules/simulation.md`|
|02|Урон, атаки, эффекты и способности|`src/combat/**`, `tests/combat/**`, `docs/modules/combat.md`|
|03|Постройка «Игломёт»: 15 улучшений и все модели|`src/content/towers/needle.ts`, `public/art/towers/needle/**`, `tests/towers/needle.test.ts`, `docs/towers/needle.md`|
|04|Постройка «Бастионная пушка»: 15 улучшений и все модели|`src/content/towers/cannon.ts`, `public/art/towers/cannon/**`, `tests/towers/cannon.test.ts`, `docs/towers/cannon.md`|
|05|Постройка «Рельсотрон»: 15 улучшений и все модели|`src/content/towers/rail.ts`, `public/art/towers/rail/**`, `tests/towers/rail.test.ts`, `docs/towers/rail.md`|
|06|Постройка «Веерный страж»: 15 улучшений и все модели|`src/content/towers/scatter.ts`, `public/art/towers/scatter/**`, `tests/towers/scatter.test.ts`, `docs/towers/scatter.md`|
|07|Постройка «Пилон пил»: 15 улучшений и все модели|`src/content/towers/saw.ts`, `public/art/towers/saw/**`, `tests/towers/saw.test.ts`, `docs/towers/saw.md`|
|08|Постройка «Жаровая печь»: 15 улучшений и все модели|`src/content/towers/ember.ts`, `public/art/towers/ember/**`, `tests/towers/ember.test.ts`, `docs/towers/ember.md`|
|09|Постройка «Криокристалл»: 15 улучшений и все модели|`src/content/towers/frost.ts`, `public/art/towers/frost/**`, `tests/towers/frost.test.ts`, `docs/towers/frost.md`|
|10|Постройка «Катушка Теслы»: 15 улучшений и все модели|`src/content/towers/tesla.ts`, `public/art/towers/tesla/**`, `tests/towers/tesla.test.ts`, `docs/towers/tesla.md`|
|11|Постройка «Алхимическая колба»: 15 улучшений и все модели|`src/content/towers/venom.ts`, `public/art/towers/venom/**`, `tests/towers/venom.test.ts`, `docs/towers/venom.md`|
|12|Постройка «Призменный маяк»: 15 улучшений и все модели|`src/content/towers/prism.ts`, `public/art/towers/prism/**`, `tests/towers/prism.test.ts`, `docs/towers/prism.md`|
|13|Постройка «Небесная мортира»: 15 улучшений и все модели|`src/content/towers/mortar.ts`, `public/art/towers/mortar/**`, `tests/towers/mortar.test.ts`, `docs/towers/mortar.md`|
|14|Постройка «Ракетная батарея»: 15 улучшений и все модели|`src/content/towers/rocket.ts`, `public/art/towers/rocket/**`, `tests/towers/rocket.test.ts`, `docs/towers/rocket.md`|
|15|Постройка «Ангар дронов»: 15 улучшений и все модели|`src/content/towers/drone.ts`, `public/art/towers/drone/**`, `tests/towers/drone.test.ts`, `docs/towers/drone.md`|
|16|Постройка «Минный узел»: 15 улучшений и все модели|`src/content/towers/mine.ts`, `public/art/towers/mine/**`, `tests/towers/mine.test.ts`, `docs/towers/mine.md`|
|17|Постройка «Резонатор»: 15 улучшений и все модели|`src/content/towers/resonator.ts`, `public/art/towers/resonator/**`, `tests/towers/resonator.test.ts`, `docs/towers/resonator.md`|
|18|Постройка «Хронобашня»: 15 улучшений и все модели|`src/content/towers/chrono.ts`, `public/art/towers/chrono/**`, `tests/towers/chrono.test.ts`, `docs/towers/chrono.md`|
|19|Постройка «Гравитационная линза»: 15 улучшений и все модели|`src/content/towers/gravity.ts`, `public/art/towers/gravity/**`, `tests/towers/gravity.test.ts`, `docs/towers/gravity.md`|
|20|Постройка «Зеркальная галерея»: 15 улучшений и все модели|`src/content/towers/mirror.ts`, `public/art/towers/mirror/**`, `tests/towers/mirror.test.ts`, `docs/towers/mirror.md`|
|21|Постройка «Портальная арка»: 15 улучшений и все модели|`src/content/towers/portal.ts`, `public/art/towers/portal/**`, `tests/towers/portal.test.ts`, `docs/towers/portal.md`|
|22|Постройка «Штормовой шпиль»: 15 улучшений и все модели|`src/content/towers/storm.ts`, `public/art/towers/storm/**`, `tests/towers/storm.test.ts`, `docs/towers/storm.md`|
|23|Постройка «Сигнальный фонарь»: 15 улучшений и все модели|`src/content/towers/beacon.ts`, `public/art/towers/beacon/**`, `tests/towers/beacon.test.ts`, `docs/towers/beacon.md`|
|24|Постройка «Полевая кузня»: 15 улучшений и все модели|`src/content/towers/forge.ts`, `public/art/towers/forge/**`, `tests/towers/forge.test.ts`, `docs/towers/forge.md`|
|25|Постройка «Обсерватория»: 15 улучшений и все модели|`src/content/towers/observatory.ts`, `public/art/towers/observatory/**`, `tests/towers/observatory.test.ts`, `docs/towers/observatory.md`|
|26|Постройка «Монетный двор»: 15 улучшений и все модели|`src/content/towers/mint.ts`, `public/art/towers/mint/**`, `tests/towers/mint.test.ts`, `docs/towers/mint.md`|
|27|Постройка «Кристальный банк»: 15 улучшений и все модели|`src/content/towers/bank.ts`, `public/art/towers/bank/**`, `tests/towers/bank.test.ts`, `docs/towers/bank.md`|
|28|Постройка «Искровой сад»: 15 улучшений и все модели|`src/content/towers/orchard.ts`, `public/art/towers/orchard/**`, `tests/towers/orchard.test.ts`, `docs/towers/orchard.md`|
|29|Постройка «Дозорный причал»: 15 улучшений и все модели|`src/content/towers/harbor.ts`, `public/art/towers/harbor/**`, `tests/towers/harbor.test.ts`, `docs/towers/harbor.md`|
|30|Постройка «Приливный насос»: 15 улучшений и все модели|`src/content/towers/tide.ts`, `public/art/towers/tide/**`, `tests/towers/tide.test.ts`, `docs/towers/tide.md`|
|31|Постройка «Коралловый страж»: 15 улучшений и все модели|`src/content/towers/coral.ts`, `public/art/towers/coral/**`, `tests/towers/coral.test.ts`, `docs/towers/coral.md`|
|32|Постройка «Щитовой бастион»: 15 улучшений и все модели|`src/content/towers/bastion.ts`, `public/art/towers/bastion/**`, `tests/towers/bastion.test.ts`, `docs/towers/bastion.md`|
|33|24 обычных врага и слои дохода|`src/content/enemies.ts`, `public/art/enemies/**`, `tests/content/enemies.test.ts`, `docs/modules/enemies.md`|
|34|Шесть боссов, фазы и облики|`src/content/bosses.ts`, `public/art/bosses/**`, `tests/content/bosses.test.ts`, `docs/modules/bosses.md`|
|35|100 волн, расписания и endless|`src/content/waves.ts`, `tests/content/waves.test.ts`, `docs/modules/waves.md`|
|36|Сюжет, граф доступа и открытие 30 башен|`src/campaign/**`, `src/content/campaign.ts`, `tests/campaign/**`, `docs/modules/campaign.md`|
|37|Четыре сложности забега и десять режимов|`src/modes/**`, `tests/modes/**`, `docs/modules/modes.md`|
|38|Карта 01 «Сад фонарей»|`src/content/maps/lantern-garden.ts`, `public/art/maps/lantern-garden/**`, `tests/maps/lantern-garden.test.ts`, `validation/maps/lantern-garden/**`, `docs/maps/lantern-garden.md`|
|39|Карта 02 «Медный ручей»|`src/content/maps/copper-creek.ts`, `public/art/maps/copper-creek/**`, `tests/maps/copper-creek.test.ts`, `validation/maps/copper-creek/**`, `docs/maps/copper-creek.md`|
|40|Карта 03 «Поля ветряков»|`src/content/maps/windmill-fields.ts`, `public/art/maps/windmill-fields/**`, `tests/maps/windmill-fields.test.ts`, `validation/maps/windmill-fields/**`, `docs/maps/windmill-fields.md`|
|41|Карта 04 «Старый акведук»|`src/content/maps/old-aqueduct.ts`, `public/art/maps/old-aqueduct/**`, `tests/maps/old-aqueduct.test.ts`, `validation/maps/old-aqueduct/**`, `docs/maps/old-aqueduct.md`|
|42|Карта 05 «Садовая стена»|`src/content/maps/orchard-wall.ts`, `public/art/maps/orchard-wall/**`, `tests/maps/orchard-wall.test.ts`, `validation/maps/orchard-wall/**`, `docs/maps/orchard-wall.md`|
|43|Карта 06 «Грузовой двор»|`src/content/maps/freight-yard.ts`, `public/art/maps/freight-yard/**`, `tests/maps/freight-yard.test.ts`, `validation/maps/freight-yard/**`, `docs/maps/freight-yard.md`|
|44|Карта 07 «Колокольная литейная»|`src/content/maps/bell-foundry.ts`, `public/art/maps/bell-foundry/**`, `tests/maps/bell-foundry.test.ts`, `validation/maps/bell-foundry/**`, `docs/maps/bell-foundry.md`|
|45|Карта 08 «Приливные доки»|`src/content/maps/tidal-docks.ts`, `public/art/maps/tidal-docks/**`, `tests/maps/tidal-docks.test.ts`, `validation/maps/tidal-docks/**`, `docs/maps/tidal-docks.md`|
|46|Карта 09 «Солёные болота»|`src/content/maps/salt-marsh.ts`, `public/art/maps/salt-marsh/**`, `tests/maps/salt-marsh.test.ts`, `validation/maps/salt-marsh/**`, `docs/maps/salt-marsh.md`|
|47|Карта 10 «Коралловые ворота»|`src/content/maps/coral-gate.ts`, `public/art/maps/coral-gate/**`, `tests/maps/coral-gate.test.ts`, `validation/maps/coral-gate/**`, `docs/maps/coral-gate.md`|
|48|Карта 11 «Часовая площадь»|`src/content/maps/clock-square.ts`, `public/art/maps/clock-square/**`, `tests/maps/clock-square.test.ts`, `validation/maps/clock-square/**`, `docs/maps/clock-square.md`|
|49|Карта 12 «Павшая обсерватория»|`src/content/maps/fallen-observatory.ts`, `public/art/maps/fallen-observatory/**`, `tests/maps/fallen-observatory.test.ts`, `validation/maps/fallen-observatory/**`, `docs/maps/fallen-observatory.md`|
|50|Карта 13 «Призменный карьер»|`src/content/maps/prism-quarry.ts`, `public/art/maps/prism-quarry/**`, `tests/maps/prism-quarry.test.ts`, `validation/maps/prism-quarry/**`, `docs/maps/prism-quarry.md`|
|51|Карта 14 «Зеркальные террасы»|`src/content/maps/mirror-terrace.ts`, `public/art/maps/mirror-terrace/**`, `tests/maps/mirror-terrace.test.ts`, `validation/maps/mirror-terrace/**`, `docs/maps/mirror-terrace.md`|
|52|Карта 15 «Стеклянный серпантин»|`src/content/maps/glass-switchback.ts`, `public/art/maps/glass-switchback/**`, `tests/maps/glass-switchback.test.ts`, `validation/maps/glass-switchback/**`, `docs/maps/glass-switchback.md`|
|53|Карта 16 «Мост раскола»|`src/content/maps/fracture-bridge.ts`, `public/art/maps/fracture-bridge/**`, `tests/maps/fracture-bridge.test.ts`, `validation/maps/fracture-bridge/**`, `docs/maps/fracture-bridge.md`|
|54|Карта 17 «Квартал хранилищ»|`src/content/maps/vault-district.ts`, `public/art/maps/vault-district/**`, `tests/maps/vault-district.test.ts`, `validation/maps/vault-district/**`, `docs/maps/vault-district.md`|
|55|Карта 18 «Штормовой берег»|`src/content/maps/storm-coast.ts`, `public/art/maps/storm-coast/**`, `tests/maps/storm-coast.test.ts`, `validation/maps/storm-coast/**`, `docs/maps/storm-coast.md`|
|56|Карта 19 «Чёрный маяк»|`src/content/maps/black-lighthouse.ts`, `public/art/maps/black-lighthouse/**`, `tests/maps/black-lighthouse.test.ts`, `validation/maps/black-lighthouse/**`, `docs/maps/black-lighthouse.md`|
|57|Карта 20 «Сердце бури»|`src/content/maps/heart-of-storm.ts`, `public/art/maps/heart-of-storm/**`, `tests/maps/heart-of-storm.test.ts`, `validation/maps/heart-of-storm/**`, `docs/maps/heart-of-storm.md`|
|58|Сетевой протокол и валидация|`src/network/protocol/**`, `tests/network/protocol/**`, `docs/network/protocol.md`|
|59|Авторитетный сервер кооператива|`src/network/host/**`, `tests/network/host/**`, `docs/network/hosting.md`|
|60|Клиент кооператива и восстановление|`src/network/client/**`, `tests/network/client/**`, `docs/network/client.md`|
|61|Интерфейс комнаты и игры с друзьями|`src/ui/lobby.ts`, `src/ui/lobby.css`, `tests/ui/lobby/**`, `docs/network/player-guide.md`|
|62|Отрисовка поля, 450 улучшений и эффекты|`src/render/**`, `tests/render/**`, `docs/modules/renderer.md`|
|63|Боевой HUD и покупка трёх веток|`src/ui/hud.ts`, `src/ui/hud.css`, `tests/ui/hud/**`, `docs/modules/hud.md`|
|64|Главное меню, 20 карт и результаты|`src/ui/menus.ts`, `src/ui/menus.css`, `tests/ui/menus/**`, `docs/modules/menus.md`|
|65|Профиль, сохранения и миграции|`src/persistence/**`, `tests/persistence/**`, `docs/modules/persistence.md`|
|66|Музыка, звуки и аудиопереходы|`src/audio/**`, `public/audio/**`, `tests/audio/**`, `docs/modules/audio.md`|
|67|Общий художественный набор и интерфейсные ресурсы|`src/art/**`, `public/art/world/**`, `public/art/ui/**`, `tests/art/**`, `docs/ART-REFERENCE.md`|
|68|Windows приложение, упаковка и CI|`desktop/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.github/workflows/**`, `scripts/build-desktop.mjs`, `docs/BUILD.md`|
|69|Сборка игровых модулей в игровой цикл|`src/app/**`, `index.html`, `tests/app/**`, `docs/modules/runtime.md`|
|70|Каталог, версии и добавление контента|`src/content/index.ts`, `src/content/manifest.ts`, `src/content/generated.ts`, `scripts/generate-content.mjs`, `scripts/validate-content.mjs`, `tests/catalog/**`, `docs/UPDATES.md`|
|71|Системные тесты правил и модулей|`tests/integration/**`, `scripts/check-game.mjs`, `docs/qa/integration.md`|
|72|Проверка интерфейса и кооператива|`tests/e2e/**`, `playwright.config.ts`, `docs/qa/e2e.md`|
|73|Проходимость 20 карт и боевой баланс|`src/balance/**`, `scripts/run-balance.mjs`, `validation/replays/**`, `tests/balance/**`, `docs/qa/balance.md`|
|74|Обучение, язык и доступность|`src/localization/**`, `src/tutorial/**`, `tests/tutorial/**`, `docs/modules/tutorial.md`|
|75|Доктрина «Баллистика»: 30 постоянных узлов|`src/content/knowledge/ballistics.ts`, `public/art/knowledge/ballistics/**`, `tests/knowledge/ballistics.test.ts`, `docs/knowledge/ballistics.md`|
|76|Доктрина «Стихии»: 30 постоянных узлов|`src/content/knowledge/elements.ts`, `public/art/knowledge/elements/**`, `tests/knowledge/elements.test.ts`, `docs/knowledge/elements.md`|
|77|Доктрина «Инженерия»: 30 постоянных узлов|`src/content/knowledge/engineering.ts`, `public/art/knowledge/engineering/**`, `tests/knowledge/engineering.test.ts`, `docs/knowledge/engineering.md`|
|78|Доктрина «Снабжение»: 30 постоянных узлов|`src/content/knowledge/commerce.ts`, `public/art/knowledge/commerce/**`, `tests/knowledge/commerce.test.ts`, `docs/knowledge/commerce.md`|
|79|Доктрина «Искусство маяка»: 30 постоянных узлов|`src/content/knowledge/lighthouse.ts`, `public/art/knowledge/lighthouse/**`, `tests/knowledge/lighthouse.test.ts`, `docs/knowledge/lighthouse.md`|
|80|Опыт, уровни, печати и исполнение знаний|`src/progression/**`, `src/content/economy.ts`, `tests/progression/**`, `docs/modules/progression.md`|
|81|Экран пяти доктрин и постоянной экономики|`src/ui/knowledge.ts`, `src/ui/knowledge.css`, `tests/ui/knowledge/**`, `docs/modules/knowledge-ui.md`|
|82|Независимая проверка экономики и темпа прогресса|`scripts/simulate-economy.mjs`, `src/economy-analysis/**`, `tests/economy-analysis/**`, `validation/economy/**`, `docs/qa/economy.md`|
|83|Общая система анимаций и режиссура|`src/motion/**`, `tests/motion/**`, `docs/ANIMATION.md`|
|84|Постановка, стрельба и превращения башен|`src/render-animations/towers/**`, `tests/animations/towers/**`, `docs/animations/towers.md`|
|85|Движение, снятие слоёв и гибель врагов|`src/render-animations/enemies/**`, `tests/animations/enemies/**`, `docs/animations/enemies.md`|
|86|Анимации магазина, веток и наград|`src/ui-motion/**`, `tests/animations/ui/**`, `docs/animations/ui.md`|
|87|Контакт снарядов, ближних ударов и эффектов|`tests/contact/**`, `src/contact-validation/**`, `validation/contact/**`, `docs/qa/contact.md`|
