import type {AttackDef, EffectDef, StatDelta, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

type Path = 'a' | 'b' | 'c';
type Tier = 1 | 2 | 3 | 4 | 5;

const status = (kind: StatusSpec['kind'], power: number, duration: number, maxStacks: number): StatusSpec =>
 ({kind, power, duration, maxStacks});

const art = '/art/towers/venom/';
function visual(name: string, accent: string, projectile: string, impact: string, tier = 0): VisualState {
 return {asset: `${art}${name}.svg`, accent, muzzle: 'acid-nozzle', projectile, impact,
  scale: 1, glow: 0.18 + tier * 0.12, motion: tier === 5 ? 'orbit' : tier > 2 ? 'pulse' : 'breathe'};
}

function upgrade(path: Path, tier: Tier, name: string, description: string, cost: number,
 delta: StatDelta, accent: string, projectile: string, impact: string,
 extras: Pick<UpgradeDef, 'addStatuses' | 'effects' | 'abilities'> = {}): UpgradeDef {
 return {id: `venom-${path}${tier}`, name, description, cost, tier, delta, ...extras,
  visual: visual(`${path}${tier}`, accent, projectile, impact, tier)};
}

/** Upgrading C3→C4→C5 replaces this effect by id; bursts never multiply themselves. */
function outbreak(power: number, radius: number): EffectDef {
 return {id: 'venom-outbreak', kind: 'deathBurst', power, radius,
  interval: 0, duration: 0, cap: 0, element: 'acid'};
}

const attack: AttackDef = {
 mode: 'splash', element: 'acid', damage: 6, interval: 0.9, range: 165,
 pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
 detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
 executeBelow: 0, push: 0, statuses: [status('poison', 2, 3, 2)],
 projectileSpeed: 255, projectileRadius: 5, homing: true, windup: 0.08, arc: 0,
};

const tower: TowerDef = {
 id: 'venom', name: 'Алхимическая колба', category: 'element', cost: 650,
 description: 'Кислотные капли отравляют цели. Три школы: чёрные споры, растворение защиты и смертельная эпидемия.',
 footprint: 25, placement: 'land', attack, effects: [], abilities: [],
 visual: visual('base', '#a1eca9', 'venom-drop', 'venom-hiss'),
 paths: [
  {id: 'venom-black-garden', name: 'Чёрный сад',
   description: 'Накопление слоёв яда; на вершине — пять живых колб и четыре взрывные капли за залп.', upgrades: [
    upgrade('a', 1, 'Корневой экстракт', 'Дальность ×1,08; яд: мощность 2,8, 4 с, 2 слоя.',
     325, {rangeMul: 1.08}, '#a3efac', 'root-drop', 'root-fizz',
     {addStatuses: [status('poison', 2.8, 4, 2)]}),
    upgrade('a', 2, 'Мицелиевый распылитель', 'Радиус взрыва +17; интервал ×0,94; яд 3,5 / 4,5 с / 3 слоя.',
     650, {splashAdd: 17, intervalMul: 0.94}, '#7bdda0', 'spore-cloud', 'mycelium-ring',
     {addStatuses: [status('poison', 3.5, 4.5, 3)]}),
    upgrade('a', 3, 'Чёрные споры', 'Урон ×1,20, радиус взрыва +8; яд 5 / 6 с / 5 слоёв.',
     1625, {damageMul: 1.2, splashAdd: 8}, '#54ca85', 'black-spore', 'spore-crackle',
     {addStatuses: [status('poison', 5, 6, 5)]}),
    upgrade('a', 4, 'Пятикамерный перегон', 'Интервал ×0,78; +1 капля за залп, радиус +9; яд 7 / 8 с / 6 слоёв.',
     3900, {intervalMul: 0.78, countAdd: 1, splashAdd: 9}, '#36bd7a', 'twin-bloom', 'garden-pulse',
     {addStatuses: [status('poison', 7, 8, 6)]}),
    upgrade('a', 5, 'Сердце чёрного сада', '+2 капли, радиус +20, дальность ×1,18; яд 11 / 11 с / 8 слоёв. Чёрное цветение: 46 урона в радиусе 135, откат 45 с.',
     9750, {countAdd: 2, splashAdd: 20, rangeMul: 1.18},
     '#1fdc79', 'garden-drop-volley', 'black-garden-bloom', {
      addStatuses: [status('poison', 11, 11, 8)],
      abilities: [{id: 'venom-flowering', name: 'Чёрное цветение', description: 'Разовая волна: 46 кислотного урона в радиусе 135.',
       cooldown: 45, kind: 'nova', power: 46, duration: 0, radius: 135, element: 'acid'}],
     }),
   ]},
  {id: 'venom-solvent', name: 'Растворитель',
   description: 'Прожигает броню и щиты; финальный чан испускает широкие струи.', upgrades: [
    upgrade('b', 1, 'Кислотный калибратор', 'Пробивание брони +1,5, множитель урона щиту ×1,15, скорость капли ×1,10.',
     345, {armorPierceAdd: 1.5, shieldMultiplierMul: 1.15, projectileSpeedMul: 1.1},
     '#fad87c', 'bright-acid', 'shield-etch'),
    upgrade('b', 2, 'Шлаковая эмульсия', 'Пробивание брони +2, множитель щита ×1,30; снятие 1,5 брони на 3 с.',
     685, {armorPierceAdd: 2, shieldMultiplierMul: 1.3}, '#f6ba60', 'ceramic-spray', 'slag-melt',
     {addStatuses: [status('shred', 1.5, 3, 1)]}),
    upgrade('b', 3, 'Керамический растворитель', 'Урон ×1,20, радиус взрыва +8, щит ×1,35; снятие 3 брони на 5 с.',
     1710, {damageMul: 1.2, splashAdd: 8, shieldMultiplierMul: 1.35},
     '#ffb764', 'solvent-jet', 'armor-fracture', {addStatuses: [status('shred', 3, 5, 1)]}),
    upgrade('b', 4, 'Многосопловый реактор', '+1 струя за залп, радиус +20, пробивание брони +4, щит ×1,35; снятие 4 брони на 6 с.',
     4095, {countAdd: 1, splashAdd: 20, armorPierceAdd: 4, shieldMultiplierMul: 1.35},
     '#ffa650', 'double-nozzle', 'ceramic-spill', {addStatuses: [status('shred', 4, 6, 1)]}),
    upgrade('b', 5, 'Белый тигель', '+1 струя, радиус +30, пробивание брони +9, щит ×1,60, интервал ×0,76; снятие 6 брони на 8 с; союзникам в 135 +2 пробивания брони. Кислотная волна 80 / радиус 145 / 50 с.',
     10240, {countAdd: 1, splashAdd: 30, armorPierceAdd: 9,
      shieldMultiplierMul: 1.6, intervalMul: 0.76},
     '#fff0a6', 'cauldron-trident', 'white-acid-surge', {
      addStatuses: [status('shred', 6, 8, 1)],
      effects: [{id: 'venom-corrosion-field', kind: 'aura', stat: 'armorPierce', power: 2,
       radius: 135, interval: 0, duration: 0, cap: 0}],
      abilities: [{id: 'venom-solvent-wave', name: 'Перелив тигля',
       description: 'Разовая волна: 80 базового кислотного урона в радиусе 145 с пробиванием брони и множителем щита башни.',
       cooldown: 50, kind: 'nova', power: 80, duration: 0, radius: 145, element: 'acid'}],
     }),
   ]},
  {id: 'venom-epidemic', name: 'Эпидемия',
   description: 'Ядовитые носители; гибель цели, заражённой ядом этой башни, вызывает взрыв.', upgrades: [
    upgrade('c', 1, 'Пыльца проводников', 'Интервал ×0,91, скорость капли ×1,20; яд 2,4 / 3,5 с / 2 слоя.',
     310, {intervalMul: 0.91, projectileSpeedMul: 1.2}, '#b6a8ff', 'violet-vector', 'vector-dust',
     {addStatuses: [status('poison', 2.4, 3.5, 2)]}),
    upgrade('c', 2, 'Носитель штамма', 'Дальность ×1,10, радиус капли +13; яд 3 / 4 с / 3 слоя.',
     620, {rangeMul: 1.1, splashAdd: 13}, '#a793f7', 'strain-sphere', 'strain-ring',
     {addStatuses: [status('poison', 3, 4, 3)]}),
    upgrade('c', 3, 'Первичная вспышка', 'Урон ×1,12; яд 4 / 5 с / 4 слоя; гибель заражённого собственным ядом: 28 урона в радиусе 46.',
     1545, {damageMul: 1.12}, '#9d81ee', 'viral-lance', 'outbreak-small',
     {addStatuses: [status('poison', 4, 5, 4)], effects: [outbreak(28, 46)]}),
    upgrade('c', 4, 'Сеть заражения', 'Интервал ×0,82, радиус +18, яд 6 / 7 с / 5 слоёв; смертельный взрыв 60 урона в радиусе 72.',
     3705, {intervalMul: 0.82, splashAdd: 18}, '#8968e4', 'branching-strain', 'outbreak-large',
     {addStatuses: [status('poison', 6, 7, 5)], effects: [outbreak(60, 72)]}),
    upgrade('c', 5, 'Пандемониум', '+1 капля, радиус +22, дальность ×1,12, щит ×1,10; яд 9 / 9 с / 7 слоёв; гибель заражённого: 120 урона в радиусе 110. Волна 65 / радиус 160 / 55 с.',
     9265, {countAdd: 1, splashAdd: 22, rangeMul: 1.12, shieldMultiplierMul: 1.1},
     '#d5a7ff', 'pandemonium-vessel', 'pandemic-surge', {
      addStatuses: [status('poison', 9, 9, 7)], effects: [outbreak(120, 110)],
      abilities: [{id: 'venom-pandemic-wave', name: 'Волна штамма',
       description: 'Разовая волна: 65 базового кислотного урона в радиусе 160 с боевыми модификаторами башни.',
       cooldown: 55, kind: 'nova', power: 65, duration: 0, radius: 160, element: 'acid'}],
     }),
   ]},
 ],
};

/** Detached data: runtime resolution and knowledge application must not mutate the catalog. */
export function getTower(): TowerDef { return structuredClone(tower); }
