# Общая режиссура анимаций (модуль 83)

## Граница системы

`src/motion/index.ts` экспортирует совместимый с frozen v1 `createTimeline(): ManagedTimeline` (`ManagedTimeline extends Timeline`) и общие функции режиссуры. Модуль не импортирует runtime, не вызывает RNG, не выполняет команды и не владеет RAF, DOM или состоянием игры. Никакие выплаты, HP, cooldown, позиции столкновений не вычисляются по анимациям. `EntityMotion` для башен и врагов, DOM `UIMotion`, физический контакт и окончательные модели принадлежат модулям 84–87; здесь предоставлены их общие примитивы.

### Timeline

Все величины времени — секунды. `advance(dt)` один раз на кадр на выбранных часах; `value(key,from,to,duration,ease)` создаёт трек при первом запросе и возвращает текущее значение при повторе той же спецификации. Изменение параметров начинает новую интерполяцию от текущего значения (без скачка); нулевая длительность возвращает `to`. Поддерживаются `linear`, `outCubic`, `outBack` (намеренный overshoot), `inOutCubic`. Для явного повтора с теми же параметрами вызвать `cancel(key)` перед `value`. `clear()` очищает все треки и часы; `dispose()` окончательно закрывает таймлайн. Некорректные конечные значения/отрицательное время отвергаются до изменения состояния.

Завершённые треки сохраняют значение, пока владелец не вызовет `cancel`/`clear`; это необходимо, чтобы чтение завершённого трека не запускало его повторно. Используйте стабильные ключи вида `entityId/channel/property`, отменяйте их при продаже, смерти, удалении DOM-элемента и смене сцены. Лимит 4096 записей: новые ключи при переполнении получают конечное значение без хранения; существующие не вытесняются. Размер доступен через `size`. `advance` O(1), чтение не создаёт массивы или объекты для неизменной спецификации; новые объекты только при старте/изменении трека. Динамическая строка ключа остаётся ответственностью вызывающего кода.

### Режиссура событий

`createDirector()` принимает авторитетный `GameEvent[]` по возрастанию ID и snapshot. При новом забеге, восстановлении или reconnect сначала `reset(snapshot)` — очищает старую историю, устанавливает watermark `nextEvent - 1`. При обычном кадре `consume(events,snapshot)` один раз после доставки общей очереди, `update(snapshot)` на следующих кадрах. `visit((cue,elapsed)=>...)` возвращает активные неизменяемые записи; `sampleCue(cue.cue,elapsed,reducedMotion,reusableSample)` вычисляет визуальные коэффициенты. `cancel(entity)` снимает все каналы сущности, `dispose()` завершает жизнь объекта. Внутри одного кадра порядок событий важен; старые ID игнорируются. Пакеты, пришедшие не по порядку, должны быть отброшены/упорядочены клиентом; директор не буферизует сетевую историю.

Игровые часы берутся из `GameState.time`, а не из wall-clock. При паузе snapshot.time неизменен; скорость 3× отражена в snapshot.time, поэтому не умножать её повторно. При сетевой интерполяции допускается передавать согласованное монотонное визуальное game-time не позже авторитетного тика, но не самостоятельно вычислять попадание. Просроченные эффекты пропускаются, а свежие начинают с уже истекшего возраста. При reset не проигрывается старая история.

Продажа/гибель/утечка отменяют все каналы соответствующей сущности, затем добавляют один терминальный эффект. Событие должно содержать позицию удалённой сущности; если её нет, рендерер может использовать свой последний визуальный образ (не хранится в директоре). Новая cue на том же канале заменяет предыдущую, кроме менее приоритетных: например, T5 не перебивается младшей накладкой; окончательный вид всё равно берётся из снимка. Приоритеты 1–5; при лимите 2048 активных записей новая более приоритетная запись может вытеснить первую менее приоритетную, иначе пропускается. Никаких неограниченных очередей. У разных каналов можно совместить hit/layer/shield; масштаб и opacity не должны влиять на collision footprint. При ReducedMotion визуальный семпл не поворачивается, не смещается и не масштабируется; затухание 80–120 ms, мягкое свечение. Директор хранит cue не дольше обычного времени, даже если визуально ReducedMotion уже закончился.

`cueForEvent(event,tier?)` выбирает T1/T2 (380 ms), T3/T4 (600 ms), T5 (1150 ms). Передавайте фактически купленный tier, если доступен; общий директор предпочитает распознаваемый `toVisual` (`a5.svg` и т. п.), затем максимальный tier из подтверждённого snapshot. Контракт v1 не содержит purchasedPath/purchasedTier: при покупке вторичной ветки на существующей T5 и отсутствии подходящего toVisual точную ступень определить нельзя. Предлагаемое необязательное расширение после интеграции: явные `path` и `tier` в upgrade event; текущий контракт не меняется.

