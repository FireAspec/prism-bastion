import type {AttackDef, StatDelta, TowerDef, UpgradeDef, UpgradePath, VisualState} from '../../contracts';

const artRoot = '/art/towers/scatter/';

function visual(asset: string, accent: string, motion: VisualState['motion'] = 'none', glow = 0.25): VisualState {
  return {
    asset: `${artRoot}${asset}.svg`, accent,
    muzzle: asset.startsWith('b') ? 'scatter-heavy-flare' : asset.startsWith('c') ? 'scatter-ring-flare' : 'scatter-flare',
    projectile: asset.startsWith('b') && Number(asset[1]) >= 3 ? 'heavy-pellet' : asset.startsWith('c') && Number(asset[1]) >= 3 ? 'ring' : 'pearl-pellet',
    impact: asset.startsWith('b') ? 'armor-spark' : asset.startsWith('c') ? 'ring-spark' : 'kinetic-spark', scale: 1,
    glow, motion,
  };
}

const baseAttack: AttackDef = {
  mode: 'cone', element: 'kinetic', damage: 6, interval: 0.9, range: 115,
  pierce: 1, count: 5, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [], projectileSpeed: 330,
  projectileRadius: 2.4, homing: false, windup: 0.09, arc: 52,
};

function upgrade(
  path: 'a' | 'b' | 'c', tier: 1 | 2 | 3 | 4 | 5, name: string,
  description: string, cost: number, delta: StatDelta, accent: string,
  extra: Partial<Pick<UpgradeDef, 'replaceAttack' | 'addStatuses' | 'effects' | 'abilities'>> = {},
): UpgradeDef {
  return {
    id: `scatter-${path}${tier}`, name, description, cost, tier, delta,
    ...extra, visual: visual(`${path}${tier}`, accent, path === 'c' && tier >= 3 ? 'rotate' : tier >= 4 ? 'pulse' : 'none', 0.2 + tier * 0.12),
  };
}

// Replacements are pre-delta bases: combat applies ALL purchased deltas A→B→C.
// Preserve the advertised resolved T3 values without counting early upgrades twice.
const hunterChambers: AttackDef = {
  ...baseAttack, mode: 'shot', damage: 17 / 1.05, interval: 1.04, range: 119,
  count: 2, pierce: 2, arc: 16, armorPierce: 6,
  shieldMultiplier: 1, bossMultiplier: 1,
  projectileSpeed: 410 / 1.15, projectileRadius: 4.7, windup: 0.16,
};
const ringSentinel: AttackDef = {
  ...baseAttack, mode: 'ring', damage: 8 / 1.1, interval: 1.08, range: 128 / 1.11,
  count: 1, pierce: 1, arc: 360, push: 0,
  projectileSpeed: 270, projectileRadius: 2.7, windup: 0.07,
  detects: false,
};

