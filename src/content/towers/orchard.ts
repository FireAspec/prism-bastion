import type {AttackDef, EffectDef, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const root = '/art/towers/orchard/';
const visual = (asset: string, accent: string, motion: VisualState['motion'], glow: number): VisualState => ({
  asset: `${root}${asset}.svg`, accent, muzzle: '#f7e7ac', projectile: accent,
  impact: '#fff2c6', scale: 1, glow, motion,
});

function effect(id: string, kind: EffectDef['kind'], power: number, radius = 0,
  interval = 0, cap = 0, extra: Partial<EffectDef> = {}): EffectDef {
  return {id, kind, power, radius, interval, duration: 0, cap, ...extra};
}
const income = (power: number): EffectDef => effect('orchard-fruit', 'income', power);
const tempo = (power: number, radius: number): EffectDef =>
  effect('orchard-tempo', 'aura', power, radius, 0, 0, {stat: 'attackSpeed'});
const detection = (radius: number): EffectDef =>
  effect('orchard-lantern', 'aura', 1, radius, 0, 0, {stat: 'detect'});
const thorns = (damage: number, radius: number, interval: number, slow = 0): EffectDef =>
  effect('orchard-thorns', 'trap', damage, radius, interval, 0, {
    element: 'kinetic',
    ...(slow > 0 ? {status: {kind: 'slow', power: slow, duration: 1.4, maxStacks: 1}} : {}),
  });

const inert: AttackDef = {
  mode: 'pulse', element: 'electric', damage: 0, interval: 1, range: 0,
  pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [], projectileSpeed: 0,
  projectileRadius: 0, homing: false, windup: 0, arc: 0,
};
function pulse(damage: number, interval: number, range: number, stun = 0): AttackDef {
  return {...inert, damage, interval, range, pierce: 18, shieldMultiplier: 1.3,
    statuses: stun > 0 ? [{kind: 'stun', power: 1, duration: stun, maxStacks: 1}] : []};
}
function ring(damage: number, interval: number, range: number, slow: number, marked = false): AttackDef {
  return {...inert, mode: 'ring', element: 'kinetic', damage, interval, range,
    pierce: 32, armorPierce: marked ? 6 : 2,
    statuses: [{kind: 'slow', power: slow, duration: 1.6, maxStacks: 1},
      ...(marked ? [{kind: 'mark' as const, power: 0.1, duration: 2.5, maxStacks: 1}] : [])]};
}
function upgrade(path: 'a'|'b'|'c', tier: 1|2|3|4|5, name: string, description: string,
  cost: number, accent: string, effects: EffectDef[],
  extra: Partial<Pick<UpgradeDef, 'replaceAttack'|'delta'|'abilities'|'addStatuses'>> = {}): UpgradeDef {
  return {id: `orchard-${path}${tier}`, name, description, cost, tier,
    delta: {}, effects, visual: visual(`${path}${tier}`, accent,
      path === 'a' ? 'breathe' : path === 'b' ? 'pulse' : 'rotate', 0.18 + tier * 0.12), ...extra};
}

/** Fresh, independently mutable tower definition for the frozen content API. */
export function getTower(): TowerDef {
  return {
    id: 'orchard', name: 'Искровой сад',
    description: 'Медные корни выращивают световые плоды: сад приносит 30 кредитов после каждой волны. Урожай, электричество или колючая оборона.',
    category: 'economy', cost: 700, footprint: 25, placement: 'land',
    attack: {...inert, statuses: []}, effects: [income(30)], abilities: [],
    visual: visual('base', '#e5e889', 'breathe', 0.16),
    paths: [
      {
        id: 'orchard-harvest', name: 'Урожай',
        description: 'Надёжный доход, ограниченная премия за защиту сада и восстановление маяка.',
        upgrades: [
          upgrade('a', 1, 'Золотые почки', 'Доход возрастает с 30 до 75 кредитов за волну.',
            335, '#f4cf61', [income(75)]),
          upgrade('a', 2, 'Сборщики росы', '140 кредитов за волну; рядом с садом убийства приносят +10% награды, максимум 70 за волну.',
            665, '#fad473', [income(140), effect('orchard-pollen', 'harvest', 0.1, 125, 0, 70)]),
          upgrade('a', 3, 'Тройной привой', 'Три плодоносящих кроны: 290 кредитов за волну, бонус за убийства +12% (максимум 140).',
            1665, '#ffe283', [income(290), effect('orchard-pollen', 'harvest', 0.12, 140, 0, 140)]),
          upgrade('a', 4, 'Сад четырёх сезонов', '620 кредитов за волну, +15% за убийства (максимум 250) и +7% урона соседним башням в радиусе 150.',
            3990, '#f9cf6b', [income(620), effect('orchard-pollen', 'harvest', 0.15, 155, 0, 250),
              effect('orchard-nourish', 'aura', 0.07, 150, 0, 0, {stat: 'damage'})]),
          upgrade('a', 5, 'Пять солнцеплодов', 'Пять сияющих деревьев: 1450 за волну, +20% за убийства (до 500), +16% урона соседям и восстановление 3 жизней в конце волны (не в режимах с лимитом 1).',
            9975, '#ffe993', [income(1450), effect('orchard-pollen', 'harvest', 0.2, 180, 0, 500),
              effect('orchard-nourish', 'aura', 0.16, 180, 0, 0, {stat: 'damage'}),
              effect('orchard-restoration', 'barrier', 3, 0, 0, 3)]),
        ],
      },
      {
        id: 'orchard-energized', name: 'Энергосад',
        description: 'Электрические корни разгоняют соседние башни, раскрывают скрытых врагов и создают импульсы.',
        upgrades: [
          upgrade('b', 1, 'Проводящие корни', 'Аура +8% скорости атаки союзным башням в радиусе 120; источник себя не ускоряет.',
            350, '#7bf1ec', [tempo(0.08, 120)]),
          upgrade('b', 2, 'Фонари-светляки', '+13% скорости атаки в радиусе 140 и обнаружение скрытых врагов для соседних башен в радиусе 140.',
            700, '#7ef8e8', [tempo(0.13, 140), detection(140)]),
          upgrade('b', 3, 'Искровая листва', '+20% скорости атаки в радиусе 155; электрический импульс 12 урона каждые 2.3 с в радиусе 100.',
            1750, '#66eafa', [tempo(0.2, 155), detection(155)], {replaceAttack: pulse(12, 2.3, 100)}),
          upgrade('b', 4, 'Грозовая крона', '+29% скорости и +8% дальности соседям в радиусе 175; импульс 27 урона каждые 1.8 с, радиус 122.',
            4200, '#7edcf9', [tempo(0.29, 175), detection(175),
              effect('orchard-reach', 'aura', 0.08, 175, 0, 0, {stat: 'range'})],
            {replaceAttack: pulse(27, 1.8, 122)}),
          upgrade('b', 5, 'Древо живой молнии', '+42% скорости, +15% дальности, раскрытие скрытых в радиусе 200; импульс 60 урона раз в 1.2 с, краткий стан 0.18 с. Активная «Грозовая подпитка»: усиление 8% на 10 с, откат 80 с.',
            10500, '#a7faff', [tempo(0.42, 200), detection(200),
              effect('orchard-reach', 'aura', 0.15, 200, 0, 0, {stat: 'range'})],
            {replaceAttack: pulse(60, 1.2, 148, 0.18),
              abilities: [{id: 'orchard-storm-feed', name: 'Грозовая подпитка',
                description: 'Ускорение союзников в радиусе 200 на 8% на 10 секунд, перезарядка 80 секунд.',
                cooldown: 80, kind: 'overclock', power: 0.08, duration: 10,
                radius: 200, element: 'electric'}]}),
        ],
      },
      {
        id: 'orchard-thornkeep', name: 'Шиповник',
        description: 'Колючие ловушки превращаются в ударные кольца, сохраняя небольшой доход.',
        upgrades: [
          upgrade('c', 1, 'Медные шипы', 'Около сада ловушка наносит 9 кинетического урона раз в 3 с в радиусе 75.',
            390, '#ed9a79', [thorns(9, 75, 3)]),
          upgrade('c', 2, 'Живые плети', 'Ловушка наносит 19 урона раз в 2.5 с в радиусе 95 и замедляет на 18% на 1.4 с.',
            775, '#f4ad85', [thorns(19, 95, 2.5, 0.18)]),
          upgrade('c', 3, 'Шипастый бастион', 'Кольцо: 38 урона раз в 2.1 с в радиусе 110, замедление 23%; ловушка 26/2.2 с и +40 дохода за волну.',
            1930, '#ffc18c', [thorns(26, 105, 2.2, 0.18), effect('orchard-rosehip', 'income', 40)],
            {replaceAttack: ring(38, 2.1, 110, 0.23)}),
          upgrade('c', 4, 'Бронзовые тернии', 'Кольцо: 94 урона раз в 1.65 с, радиус 133, замедление 28%; ловушка 38/1.9 с, +85 дохода за волну.',
            4625, '#ffba78', [thorns(38, 120, 1.9, 0.22), effect('orchard-rosehip', 'income', 85)],
            {replaceAttack: ring(94, 1.65, 133, 0.28)}),
          upgrade('c', 5, 'Крепость алых терний', 'Широкое кольцо 220 урона раз в 1.1 с (радиус 160), замедляет на 35%, метит врагов; внутренняя ловушка 65/1.5 с, +150 дохода за волну и активный шиповый взрыв 450 урона раз в 65 с.',
            11555, '#ffd3a2', [thorns(65, 145, 1.5, 0.27), effect('orchard-rosehip', 'income', 150)],
            {replaceAttack: ring(220, 1.1, 160, 0.35, true),
              abilities: [{id: 'orchard-thorn-nova', name: 'Алый венец',
                description: 'Мгновенная шиповая волна: 450 кинетического урона в радиусе 170, откат 65 секунд.',
                cooldown: 65, kind: 'nova', power: 450, duration: 0,
                radius: 170, element: 'kinetic'}]}),
        ],
      },
    ],
  };
}