### Интерфейс

`createUIDirector()` ведёт отдельные часы `advance(realSeconds)`, даже при игровой паузе. `play(elementKey,transition)` запускает cue по подтверждённому результату; `visit` даёт elapsed и флаг reduced. Повтор на том же ключе заменяет старый эффект, очереди нет; при заполнении 128 записей вытесняется самая старая. `cancel`, `clear` при смене экрана, `dispose` при закрытии. При смене ReducedMotion активные UI cues завершаются очисткой, следующий эффект получает новый режим. DOM-адаптер модуля 86 обязан восстановить базовый CSS и разрешить прерванные Promise `UIMotion.play`, не держать DOM-узлы в директоре. `pending:true` — ожидание, не покупка; только подтверждённое событие/result запускает purchase/debit. Повторный requestId обрабатывается UI/network до `play`. Для XP/печатей/медали использовать подтверждённый неповторный RewardReceipt/результат, не события каждого render.

### Контакт и позы

`projectileSpawn` только визуальный сигнал вылета; положение в полёте из `ProjectileState.previous/pos`, а не из sampleCue travel. `strikeStart` — сигнал замаха, реальный остаток из `StrikeState.remainingWindup/remainingActive`. `projectileImpact`/`strikeContact` — контакт в `event.pos`, `miss` — отсутствие попадания; `hit`/`layerBreak`/`shieldBreak` не синтезировать. `idle`, `aim`, `reload`, `move`, `turn` — позы/интерполяция из snapshots; `split` — родительский kill + child spawn (не вычислять детей анимацией). `sampleCue` даёт ограниченные числовые визуальные коэффициенты и принимает переиспользуемый результат; caller определяет слой, локальную систему координат и реальный asset. Не использовать `offsetX` travel для боевой позиции снаряда. Режиссура не является отдельной симуляцией.

## Галерея и матрица покрытия

Запуск в репозитории: `npm run dev`, открыть `http://127.0.0.1:5173/src/motion/gallery.html` (если Vite выбрал другой порт, использовать его). Все карточки запускаются по кнопке «Повторить» и «Повторить всё», доступны 1×/2×/3×, целевые 30/60/144 FPS, пауза игровых часов и ReducedMotion. Схематические модели иллюстрируют реальные коэффициенты, а не 450 индивидуальных моделей. Целевая частота ограничена физической частотой RAF. Ссылки ниже ведут к исполняемым карточкам (после запуска Vite).

