import type {AbilityDef, AttackDef, EffectDef, StatDelta, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ROOT = '/art/towers/chrono/';

function visual(id: string, accent: string, motion: VisualState['motion'], glow = 0.25): VisualState {
  return {
    asset: `${ROOT}${id}.svg`, accent, muzzle: 'chrono-flash',
    projectile: id.startsWith('a') ? 'falling-second' : id.startsWith('c') ? 'reverse-hour' : 'clock-spark',
    impact: id.startsWith('a') ? 'time-ripple' : id.startsWith('c') ? 'rewind-ripple' : 'chrono-tick',
    scale: 1, glow, motion,
  };
}

function attack(overrides: Partial<AttackDef> = {}): AttackDef {
  return {
    mode: 'shot', element: 'energy', damage: 3, interval: 1.2, range: 165,
    pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
    detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
    executeBelow: 0, push: 0, statuses: [], projectileSpeed: 270,
    projectileRadius: 5, homing: true, windup: 0.08, arc: 0,
    ...overrides,
  };
}

function slow(power: number, duration: number): StatusSpec {
  return {kind: 'slow', power, duration, maxStacks: 1};
}

function reveal(duration: number): StatusSpec {
  return {kind: 'reveal', power: 1, duration, maxStacks: 1};
}

function aura(power: number, radius: number): EffectDef {
  return {id: 'chrono-tempo', kind: 'aura', stat: 'attackSpeed', power, radius,
    interval: 0, duration: 0, cap: 0};
}

function portal(power: number, radius: number, interval: number, duration: number): EffectDef {
  return {id: 'chrono-reversal', kind: 'portal', power, radius, interval, duration, cap: 1};
}

function rewind(power: number, radius: number, cooldown: number): AbilityDef {
  return {id: 'chrono-rewind', name: 'Обратный отсчёт',
    description: `Отбрасывает врагов в радиусе ${radius} на ${power} ед. пути; учитывая общий личный интервал защиты от возврата; боссы смещаются слабее.`,
    kind: 'rewind', power, duration: 0.5, radius, cooldown, element: 'energy'};
}

function upgrade(
  id: string, tier: 1 | 2 | 3 | 4 | 5, cost: number,
  name: string, description: string, delta: StatDelta,
  extras: {replaceAttack?: AttackDef; addStatuses?: StatusSpec[]; effects?: EffectDef[]; abilities?: AbilityDef[]} = {},
): UpgradeDef {
  const branch = id[0];
  const accent = branch === 'a' ? '#f3be6a' : branch === 'b' ? '#6cebe5' : '#cba2ff';
  const motion = branch === 'a' ? 'pulse' : branch === 'b' ? 'rotate' : 'orbit';
  return {id: `chrono-${id}`, tier, cost, name, description, delta, ...extras,
    visual: visual(id, accent, motion, tier === 5 ? 0.94 : 0.2 + tier * 0.12)};
}

/** A new data tree on every call: runtime upgrades must never mutate catalog data. */
export function getTower(): TowerDef {
  return {
    id: 'chrono', name: 'Хронобашня',
    description: 'Медный часовой механизм выпускает энергетические импульсы. Три пути управляют замедлением, темпом союзников и возвратом врагов.',
    category: 'tech', cost: 1000, footprint: 26, placement: 'land',
    attack: attack(), effects: [], abilities: [],
    visual: visual('base', '#f5c47e', 'rotate'),
    paths: [
      {
        id: 'chrono-a', name: 'Временная яма',
        description: 'Ловит время в разбитом циферблате: замедление, волны и удержание коридора.',
        upgrades: [
          upgrade('a1', 1, 500, 'Песчинка задержки',
            'Каждый выстрел замедляет цель на 16% на 1,6 с; только один стек от этой башни.',
            {}, {addStatuses: [slow(0.16, 1.6)]}),
          upgrade('a2', 2, 1000, 'Дальняя стрелка',
            'Дальность ×1,12; урон по боссам ×1,08. Усиливает любой основной путь.',
            {rangeMul: 1.12, bossMultiplierMul: 1.08}),
          upgrade('a3', 3, 2500, 'Воронка минут',
            'Энергетическая волна: 5 урона каждые 1,3 с, взрыв в радиусе 48 от точки контакта; замедление 28% на 3,2 с.',
            {}, {replaceAttack: attack({mode: 'splash', damage: 5, interval: 1.3,
              range: 170, splash: 48, projectileSpeed: 315, projectileRadius: 5,
              homing: false, windup: 0.18, statuses: [slow(0.28, 3.2)]})}),
          upgrade('a4', 4, 6000, 'Разлом хода',
            'Волна 8 урона каждые 1,1 с, взрыв в радиусе 70 от точки контакта; замедление 38% на 4,5 с.',
            {}, {replaceAttack: attack({mode: 'splash', damage: 8, interval: 1.1,
              range: 180, splash: 70, projectileSpeed: 350, projectileRadius: 6,
              homing: false, windup: 0.14, statuses: [slow(0.38, 4.5)]})}),
          upgrade('a5', 5, 15000, 'Разбитая вечность',
            'Расколотый циферблат: волна 17 урона каждые 0,85 с, взрыв в радиусе 98; замедление 55% на 7 с. Каждая атака создаёт одно цепное эхо (45% урона, задержка 1,7 с плюс замах, до 5 целей).',
            {}, {replaceAttack: attack({mode: 'splash', damage: 17, interval: 0.85,
              range: 198, splash: 98, projectileSpeed: 400, projectileRadius: 7,
              homing: false, windup: 0.1, statuses: [slow(0.55, 7)]}),
              effects: [{id: 'chrono-stopped-echo', kind: 'echo', power: 0.45,
                radius: 98, interval: 1.7, duration: 0, cap: 5}]})
        ],
      },
      {
        id: 'chrono-b', name: 'Ускоритель',
        description: 'Синхронизирует оборону: быстрые снаряды, ускоряющая аура, тройной часовой венец.',
        upgrades: [
          upgrade('b1', 1, 550, 'Сжатая секунда',
            'Интервал атаки ×0,88 (на 13,64% больше атак); действует на любой основной путь.',
            {intervalMul: 0.88}),
          upgrade('b2', 2, 1100, 'Заводная пружина',
            'Урон ×1,18; скорость снарядов ×1,25, включая вторичный путь.',
            {damageMul: 1.18, projectileSpeedMul: 1.25}),
          upgrade('b3', 3, 2750, 'Общий такт',
            'Союзные башни в радиусе 135 получают +15% скорости атак. Источник аурой не усиливается.',
            {}, {replaceAttack: attack({damage: 4.5, interval: 1.05, range: 175,
              projectileSpeed: 340}), effects: [aura(0.15, 135)]}),
          upgrade('b4', 4, 6600, 'Роторный ансамбль',
            'Аура +28% скорости атак в радиусе 175; собственная атака становится цепной: 2 перехода на 75.',
            {}, {replaceAttack: attack({mode: 'chain', damage: 7, interval: 0.95,
              range: 185, chains: 2, chainRadius: 75, projectileSpeed: 390}),
              effects: [aura(0.28, 175)]}),
          upgrade('b5', 5, 16500, 'Три венца мгновения',
            'Три вращающихся венца дают союзникам +42% скорости атак в радиусе 215. Цепная молния времени: два независимых разряда, до пяти переходов на 100 каждый.',
            {}, {replaceAttack: attack({mode: 'chain', damage: 11, interval: 0.72,
              range: 205, count: 2, chains: 5, chainRadius: 100,
              projectileSpeed: 520, projectileRadius: 6}),
              effects: [aura(0.42, 215)]}),
        ],
      },
      {
        id: 'chrono-c', name: 'Откат',
        description: 'Отмечает уязвимые цели и возвращает прогресс врагов вдоль маршрута, создавая пространство для второго залпа.',
        upgrades: [
          upgrade('c1', 1, 500, 'Обратная шестерня',
            'Метка прошлого на 1,8 с: цель получает на 10% больше входящего урона от всех башен. Не расходует защиту от отката.',
            {}, {addStatuses: [{kind: 'mark', power: 0.1, duration: 1.8, maxStacks: 1}]}),
          upgrade('c2', 2, 1000, 'Метка вчера',
            'Атаки обнаруживают скрытых врагов и раскрывают цель на 2,5 с; дальность ×1,08.',
            {detects: true, rangeMul: 1.08}, {addStatuses: [reveal(2.5)]}),
          upgrade('c3', 3, 2500, 'Точка возврата',
            'Петля в радиусе 175 возвращает одного доступного врага на 48 ед. пути раз в 7 с с личной защитой от повторения.',
            {}, {replaceAttack: attack({damage: 5, interval: 1.0, range: 180,
              projectileSpeed: 315}), effects: [portal(48, 175, 7, 4)]}),
          upgrade('c4', 4, 6000, 'Петля против хода',
            'Автооткат одного доступного врага на 85 ед. пути в радиусе 195 раз в 6 с; активная способность 110 ед. в радиусе 150, перезарядка 32 с.',
            {}, {replaceAttack: attack({damage: 8, interval: 0.9, range: 195,
              projectileSpeed: 350}), effects: [portal(85, 195, 6, 4.5)],
              abilities: [rewind(110, 150, 32)]}),
          upgrade('c5', 5, 15000, 'Пески вспять',
            'Гигантские часы возвращают одного доступного врага на 140 ед. пути в радиусе 225 раз в 4,8 с. Активный откат: 190 ед. в радиусе 220 раз в 24 с. Кольцевой удар по всей дальности (базово 150, с C2 — 162) замедляет на 22% на 3 с.',
            {}, {replaceAttack: attack({mode: 'ring', damage: 13, interval: 0.8,
              range: 150, splash: 0, projectileSpeed: 0,
              projectileRadius: 0, homing: false, windup: 0.1,
              statuses: [slow(0.22, 3)]}),
              effects: [portal(140, 225, 4.8, 3.8)],
              abilities: [rewind(190, 220, 24)]}),
        ],
      },
    ],
  };
}
