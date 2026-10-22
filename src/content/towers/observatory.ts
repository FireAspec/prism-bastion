import type {AttackDef, EffectDef, StatDelta, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ROOT = '/art/towers/observatory/';

/** Support bonuses belong to allies only; combat applies its global per-stat caps. */
function aura(id: string, stat: NonNullable<EffectDef['stat']>, power: number, radius: number): EffectDef {
  return {id, kind: 'aura', stat, power, radius, interval: 0, duration: 0, cap: 0};
}

function attack(patch: Partial<AttackDef> = {}): AttackDef {
  return {
    mode: 'pulse', element: 'energy', damage: 0, interval: 1, range: 190,
    pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
    detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
    executeBelow: 0, push: 0, statuses: [], projectileSpeed: 420,
    projectileRadius: 3, homing: false, windup: 0, arc: 360,
    ...patch,
  };
}

function appearance(asset: string, accent: string, motion: VisualState['motion'], glow: number): VisualState {
  return {asset: `${ROOT}${asset}.svg`, accent, muzzle: 'star', projectile: 'ray',
    impact: 'rings', scale: 1, glow, motion};
}

function upgrade(
  path: 'a'|'b'|'c', tier: 1|2|3|4|5, name: string, description: string, cost: number,
  delta: StatDelta, options: {replaceAttack?: AttackDef; effects?: EffectDef[]} = {},
): UpgradeDef {
  const accents = {a: '#83f5eb', b: '#ffd17d', c: '#ceafff'};
  return {
    id: `observatory-${path}${tier}`, tier, name, description, cost, delta,
    ...options,
    visual: appearance(`${path}${tier}`, accents[path], tier === 5 ? 'orbit' : tier >= 3 ? 'rotate' : 'breathe',
      0.32 + tier * 0.12),
  };
}

/** New object graph on each call; consumers are free to clone/resolve without leaking state. */
export function getTower(): TowerDef {
  return {
    id: 'observatory', name: 'Обсерватория', category: 'support', placement: 'land',
    description: 'Медная станция наблюдения. Уже без улучшений обнаруживает скрытые цели для союзных башен в радиусе 190.',
    cost: 650, footprint: 26,
    attack: attack(),
    effects: [aura('observatory-detection', 'detect', 1, 190)],
    abilities: [],
    visual: appearance('base', '#95e7db', 'breathe', 0.30),
    paths: [
      {
        id: 'observatory-a', name: 'Всевидящее око',
        description: 'Широкая сеть обнаружения, подсветка врагов и управление линией обзора.',
        upgrades: [
          upgrade('a', 1, 'Выдвижной окуляр',
            'Дальность собственных импульсов ×1,03. Союзные башни в радиусе 205 получают +8% дальности.',
            310, {rangeMul: 1.03}, {effects: [aura('observatory-a-range', 'range', .08, 205)]}),
          upgrade('a', 2, 'Сеть ночных линз',
            'Обнаружение для союзников расширено с 190 до 275. Собственные импульсы видят скрытых врагов.',
            620, {detects: true}, {effects: [aura('observatory-detection', 'detect', 1, 275)]}),
          upgrade('a', 3, 'Луч дальнего дозора',
            'Всенаправленный энергетический импульс: 5 урона раз в 2,2 с, радиус 305; раскрытие скрытых на 5 с. Обнаружение союзников — 320.',
            1545, {}, {
              replaceAttack: attack({mode: 'ring', damage: 5, interval: 2.2, range: 305,
                detects: true, statuses: [{kind: 'reveal', power: 1, duration: 5}]}),
              effects: [aura('observatory-detection', 'detect', 1, 320), aura('observatory-a-range', 'range', .10, 260)],
            }),
          upgrade('a', 4, 'Меридиан хранителей',
            'Кольцевой импульс: 10 урона / 1,8 с, радиус 355, раскрытие на 7 с. Обнаружение 390, +12% дальности и +11% темпа союзникам.',
            3705, {}, {
              replaceAttack: attack({mode: 'ring', damage: 10, interval: 1.8, range: 355,
                detects: true, statuses: [{kind: 'reveal', power: 1, duration: 7}]}),
              effects: [aura('observatory-detection', 'detect', 1, 390),
                aura('observatory-a-range', 'range', .12, 320), aura('observatory-a-speed', 'attackSpeed', .11, 320)],
            }),
          upgrade('a', 5, 'Небосвод без тайн',
            'Раскрытый купол испускает круговую волну: 18 урона / 1,35 с, радиус 455 и раскрытие на 10 с. Обнаружение 500; союзникам +16% дальности и +15% темпа.',
            9265, {}, {
              replaceAttack: attack({mode: 'ring', damage: 18, interval: 1.35, range: 455,
                detects: true, statuses: [{kind: 'reveal', power: 1, duration: 10}]}),
              effects: [aura('observatory-detection', 'detect', 1, 500),
                aura('observatory-a-range', 'range', .16, 400), aura('observatory-a-speed', 'attackSpeed', .15, 390)],
            }),
        ],
      },
      {
        id: 'observatory-b', name: 'Балистика',
        description: 'Наведение соседних орудий и пробивающие расчётные лучи.',
        upgrades: [
          upgrade('b', 1, 'Дальномерные дуги',
            'Дальность собственных атак ×1,10; союзникам в радиусе 210 +10% дальности.',
            325, {rangeMul: 1.10}, {effects: [aura('observatory-b-range', 'range', .10, 210)]}),
          upgrade('b', 2, 'Таблица поправок',
            'Собственным атакам +2 бронепробития; союзным башням в радиусе 220 +3 бронепробития.',
            650, {armorPierceAdd: 2}, {effects: [aura('observatory-b-armor', 'armorPierce', 3, 220)]}),
          upgrade('b', 3, 'Параллакс',
            'Прямой луч: 14 урона / 1,8 с, дальность 340, 3 цели, 9 пробития и ×1,15 против боссов. Союзникам +15% дальности, +6 пробития.',
            1625, {}, {
              replaceAttack: attack({mode: 'beam', element: 'kinetic', damage: 14, interval: 1.8,
                range: 340, pierce: 3, armorPierce: 9, bossMultiplier: 1.15}),
              effects: [aura('observatory-b-range', 'range', .15, 280),
                aura('observatory-b-armor', 'armorPierce', 6, 280)],
            }),
          upgrade('b', 4, 'Нулевая погрешность',
            'Прямой луч: 22 урона / 1,6 с, дальность 390, 5 целей, 16 пробития, ×1,35 боссам. Союзникам +21% дальности, +10 пробития.',
            3900, {}, {
              replaceAttack: attack({mode: 'beam', element: 'kinetic', damage: 22, interval: 1.6,
                range: 390, pierce: 5, armorPierce: 16, bossMultiplier: 1.35}),
              effects: [aura('observatory-b-range', 'range', .21, 330),
                aura('observatory-b-armor', 'armorPierce', 10, 330)],
            }),
          upgrade('b', 5, 'Астролябия горизонта',
            'Два независимых пробивающих луча: по 55 урона / 1,25 с, дальность 520, до 9 целей каждый, 28 пробития, ×1,6 боссам. Союзникам +28% дальности, +20 пробития.',
            9750, {}, {
              replaceAttack: attack({mode: 'beam', element: 'kinetic', damage: 55, interval: 1.25,
                range: 520, pierce: 9, count: 2, armorPierce: 28, bossMultiplier: 1.6}),
              effects: [aura('observatory-b-range', 'range', .28, 410),
                aura('observatory-b-armor', 'armorPierce', 20, 410)],
            }),
        ],
      },
      {
        id: 'observatory-c', name: 'Звёздная печать',
        description: 'Маркировка опасных целей, усиление союзного урона и цепи звёздных связей.',
        upgrades: [
          upgrade('c', 1, 'Карта созвездий',
            'Собственным атакам ×1,03 урона; союзным башням в радиусе 210 +6% урона.',
            360, {damageMul: 1.03}, {effects: [aura('observatory-c-damage', 'damage', .06, 210)]}),
          upgrade('c', 2, 'Ритм эфемерид',
            'Интервал своих атак ×0,96; союзным башням в радиусе 220 +8% скорости атаки.',
            720, {intervalMul: .96}, {effects: [aura('observatory-c-speed', 'attackSpeed', .08, 220)]}),
          upgrade('c', 3, 'Именная звезда',
            'Луч по выбранной цели: 12 урона / 1,7 с, дальность 265. Накладывает метку +10% входящего урона на 3,5 с; союзникам +10% урона.',
            1790, {}, {
              replaceAttack: attack({mode: 'beam', damage: 12, interval: 1.7, range: 265,
                bossMultiplier: 1.2, statuses: [{kind: 'mark', power: .10, duration: 3.5}]}),
              effects: [aura('observatory-c-damage', 'damage', .10, 265)],
            }),
          upgrade('c', 4, 'Венец орбит',
            'Цепной луч: 19 урона / 1,45 с, дальность 300, 2 перехода по 95. Метка +10% на 5 с; союзникам +15% урона и +14% темпа.',
            4295, {}, {
              replaceAttack: attack({mode: 'chain', damage: 19, interval: 1.45, range: 300,
                chains: 2, chainRadius: 95, bossMultiplier: 1.3,
                statuses: [{kind: 'mark', power: .10, duration: 5}]}),
              effects: [aura('observatory-c-damage', 'damage', .15, 320),
                aura('observatory-c-speed', 'attackSpeed', .14, 320)],
            }),
          upgrade('c', 5, 'Печать тысячи звёзд',
            'Две цепи лучей по 34 урона / 1,2 с, дальность 390, по 6 переходов в радиусе 155. Метки +10% на 8 с, ×1,6 по боссам; союзникам +24% урона и +20% темпа.',
            10730, {}, {
              replaceAttack: attack({mode: 'chain', damage: 34, interval: 1.2, range: 390,
                count: 2, chains: 6, chainRadius: 155, bossMultiplier: 1.6,
                statuses: [{kind: 'mark', power: .10, duration: 8}]}),
              effects: [aura('observatory-c-damage', 'damage', .24, 410),
                aura('observatory-c-speed', 'attackSpeed', .20, 410)],
            }),
        ],
      },
    ],
  };
}
