# Prism Bastion: сетевой протокол v1

Версия протокола — `1`. Формат кадра — один текстовый WebSocket message, содержащий один объект JSON в UTF-8. Функции `parseClient(raw)`, `parseServer(raw)` и `encode(message)` доступны из `src/network/protocol/index.ts` и не требуют Node API, Electron, DOM или сторонних библиотек.

Валидация производится **до** передачи сообщения в игровую логику. Входной JSON проверяется на глубину/сложность, опасные ключи и строгое соответствие соответствующему варианту неизменяемого `ClientMessage`/`ServerMessage` из `src/contracts/index.ts`. `encode` выполняет такие же проверки для исходящих данных, не вызывая произвольный `toJSON` или геттеры объектов.

## Лимиты

| Параметр | Ограничение |
| --- | --- |
| Команды клиента, join/ready/start/ping | 16 384 байта UTF-8 |
| Прочие ответы сервера (welcome/room/result/runResult/error/pong) | 16 384 байта UTF-8 |
| Серверный snapshot | 2 097 152 байта UTF-8 |
| Имя игрока | 1–24 Unicode code points |
| Пароль комнаты | 0–128 Unicode code points |
| Идентификаторы, включая `runId`, `playerId`, `tower` | 1–128 Unicode code points |
| `contentDigest` | 64 шестнадцатеричных символа SHA-256 |
| `resumeToken` | Непрозрачная строка длиной 1–256 символов |
| Команды одного клиента | Не более 30 за скользящие 1000 мс |
| JSON | Не более 32 уровней вложенности, 300 000 узлов, 8192 элементов в одном массиве, 4096 ключей на объект, 32 768 UTF-16 единиц на строку |
| Живые враги в snapshot | Не более 1800 |

Размер проверяется по реальной UTF-8 сериализации, а не по числу символов JS. Snapshot также проверяется изнутри: поля, перечисления, ресурсы, игровые события, статусы, снаряды, атаки и удары. Тиры башен должны соблюдать правила `legalTiers`, включая варианты `5–2–0`. Координаты и числовые таймеры должны быть конечными; деньги, HP, щиты и счётчики ресурсов не могут быть отрицательными. Незнакомые поля (в том числе `actor`, `requestId` внутри игрового действия и дополнительные поля управления) отвергаются.

## Клиент → хост

| `type` | Поля | Назначение |
| --- | --- | --- |
| `join` | `protocolVersion:1`, `contentDigest`, `name`, `password`, `resumeToken?`, `knowledge?` | Первое сообщение или восстановление слота |
| `command` | `seq` (положительное безопасное целое), `command: GameAction` | Только намерение; хост сам определяет игрока |
| `ready` | `value:boolean` | Готовность к следующей волне |
| `start` | — | Запрос начать забег |
| `ping` | `at:number` | Проверка соединения |

`GameAction` имеет ровно один из вариантов:

- `place(tower,pos)`; `upgrade(tower,path)` (path 0, 1 или 2); `sell(tower)`;
- `target(tower,targeting)` (first/last/strong/near); `ability(tower,ability)`;
- `startWave`; `pause(value)`; `speed(value)` (1, 2 или 3); `autoStart(value)`.

Пример кадра:

```json
{"type":"command","seq":42,"command":{"type":"upgrade","tower":"t17","path":1}}
```

## Хост → клиент

| `type` | Поля | Назначение |
| --- | --- | --- |
| `welcome` | `playerId`, `resumeToken`, `room` | Выделенный слот и секрет восстановления |
| `room` | `room` | Актуальный состав/готовность/настройки |
| `snapshot` | `seq`, `state:GameState`, `events:GameEvent[]` | Авторитетный снимок, ориентир 10 Гц |
| `result` | `seq`, `result:CommandResult` | Подтверждение или отказ по команде |
| `runResult` | `result:RunResult` | Завершение забега (профиль сам обеспечивает дедупликацию `runId`) |
| `error` | `code`, `message` | Машинная причина и текст по-русски |
| `pong` | `at` | Ответ на ping |

Игровые события не являются источником денежных операций на клиенте: деньги, награды и авторитетный результат приходят от хоста. Только `result.ok === true` подтверждает успешную команду; `pending` в локальном UI не является подтверждением. Клиент интерполирует позиции, не пересчитывает урон.

## Обработка на хосте

