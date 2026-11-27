# Баллистика

Вертикальная доктрина из 30 узлов. `getKnowledge()` возвращает независимые записи контракта v1. Эффекты — доли; `weaponSpeed` ускоряет темп атаки, не полёт снаряда. Все scopes ограничены конкретными ID. В `iron-oath` сервис прогресса отключает знания целиком. Продажа, жизни, стоимость и доход не меняются.

## Узлы

| № | Имя | Уровень | Печати | Эффекты (процентные пункты / ID) |
|---:|---|---:|---:|---|
| 1 | Пристрелка | 1 | 30 | weaponDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 2 | Полированные каналы | 1 | 35 | weaponSpeed +1% (needle, scatter, saw) |
| 3 | Надёжный затвор | 1 | 40 | weaponSpeed +1% (cannon, rail, mortar, rocket) |
| 4 | Дальний прицел | 1 | 50 | weaponRange +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 5 | Школа залпа | 1 | 55 | weaponDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone); weaponSpeed +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 6 | Тяжёлый сердечник | 5 | 65 | weaponDamage +2% (cannon, rail, mortar, rocket) |
| 7 | Мягкая отдача | 5 | 75 | weaponSpeed +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 8 | Разведка траектории | 5 | 85 | weaponRange +1% (drone, rocket, rail) |
| 9 | Охотник на панцирь | 5 | 95 | bossDamage +1% (cannon, rail, mortar, rocket) |
| 10 | Полевой баллистик | 5 | 105 | weaponDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone); weaponRange +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 11 | Двойная направляющая | 9 | 120 | weaponRange +1% (needle, scatter, saw) |
| 12 | Сменный барабан | 9 | 130 | weaponSpeed +1% (drone, rocket, rail) |
| 13 | Чистый срез | 9 | 145 | weaponDamage +2% (needle, scatter, saw) |
| 14 | Точный дальномер | 9 | 160 | weaponRange +2% (cannon, rail, mortar, rocket) |
| 15 | Командир батареи | 9 | 170 | weaponSpeed +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone); bossDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 16 | Дисковая сталь | 13 | 190 | weaponDamage +2% (scatter, saw) |
| 17 | Рельсовая геометрия | 13 | 205 | weaponRange +1% (rail) |
| 18 | Разрывной конус | 13 | 220 | weaponDamage +2% (cannon, mortar, rocket) |
| 19 | Кольцевой обстрел | 13 | 240 | weaponSpeed +1% (scatter, saw) |
| 20 | Мастер артиллерии | 13 | 255 | weaponDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone); bossDamage +1% (cannon, rail, mortar, rocket) |
| 21 | Тяжёлый залп | 17 | 275 | weaponDamage +2% (cannon, rail, mortar, rocket) |
| 22 | Выверенный рикошет | 17 | 295 | weaponRange +1% (needle, scatter, saw) |
| 23 | Сжатая пружина | 17 | 315 | weaponSpeed +2% (needle) |
| 24 | Ветер в спину | 17 | 335 | weaponRange +1% (drone, rocket, rail) |
| 25 | Орудийный расчёт | 17 | 355 | weaponSpeed +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone); weaponRange +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 26 | Прицельный сектор | 21 | 380 | weaponRange +2% (scatter, saw) |
| 27 | Кристальная игла | 21 | 400 | weaponDamage +2% (needle) |
| 28 | Охотничий рубеж | 21 | 425 | bossDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 29 | Единый залп | 21 | 450 | weaponDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone); weaponSpeed +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |
| 30 | Главный калибр | 21 | 470 | weaponDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone); weaponRange +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone); bossDamage +1% (needle, cannon, rail, scatter, saw, mortar, rocket, drone) |

## Суммы по башням

Порядок значений: урон / темп / дальность / урон по боссам, %. Бюджеты соответственно 15 / 12 / 10 / 6. Профили 5, 15, 30 узлов: ранний, средний, полный. Остальные 22 ID не затронуты. Доля bossDamage оставляет второй доктрине 6 процентных пунктов.

| ID | 5 | 15 | 30 |
|---|---|---|---|
| needle | 2 / 2 / 1 / 0 | 5 / 4 / 3 / 1 | 10 / 8 / 6 / 3 |
| cannon | 2 / 2 / 1 / 0 | 5 / 4 / 4 / 2 | 12 / 6 / 6 / 5 |
| rail | 2 / 2 / 1 / 0 | 5 / 5 / 5 / 2 | 10 / 7 / 9 / 5 |
| scatter | 2 / 2 / 1 / 0 | 5 / 4 / 3 / 1 | 10 / 7 / 8 / 3 |
| saw | 2 / 2 / 1 / 0 | 5 / 4 / 3 / 1 | 10 / 7 / 8 / 3 |
| mortar | 2 / 2 / 1 / 0 | 5 / 4 / 4 / 2 | 12 / 6 / 6 / 5 |
| rocket | 2 / 2 / 1 / 0 | 5 / 5 / 5 / 2 | 12 / 7 / 8 / 5 |
| drone | 2 / 1 / 1 / 0 | 3 / 4 / 3 / 1 | 6 / 6 / 6 / 3 |

Полная ветвь: 30 очков, 6170 печатей. Последовательность исключает циклы. Все эффекты положительны и каждый затронутый stat остаётся в бюджете, поэтому никакой узел не теряет эффект из-за насыщения этой доктриной.

## Интеграция

Значки — локальные SVG 64×64, пути относительно public. Сервис прогрессии отвечает за фильтрацию режима, cap, дедупликацию кооперативных ID и применение к атакам, включая replaceAttack. Категории weapon/tech указанных башен и фактическое применение проверяются при интеграции модулей. Локальные тесты используют независимую модель подсчёта, не заменяют проверку реального сервиса.
