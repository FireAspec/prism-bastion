import type {AbilityDef, AttackDef, EffectDef, TowerDef, UpgradeDef, VisualState} from '../../contracts';

type AuraStat = NonNullable<EffectDef['stat']>;
type Tier = 1 | 2 | 3 | 4 | 5;
type Branch = 'a' | 'b' | 'c';

/** Stable effect IDs replace weaker versions in the combat resolver. */
function aura(stat: AuraStat, power: number, radius: number, source = ''): EffectDef {
 return {id: `forge-${source}${stat}`, kind: 'aura', stat, power, radius, interval: 0, duration: 0, cap: 0};
}

function view(asset: string, accent: string, motion: VisualState['motion'], glow: number): VisualState {
 return {
  asset: `/art/towers/forge/${asset}.svg`, accent,
  muzzle: 'forge-embers', projectile: asset.startsWith('c') && Number(asset.slice(1)) >= 3 ? 'forge-heat-ring' : 'none', impact: 'forge-sparks',
  scale: 1, glow, motion,
 };
}

function upgrade(
 branch: Branch, tier: Tier, cost: number, name: string, description: string,
 effects: EffectDef[], options?: {abilities?: AbilityDef[]; motion?: VisualState['motion']; attack?: AttackDef},
): UpgradeDef {
 const accent = branch === 'a' ? '#f9b855' : branch === 'b' ? '#84ecd3' : '#ff8060';
 return {
  id: `forge-${branch}${tier}`, tier, cost, name, description, delta: {}, effects,
  ...(options?.abilities ? {abilities: options.abilities} : {}),
  ...(options?.attack ? {replaceAttack: options.attack} : {}),
  visual: view(`${branch}${tier}`, accent, options?.motion ?? 'breathe', 0.18 + tier * 0.12),
 };
}

function pulse(damage: number, interval: number, range: number, detects = false): AttackDef {
 return {
  mode: 'pulse', element: 'fire', damage, interval, range,
  pierce: 1, count: 1, splash: range, chains: 0, chainRadius: 0,
  detects, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [], projectileSpeed: 0,
  projectileRadius: 0, homing: false, windup: 0, arc: 0,
 };
}

function overclock(power: number, duration: number, cooldown: number): AbilityDef {
 return {
  id: 'forge-overclock', name: 'Форсаж мехов', kind: 'overclock',
  description: `На ${duration} с собственные тепловые импульсы кузни ускоряются на ${Math.round(power * 100)}%. Аура темпа союзников не изменяется.`,
  power, duration, cooldown, radius: 0, element: 'fire',
 };
}

