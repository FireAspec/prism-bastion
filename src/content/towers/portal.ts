import type {AttackDef, EffectDef, StatDelta, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ART = '/art/towers/portal/';
const colors = {a: '#a997ff', b: '#ffb272', c: '#79f5d6'} as const;

function visual(asset: string, accent: string, motion: VisualState['motion'] = 'pulse', glow = 1): VisualState {
  return {asset: `${ART}${asset}.svg`, accent, muzzle: 'portal-aperture',
    projectile: 'rift-comet', impact: 'rift-ripple', scale: 1, glow, motion};
}

function attack(change: Partial<AttackDef> = {}): AttackDef {
  return {mode: 'shot', element: 'energy', damage: 5, interval: 1.8, range: 170,
    pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
    detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
    executeBelow: 0, push: 0, statuses: [], projectileSpeed: 285,
    projectileRadius: 5, homing: true, windup: 0.12, arc: 0, ...change};
}

function effect(id: string, kind: EffectDef['kind'], power: number, change: Partial<EffectDef>): EffectDef {
  return {id, kind, power, radius: 0, interval: 0, duration: 0, cap: 0, ...change};
}

function upgrade(path: 'a' | 'b' | 'c', tier: 1 | 2 | 3 | 4 | 5,
  name: string, description: string, cost: number, delta: StatDelta,
  extra: Partial<Pick<UpgradeDef, 'replaceAttack' | 'addStatuses' | 'effects' | 'abilities'>> = {},
): UpgradeDef {
  return {id: `portal-${path}${tier}`, name, description, cost, tier, delta, ...extra,
    visual: visual(`${path}${tier}`, colors[path], tier >= 3 ? (path === 'c' ? 'orbit' : 'rotate') : 'pulse',
      tier === 5 ? 1.8 : 0.8 + tier * 0.15)};
}

const PORTAL: TowerDef = {
  id: 'portal', name: 'Портальная арка',
  description: 'Посылает энергетические импульсы сквозь пространственный проём. Петля задерживает врагов, Разлом взрывает их, Курьер усиливает соседей.',
  category: 'tech', cost: 1350, footprint: 26, placement: 'land',
  attack: attack(), effects: [], abilities: [], visual: visual('base', '#69f5db', 'breathe'),
  paths: [
    {id: 'portal-loop', name: 'Петля',
      description: 'Откатывает врага по маршруту, соблюдая личный иммунитет к повторному возврату.',
      upgrades: [
        upgrade('a', 1, 'Направляющие прилива',
          'Дальность +12%; импульс отталкивает на 5 пикселей.',
          780, {rangeMul: 1.12, pushAdd: 5}),
        upgrade('a', 2, 'Знак повторения',
          'Интервал −12%; попадание помечает цель на 1,8 с (+10% входящего урона).',
          1555, {intervalMul: 0.88},
          {addStatuses: [{kind: 'mark', power: 0.1, duration: 1.8, maxStacks: 1}]}),
        upgrade('a', 3, 'Обратный порог',
          'Возврат на 55 пикселей в радиусе 185 раз в 6 с; иммунитет цели 9 с.',
          3885, {damageMul: 1.4},
          {effects: [effect('portal-return', 'portal', 55, {radius: 185, interval: 6, duration: 9, cap: 1})]}),
        upgrade('a', 4, 'Спираль памяти',
          'Возврат 85 пикселей / 4,7 с в радиусе 210; иммунитет 8 с. Медлит врагов на 20% в течение 1,5 с.',
          9315, {rangeMul: 1.1, intervalMul: 0.88},
          {addStatuses: [{kind: 'slow', power: 0.2, duration: 1.5, maxStacks: 1}],
            effects: [effect('portal-return', 'portal', 85, {radius: 210, interval: 4.7, duration: 8, cap: 1})]}),
        upgrade('a', 5, 'Двойная арка бесконечности',
          'Возврат 135 пикселей / 3,5 с в радиусе 235; иммунитет 7 с. Цепь по 3 целям и активная перемотка на 165 пикселей (55 с).',
          23290, {bossMultiplierMul: 1.2},
          {replaceAttack: attack({mode: 'chain', damage: 29, interval: 1.25, range: 235,
              chains: 2, chainRadius: 100, projectileSpeed: 0, projectileRadius: 0,
              homing: false, windup: 0.18, statuses: [{kind: 'mark', power: 0.1, duration: 2, maxStacks: 1}]}),
            effects: [effect('portal-return', 'portal', 135, {radius: 235, interval: 3.5, duration: 7, cap: 1})],
            abilities: [{id: 'portal-grand-rewind', name: 'Вторая попытка',
              description: 'Возвращает цели в радиусе 235 на 165 пикселей с защитой от повторного контроля.',
              kind: 'rewind', power: 165, duration: 0, radius: 235, cooldown: 55, element: 'energy'}]}),
      ]},
    {id: 'portal-rift', name: 'Разлом',
      description: 'Превращает трещину в разрастающееся поле энергетических взрывов.',
      upgrades: [
        upgrade('b', 1, 'Резонанс трещины',
          'Урон энергетического импульса +30%, скорость полёта снаряда +25%.',
          675, {damageMul: 1.3, projectileSpeedMul: 1.25}),
        upgrade('b', 2, 'Осколочный концентратор',
          'Пробивание брони +3, урон щитам ×1,2, радиус взрыва +14 пикселей.',
          1350, {armorPierceAdd: 3, shieldMultiplierMul: 1.2, splashAdd: 14}),
        upgrade('b', 3, 'Рваная кромка',
          'Взрыв 26 урона раз в 1,55 с, радиус 48; снимает 3 брони на 3 с.',
          3375, {rangeMul: 1.06},
          {replaceAttack: attack({mode: 'splash', damage: 26, interval: 1.55, range: 190,
            splash: 48, projectileSpeed: 320, projectileRadius: 7, windup: 0.2,
            statuses: [{kind: 'shred', power: 3, duration: 3, maxStacks: 1}]})}),
        upgrade('b', 4, 'Каскад обломков',
          'Взрыв 49 урона раз в 1,5 с, радиус 76, замедление 25% на 1,3 с; против боссов ×1,15.',
          8100, {bossMultiplierMul: 1.15},
          {replaceAttack: attack({mode: 'splash', damage: 49, interval: 1.5, range: 205,
            splash: 76, projectileSpeed: 300, projectileRadius: 9, windup: 0.24,
            statuses: [{kind: 'shred', power: 4, duration: 3.5, maxStacks: 1},
              {kind: 'slow', power: 0.25, duration: 1.3, maxStacks: 1}]})}),
        upgrade('b', 5, 'Сердце открытого разлома',
          'Кольцевая детонация 95 урона раз в 1,75 с, область 110. Эхо 35% урона / 3,4 с максимум по 4 целям.',
          20250, {bossMultiplierMul: 1.25},
          {replaceAttack: attack({mode: 'pulse', damage: 95, interval: 1.75, range: 220,
            splash: 110, pierce: 4, projectileSpeed: 0, projectileRadius: 0,
            homing: false, windup: 0.32, statuses: [
              {kind: 'shred', power: 6, duration: 4, maxStacks: 1},
              {kind: 'slow', power: 0.3, duration: 1.5, maxStacks: 1}] }),
            effects: [effect('portal-rift-echo', 'echo', 0.35,
              {radius: 220, interval: 3.4, duration: 0, cap: 4, element: 'energy'})]}),
      ]},
    {id: 'portal-courier', name: 'Курьер',
      description: 'Транспортные кольца увеличивают дальность и скорость атаки соседних башен, но не усиливают себя.',
      upgrades: [
        upgrade('c', 1, 'Линза навигации',
          'Дальность +18%; обнаружение скрытых врагов.',
          645, {rangeMul: 1.18, detects: true}),
        upgrade('c', 2, 'Экспресс-канал',
          'Интервал энергетической атаки −17%, множитель урона боссам ×1,12.',
          1285, {intervalMul: 0.83, bossMultiplierMul: 1.12}),
        upgrade('c', 3, 'Курьерская орбита',
          'Союзники в радиусе 190 получают +10% дальности и +10% скорости атаки.',
          3210, {rangeMul: 1.08},
          {effects: [
            effect('portal-courier-range', 'aura', 0.1, {stat: 'range', radius: 190}),
            effect('portal-courier-speed', 'aura', 0.1, {stat: 'attackSpeed', radius: 190})]}),
        upgrade('c', 4, 'Узловая пересылка',
          'Ауры +16% дальности и темпа в радиусе 230; цепной энергетический выстрел по двум целям.',
          7695, {intervalMul: 0.85},
          {replaceAttack: attack({mode: 'chain', damage: 18, interval: 1.25, range: 210,
              chains: 1, chainRadius: 105, homing: false, projectileSpeed: 0,
              projectileRadius: 0, windup: 0.15}),
            effects: [
              effect('portal-courier-range', 'aura', 0.16, {stat: 'range', radius: 230}),
              effect('portal-courier-speed', 'aura', 0.16, {stat: 'attackSpeed', radius: 230})]}),
        upgrade('c', 5, 'Три кольца горизонта',
          'Ауры +22% дальности и +24% темпа в радиусе 265. Цепь по 4 целям и перегрузка союзников на 7 с раз в 70 с.',
          19240, {rangeMul: 1.08},
          {replaceAttack: attack({mode: 'chain', damage: 31, interval: 1.05, range: 235,
              chains: 3, chainRadius: 135, homing: false, projectileSpeed: 0,
              projectileRadius: 0, windup: 0.12,
              statuses: [{kind: 'reveal', power: 1, duration: 3, maxStacks: 1}]}),
            effects: [
              effect('portal-courier-range', 'aura', 0.22, {stat: 'range', radius: 265}),
              effect('portal-courier-speed', 'aura', 0.24, {stat: 'attackSpeed', radius: 265})],
            abilities: [{id: 'portal-courier-overclock', name: 'Срочная доставка',
              description: 'Ускоряет соседние башни в радиусе 240 на 7 секунд.',
              kind: 'overclock', power: 0.3, duration: 7, radius: 240,
              cooldown: 70, element: 'energy'}]}),
      ]},
  ],
};

/** Each call returns independent gameplay data for the catalog and replay snapshots. */
export function getTower(): TowerDef {
  return structuredClone(PORTAL);
}