```ts
import {
  parseClient,encode,assertJoinCompatible,
  createSequenceGuard,createCommandRateLimiter,ProtocolError,
} from './network/protocol';

// Для каждого WebSocket-соединения создаются отдельные guard и limiter.
const sequence=createSequenceGuard();
const rate=createCommandRateLimiter();

function handle(raw:string,nowMs:number,authenticatedPlayerId:string,expectedDigest:string) {
  try {
    const message=parseClient(raw);
    if(message.type==='join') {
      assertJoinCompatible(message,expectedDigest);
      // Затем проверить пароль/слот и привязать соединение к playerId.
    } else if(message.type==='command') {
      sequence.accept(message.seq);
      rate.accept(nowMs);
      // Отдельно проверить права владельца башни и роль хоста.
      // actor устанавливается сервером, НЕ из JSON сообщения.
      dispatch({...message.command,actor:authenticatedPlayerId});
    }
  } catch(error) {
    if(error instanceof ProtocolError) {
      send(encode({type:'error',code:error.code,message:error.message}));
    } else throw error;
  }
}
```

`dispatch` и `send` выше — callbacks хоста, не функции протокола. Хост должен применять `assertJoinCompatible` до допуска в комнату и `start`, а также при reconnect. При неверной версии ответить `PROTOCOL_MISMATCH`, при другом дайджесте — `CONTENT_MISMATCH`; не запускать симуляцию. Дайджест вычисляет модуль контента, протокол лишь сравнивает его со значением хоста. Данные пользователя `knowledge` требуют отдельной проверки прав доступа/профиля; включение их в корректный JSON не подтверждает владение.

`createSequenceGuard` проверяет строго возрастающие seq (нулевой seq разрешён для первоначального snapshot; клиентские команды требуют seq > 0). Повторные, устаревшие и нецелые значения блокируются. Он не решает распределённое подтверждение доставки; после восстановления соединения хост должен восстановить нужную последовательность для сохранённого слота или явно начать новую сессию. `createCommandRateLimiter` принимает **хостовое монотонное время**, а не значение `ping.at` от клиента. При превышении лимита возвращается `RATE_LIMIT` без исполнения команды. Обе проверки выполняются до `dispatch`.

### Восстановление и секреты

- `resumeToken` выдаётся хостом из криптографически стойкого генератора случайных чисел, привязывается к playerId и не передаётся другим клиентам; сервер хранит время отключения и допускает восстановление не позднее 120 секунд.
- Ни токен, ни полный raw JSON с ним не записываются в логи. Исключения `ProtocolError` содержат только код и путь поля, без его значения.
- Токен проверяется хостом в дополнение к версии и digest; клиентские поля `actor` не принимаются. Сетевой протокол не является системой защиты от изменённого локального профиля.
- Хост гарантирует сериализацию покупок, права владельца башни, запреты pause/speed для гостя и неизменность набора игроков после старта. Валидный JSON сам по себе не означает авторизацию.

## Ошибки

`ProtocolError` — типизированное исключение с `code`, `path`, текстом `message` на русском. Коды: `INVALID_JSON`, `INVALID_TYPE`, `INVALID_NUMBER`, `OUT_OF_RANGE`, `INVALID_ENUM`, `UNKNOWN_FIELD`, `MISSING_FIELD`, `UNSAFE_KEY`, `TOO_COMPLEX`, `FRAME_TOO_LARGE`, `INVALID_SEQUENCE`, `REPLAYED_SEQUENCE`, `RATE_LIMIT`, `PROTOCOL_MISMATCH`, `CONTENT_MISMATCH`.

Ни пароли, ни токены, ни сырые кадры не попадают в текст исключений. Ошибки отдельных команд не должны прекращать хост для остальных игроков.

## Тестирование и границы модуля

- `npx vitest run tests/network/protocol` — round-trip всех 5 вариантов клиента, всех 7 вариантов сервера, всех 9 действий, валидные/невалидные fixtures, неизвестные поля, повреждённый JSON, fuzz, Unicode/размеры кадров, запреты небезопасных ключей, нечисловые значения, неправильные тиры/enum, replay и rate-limit.
- `npm run check` — общая проверка при наличии остальных модулей.
- В рамках этого модуля **не реализуются** WebSocket transport, рассылка 10 Гц, таймаут 120 секунд, генерация токена, проверка пароля, проверка прав и игровой диспетчер. Это обязанности `src/network/host` и `src/network/client`, для которых предоставлены проверяемые entry points.
- В будущем, если появятся новые поля состояния или новые `GameAction`, версия договора и runtime-схемы обновляются вместе. Самовольные добавления полей v1 не принимаются — иначе одна сторона могла бы скрыто управлять другой.