/** Every call returns a fresh, independent object graph. */
export function getTower(): TowerDef {
 return {
  id: 'forge', name: 'Полевая кузня',
  description: 'Наземная мастерская поддержки. Без атаки: соседние боевые постройки получают +6% урона в радиусе 145. Ауры не усиливают собственный источник и не складываются с аурами той же характеристики.',
  category: 'support', cost: 750, footprint: 25, placement: 'land',
  attack: {
   mode: 'pulse', element: 'kinetic', damage: 0, interval: 1, range: 145,
   pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
   detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
   executeBelow: 0, push: 0, statuses: [], projectileSpeed: 0,
   projectileRadius: 0, homing: false, windup: 0, arc: 0,
  },
  effects: [aura('damage', 0.06, 145)], abilities: [],
  visual: view('base', '#eeb46c', 'breathe', 0.24),
  paths: [
   {
    id: 'forge-armorer', name: 'Оружейник',
    description: 'Ковка оружия, пробой брони и боевой аванпост из трёх наковален.',
    upgrades: [
     upgrade('a', 1, 375, 'Калибровка бойка', 'Аура урона усиливается с +6% до +10% в радиусе 145.', [aura('damage', 0.10, 145)]),
     upgrade('a', 2, 750, 'Закалённое остриё', 'Аура бронепробития +3 в радиусе 145; сочетается с другими специализациями.', [aura('armorPierce', 3, 145)]),
     upgrade('a', 3, 1875, 'Двойной горн', 'Аура урона +18% и бронепробития +4, радиус обеих 155.', [aura('damage', 0.18, 155), aura('armorPierce', 4, 155)]),
     upgrade('a', 4, 4500, 'Молот бастиона', 'Аура урона +28% и бронепробития +6, радиус 170.', [aura('damage', 0.28, 170), aura('armorPierce', 6, 170)]),
     upgrade('a', 5, 11250, 'Три пылающих наковальни', 'Три рабочих поста: урон +40%, бронепробитие +9, обнаружение скрытых целей; радиус всех аур 190.', [aura('damage', 0.40, 190), aura('armorPierce', 9, 190), aura('detect', 1, 190)], {motion: 'pulse'}),
    ],
   },
   {
    id: 'forge-assembly', name: 'Сборочный цех',
    description: 'Улучшение охвата, локальная скидка на новые покупки и снабжение.',
    upgrades: [
     upgrade('b', 1, 395, 'Разметка конвейера', 'Соседние боевые постройки получают +8% дальности в радиусе 145.', [aura('range', 0.08, 145)]),
     upgrade('b', 2, 790, 'Стандартизация деталей', 'Локальная скидка 4% на покупки и улучшения в радиусе 145; собственную цену не снижает.', [aura('discount', 0.04, 145)]),
     upgrade('b', 3, 1970, 'Механическая линия', 'Локальная скидка 8%, бонус дальности +12%, радиус 155.', [aura('discount', 0.08, 155), aura('range', 0.12, 155)]),
     upgrade('b', 4, 4725, 'Цех точной сборки', 'Локальная скидка 11%, дальность соседей +16%, радиус 170.', [aura('discount', 0.11, 170), aura('range', 0.16, 170)]),
     upgrade('b', 5, 11815, 'Мастер-конвейер', 'Скидка 15%, дальность союзников +22% и обнаружение скрытых целей в радиусе 190; дополнительно 35 кредитов в конце волны, если пассивный доход разрешён.', [
      aura('discount', 0.15, 190), aura('range', 0.22, 190), aura('detect', 1, 190),
      {id: 'forge-supply', kind: 'income', power: 35, radius: 0, interval: 0, duration: 0, cap: 35},
     ], {motion: 'breathe'}),
    ],
   },
   {
    id: 'forge-overload', name: 'Перегрузка',
    description: 'Постоянное ускорение союзников и активный форсаж локальных тепловых импульсов.',
    upgrades: [
     upgrade('c', 1, 360, 'Ускоренный привод', 'Аура темпа +8% в радиусе 145; действует на боевые постройки, но не на эту кузню.', [aura('attackSpeed', 0.08, 145)]),
     upgrade('c', 2, 715, 'Вольфрамовые шестерни', 'Дополнительно аура бронепробития +2 в радиусе 145.', [aura('armorPierce', 2, 145, 'c-')]),
     upgrade('c', 3, 1785, 'Рычаг форсажа', 'Темп союзников +16% в радиусе 155. Тепловой импульс: 24 урона / 1,2 с, радиус 100. Форсаж своего импульса +20% на 6 с, cooldown 50 с.', [aura('attackSpeed', 0.16, 155)], {abilities: [overclock(0.20, 6, 50)], attack: pulse(24, 1.2, 100), motion: 'pulse'}),
     upgrade('c', 4, 4275, 'Меха высокого давления', 'Темп союзников +24% в радиусе 170. Импульс: 40 урона / 1,2 с, радиус 115. Форсаж своего импульса +32% на 8 с, cooldown 42 с.', [aura('attackSpeed', 0.24, 170)], {abilities: [overclock(0.32, 8, 42)], attack: pulse(40, 1.2, 115), motion: 'breathe'}),
     upgrade('c', 5, 10690, 'Сердце перегрузки', 'Темп союзников +35% и обнаружение в радиусе 190. Раскалённый импульс: 65 урона / 1,1 с, радиус 130, видит скрытых. Форсаж своего импульса +50% на 12 с, cooldown 32 с.', [aura('attackSpeed', 0.35, 190), aura('detect', 1, 190)], {abilities: [overclock(0.50, 12, 32)], attack: pulse(65, 1.1, 130, true), motion: 'pulse'}),
    ],
   },
  ],
 };
}