| Событие / переход | Время, ms | Исполняемый пример |
|---|---:|---|
| `GAME_CUES.place` | 380 | [game-place](../src/motion/gallery.html#game-place) |
| `GAME_CUES.upgrade` | 380 | [game-upgrade](../src/motion/gallery.html#game-upgrade) |
| `GAME_CUES.sell` | 320 | [game-sell](../src/motion/gallery.html#game-sell) |
| `GAME_CUES.shot` | 160 | [game-shot](../src/motion/gallery.html#game-shot) |
| `GAME_CUES.projectileSpawn` | 160 | [game-projectileSpawn](../src/motion/gallery.html#game-projectileSpawn) |
| `GAME_CUES.projectileImpact` | 180 | [game-projectileImpact](../src/motion/gallery.html#game-projectileImpact) |
| `GAME_CUES.strikeStart` | 250 | [game-strikeStart](../src/motion/gallery.html#game-strikeStart) |
| `GAME_CUES.strikeContact` | 180 | [game-strikeContact](../src/motion/gallery.html#game-strikeContact) |
| `GAME_CUES.miss` | 160 | [game-miss](../src/motion/gallery.html#game-miss) |
| `GAME_CUES.hit` | 100 | [game-hit](../src/motion/gallery.html#game-hit) |
| `GAME_CUES.layerBreak` | 90 | [game-layerBreak](../src/motion/gallery.html#game-layerBreak) |
| `GAME_CUES.shieldBreak` | 230 | [game-shieldBreak](../src/motion/gallery.html#game-shieldBreak) |
| `GAME_CUES.kill` | 300 | [game-kill](../src/motion/gallery.html#game-kill) |
| `GAME_CUES.leak` | 250 | [game-leak](../src/motion/gallery.html#game-leak) |
| `GAME_CUES.spawn` | 240 | [game-spawn](../src/motion/gallery.html#game-spawn) |
| `GAME_CUES.ability` | 450 | [game-ability](../src/motion/gallery.html#game-ability) |
| `GAME_CUES.bossPhase` | 750 | [game-bossPhase](../src/motion/gallery.html#game-bossPhase) |
| `GAME_CUES.waveStart` | 360 | [game-waveStart](../src/motion/gallery.html#game-waveStart) |
| `GAME_CUES.waveEnd` | 360 | [game-waveEnd](../src/motion/gallery.html#game-waveEnd) |
| `GAME_CUES.victory` | 600 | [game-victory](../src/motion/gallery.html#game-victory) |
| `GAME_CUES.defeat` | 600 | [game-defeat](../src/motion/gallery.html#game-defeat) |
| `GAME_CUES.income` | 200 | [game-income](../src/motion/gallery.html#game-income) |
| `UI_CUES.purchase` | 200 | [ui-purchase](../src/motion/gallery.html#ui-purchase) |
| `UI_CUES.reject` | 180 | [ui-reject](../src/motion/gallery.html#ui-reject) |
| `UI_CUES.unlock` | 350 | [ui-unlock](../src/motion/gallery.html#ui-unlock) |
| `UI_CUES.levelUp` | 500 | [ui-levelUp](../src/motion/gallery.html#ui-levelUp) |
| `UI_CUES.reward` | 320 | [ui-reward](../src/motion/gallery.html#ui-reward) |
| `UI_CUES.open` | 240 | [ui-open](../src/motion/gallery.html#ui-open) |
| `UI_CUES.close` | 200 | [ui-close](../src/motion/gallery.html#ui-close) |
| `UI_CUES.select` | 160 | [ui-select](../src/motion/gallery.html#ui-select) |
| `UI_CUES.respec` | 280 | [ui-respec](../src/motion/gallery.html#ui-respec) |
| `EXTRA_CUES.ghost` | 180 | [extra-ghost](../src/motion/gallery.html#extra-ghost) |
| `EXTRA_CUES.idle` | 1200 | [extra-idle](../src/motion/gallery.html#extra-idle) |
| `EXTRA_CUES.aim` | 160 | [extra-aim](../src/motion/gallery.html#extra-aim) |
| `EXTRA_CUES.reload` | 280 | [extra-reload](../src/motion/gallery.html#extra-reload) |
| `EXTRA_CUES.move` | 160 | [extra-move](../src/motion/gallery.html#extra-move) |
| `EXTRA_CUES.turn` | 160 | [extra-turn](../src/motion/gallery.html#extra-turn) |
| `EXTRA_CUES.split` | 240 | [extra-split](../src/motion/gallery.html#extra-split) |
| `EXTRA_CUES.debit` | 200 | [extra-debit](../src/motion/gallery.html#extra-debit) |
| `EXTRA_CUES.xp` | 320 | [extra-xp](../src/motion/gallery.html#extra-xp) |
| `EXTRA_CUES.seals` | 320 | [extra-seals](../src/motion/gallery.html#extra-seals) |
| `EXTRA_CUES.medal` | 500 | [extra-medal](../src/motion/gallery.html#extra-medal) |
| `EXTRA_CUES.upgradeMid` | 600 | [extra-upgradeMid](../src/motion/gallery.html#extra-upgradeMid) |
| `EXTRA_CUES.upgradeFinal` | 1150 | [extra-upgradeFinal](../src/motion/gallery.html#extra-upgradeFinal) |

## Проверки

- `npx vitest run tests/motion/motion.test.ts` — интеграционный запуск тех же независимых 16 case-функций в проекте.
- `npm run check` — обязательная общая проверка после интеграции.
- Локально выполнены `tsc --strict --target ES2022 --module commonjs --moduleResolution node --outDir /tmp/motion83-build src/motion/index.ts tests/motion/cases.ts` и запуск всех 16 `motionCases` в Node 22: 16/16. Проверка браузерного TS: `tsc --strict --target ES2022 --module ES2022 --moduleResolution bundler --outDir /tmp/motion83-browser src/motion/gallery.ts`.
- Chromium/Playwright: standalone HTML из тех же compiled TS, 44 карточки, пауза замораживает game time при продолжении UI time, ReducedMotion без движения, переключатели FPS/скорости, без pageerror. Снимок визуально просмотрен.
- Проверки локальные, на встроенном frozen contract; `npm run check` и Vitest в полном checkout не запускались (shell не смог разрешить github.com). Не заявлена проверка конечной игры, 450 реальных моделей, 4K или performance полного поля. Лимиты проверены по числу записей, не по профилю GC браузера.