const paths: [UpgradePath, UpgradePath, UpgradePath] = [
  {
    id: 'scatter-a', name: 'Ураган', description: 'Широкая плотная дробь и прорыв скоплений.',
    upgrades: [
      upgrade('a', 1, 'Шестая рейка', 'Ещё один снаряд (для круговой атаки — импульс) и дальность +4%.', 215,
        {countAdd: 1, rangeMul: 1.04}, '#7beddb'),
      upgrade('a', 2, 'Пробивная рейка', '+1 пробитие прямой атаки, интервал перезарядки на 6% меньше.', 425,
        {pierceAdd: 1, intervalMul: 0.94}, '#76f0de'),
      upgrade('a', 3, 'Стена дроби', 'Три дополнительные картечины, угол +20°, урон каждой +8%.', 1065,
        {countAdd: 3, arcAdd: 20, damageMul: 1.08}, '#89f7e0'),
      upgrade('a', 4, 'Двойной веер', 'Ещё две картечины и +12% дальности; каждая пробивает дополнительную цель.', 2550,
        {countAdd: 2, rangeMul: 1.12, pierceAdd: 1}, '#b5f4ff'),
      upgrade('a', 5, 'Перламутровый шквал', 'Раскрывает широкий веер: ещё пять картечин, угол +24°, интервал ×0.72; попадания замедляют на 7% на 0.6 с.', 6375,
        {countAdd: 5, arcAdd: 24, intervalMul: 0.72}, '#effcff', {
          addStatuses: [{kind: 'slow', power: 0.07, duration: 0.6, maxStacks: 1}],
        }),
    ],
  },
  {
    id: 'scatter-b', name: 'Охотник', description: 'Тяжёлая картечь для брони, щитов и боссов.',
    upgrades: [
      upgrade('b', 1, 'Стальная сердцевина', 'Игнорирует 2 единицы брони; +5% урона каждой картечины.', 195,
        {armorPierceAdd: 2, damageMul: 1.05}, '#ffb75f'),
      upgrade('b', 2, 'Щитобойный заряд', '+20% урона щитам, +12% боссам, скорость снаряда +15%.', 385,
        {shieldMultiplierMul: 1.2, bossMultiplierMul: 1.12, projectileSpeedMul: 1.15}, '#ff9960'),
      upgrade('b', 3, 'Парные камеры', 'Переходит на два тяжёлых узких заряда: 17 урона каждый, пробитие 2, игнорирование 8 единиц брони, интервал 1.04 с.', 960,
        {}, '#ff9557', {replaceAttack: hunterChambers}),
      upgrade('b', 4, 'Кузнечный разгон', 'Тяжёлый заряд: +45% урона и +1 пробитие.', 2295,
        {damageMul: 1.45, pierceAdd: 1}, '#ff6f41'),
      upgrade('b', 5, 'Трёхкамерный горн', 'Третья гигантская камера; +65% урона каждого ядра, +8 единиц пробития брони, ×1.3 к щитам и ×1.2 к боссам. Попадание снижает броню на 3 единицы на 2 с.', 5740,
        {countAdd: 1, damageMul: 1.65, armorPierceAdd: 8, shieldMultiplierMul: 1.3, bossMultiplierMul: 1.2}, '#fff2a2', {
          addStatuses: [{kind: 'shred', power: 3, duration: 2, maxStacks: 1}],
        }),
    ],
  },
  {
    id: 'scatter-c', name: 'Кольцевой караул', description: 'Постоянный охват подступов и отбрасывание.',
    upgrades: [
      upgrade('c', 1, 'Периметральный прицел', '+11% дальности и +0.6 отталкивания на попадание.', 235,
        {rangeMul: 1.11, pushAdd: 0.6}, '#95a3ff'),
      upgrade('c', 2, 'Бдительный привод', 'Интервал меньше на 10%, обнаружение скрытых целей, урон +10%.', 470,
        {intervalMul: 0.9, detects: true, damageMul: 1.1}, '#a4a5ff'),
      upgrade('c', 3, 'Октагон дозора', 'Открывает круговой импульс на 360°: 8 урона каждой цели в радиусе 128, интервал 0.972 с, отталкивание 0.6.', 1170,
        {}, '#b4a0ff', {replaceAttack: ringSentinel}),
      upgrade('c', 4, 'Роторная стена', 'Урон кругового импульса +35%, ×0.82 к интервалу и +12% дальности.', 2810,
        {damageMul: 1.35, intervalMul: 0.82, rangeMul: 1.12}, '#c6a6ff'),
      upgrade('c', 5, 'Венец восьми ветров', 'Два круговых импульса за залп, ×0.72 к интервалу, +1.1 отталкивания; замедление 18% на 0.8 с. Активный импульс: 42 урона в радиусе 120, откат 20 с.', 7015,
        {countAdd: 1, intervalMul: 0.72, pushAdd: 1.1}, '#e4ceff', {
          addStatuses: [{kind: 'slow', power: 0.18, duration: 0.8, maxStacks: 1}],
          abilities: [{id: 'scatter-wind-crown', name: 'Обратный шквал',
            description: 'Кинетическая круговая волна: 42 урона в радиусе 120.',
            cooldown: 20, kind: 'nova', power: 42, duration: 0, radius: 120, element: 'kinetic'}],
        }),
    ],
  },
];

/** Independent content objects prevent mutations leaking between games and tests. */
export function getTower(): TowerDef {
  return structuredClone({
    id: 'scatter', name: 'Веерный страж',
    description: 'Ближняя дробовая оборона. Широкий конус из пяти картечин; особенно силён на поворотах.',
    category: 'weapon', placement: 'land', cost: 425, footprint: 26,
    attack: baseAttack, effects: [], abilities: [],
    visual: visual('base', '#8de5d8', 'pulse', 0.25), paths,
  } satisfies TowerDef);
}
