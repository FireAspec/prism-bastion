import type {AttackDef, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ROOT = '/art/towers/tesla/';

function visual(id: string, accent: string, motion: VisualState['motion'], glow: number): VisualState {
 return {
  asset: `${ROOT}${id}.svg`, accent, muzzle: 'electric-corona',
  projectile: id.startsWith('b') ? 'ion-ribbon' : id.startsWith('c') ? 'shock-ring' : 'fork-lightning',
  impact: id.startsWith('b') ? 'ion-shear' : id.startsWith('c') ? 'thunder-ripple' : 'electric-burst',
  scale: 1, glow, motion,
 };
}

const electric: AttackDef = {
 mode: 'chain', element: 'electric', damage: 17, interval: 1.1, range: 170,
 pierce: 1, count: 1, splash: 0, chains: 1, chainRadius: 64,
 detects: false, armorPierce: 0, shieldMultiplier: 1.1, bossMultiplier: 1,
 executeBelow: 0, push: 0, statuses: [],
 projectileSpeed: 0, projectileRadius: 3, homing: false, windup: 0, arc: 0,
};

const wet: StatusSpec = {kind: 'wet', power: 0.2, duration: 3};
const mark: StatusSpec = {kind: 'mark', power: 0.1, duration: 3.6};
const stun = (duration: number): StatusSpec => ({kind: 'stun', power: 1, duration});

function upgrade(
 id: string, tier: UpgradeDef['tier'], name: string, description: string,
 cost: number, accent: string, motion: VisualState['motion'],
 delta: UpgradeDef['delta'], extras: Pick<UpgradeDef, 'replaceAttack' | 'addStatuses' | 'effects' | 'abilities'> = {},
): UpgradeDef {
 return {id: `tesla-${id}`, tier, name, description, cost, delta, ...extras,
  visual: visual(id, accent, motion, tier === 5 ? 0.98 : 0.32 + tier * 0.12)};
}

const tower: TowerDef = {
 id: 'tesla', name: 'Катушка Теслы',
 description: 'Медная катушка выпускает электрический разряд по цели и одному соседу. Развивается в грозовую сеть, ионную резку или громовой резонатор.',
 category: 'element', cost: 800, footprint: 26, placement: 'land',
 attack: electric, effects: [], abilities: [], visual: visual('base', '#8af3ff', 'pulse', 0.34),
 paths: [
  {
   id: 'tesla-a', name: 'Грозовая сеть',
   description: 'Медное дерево проводников, чьи дуги перепрыгивают между множеством целей.',
   upgrades: [
    upgrade('a1', 1, 'Дополнительный громоотвод',
     'Ещё один переход цепи, +18 px к длине прыжка и +8% к дальности.',
     445, '#72dbff', 'pulse', {chainsAdd: 1, chainRadiusAdd: 18, rangeMul: 1.08}),
    upgrade('a2', 2, 'Омеднённый резонатор',
     '+12% урона, атаки на 6% чаще; разряды накладывают намокание 20% на 3 с.',
     885, '#69ecdf', 'breathe', {damageMul: 1.12, intervalMul: 0.94}, {addStatuses: [wet]}),
    upgrade('a3', 3, 'Разветвлённые каналы',
     '+2 перехода цепи, +24 px к прыжку и +28% урона.',
     2205, '#6bf1ff', 'orbit', {chainsAdd: 2, chainRadiusAdd: 24, damageMul: 1.28}),
    upgrade('a4', 4, 'Крона штормов',
     '+2 перехода, +17% дальности, +20% урона и на 14% меньше интервал.',
     5285, '#c5f7ff', 'orbit', {chainsAdd: 2, rangeMul: 1.17, damageMul: 1.2, intervalMul: 0.86}),
    upgrade('a5', 5, 'Древо тысячи молний',
     'Два независимых цепных разряда, +4 перехода и +30% урона. Эхо повторяет 42% атаки через 1.5 с по максимум двум целям в радиусе 128 px.',
     13205, '#f2ffff', 'orbit', {countAdd: 1, chainsAdd: 4, damageMul: 1.3, chainRadiusAdd: 40},
     {effects: [{id: 'tesla-network-echo', kind: 'echo', power: 0.42, radius: 128,
       interval: 1.5, duration: 0, cap: 2, element: 'electric'}]}),
   ],
  },
  {
   id: 'tesla-b', name: 'Ионный резак',
   description: 'Пробивной ионный луч с полярными дугами, меткой и разрушением щитов.',
   upgrades: [
    upgrade('b1', 1, 'Нож полярности',
     '+35% множителя урона щитам и +4 к пробитию брони.',
     400, '#8fe8fb', 'pulse', {shieldMultiplierMul: 1.35, armorPierceAdd: 4}),
    upgrade('b2', 2, 'Спектральный анализатор',
     'Обнаружение скрытых; попадание помечает цель на 3.6 с с силой 10%.',
     800, '#f4fff2', 'breathe', {detects: true}, {addStatuses: [mark]}),
    upgrade('b3', 3, 'Ионный скальпель',
     'Цепь превращается в пробивной луч: базовое пробитие 3, затем +2, +45% урона, +6 бронипробития, +25% урона щитам.',
     2000, '#b5faff', 'pulse', {damageMul: 1.45, pierceAdd: 2, armorPierceAdd: 6, shieldMultiplierMul: 1.25},
     {replaceAttack: {...electric, mode: 'beam', pierce: 3, chains: 0, chainRadius: 0, windup: 0}}),
    upgrade('b4', 4, 'Белая линия разлома',
     '+2 цели на луч, +25% урона, интервал −18%, множитель урона щитам +20%.',
     4800, '#eaffff', 'breathe', {pierceAdd: 2, damageMul: 1.25, intervalMul: 0.82, shieldMultiplierMul: 1.2}),
    upgrade('b5', 5, 'Двухполюсный разрядник',
     'Два одновременных ионных луча, ещё +5 пробитий и +32% урона. Активная ионная вспышка: 340 урона в 165 px, откат 45 с.',
     12000, '#ffffff', 'pulse', {countAdd: 1, pierceAdd: 5, damageMul: 1.32},
     {abilities: [{id: 'tesla-ion-flare', name: 'Ионная вспышка',
       description: 'Мгновенная электрическая вспышка: 340 урона в радиусе 165 px; перезарядка 45 с.',
       kind: 'nova', cooldown: 45, power: 340, duration: 0, radius: 165, element: 'electric'}]}),
   ],
  },
  {
   id: 'tesla-c', name: 'Громовой колокол',
   description: 'Концентрические ударные кольца удерживают толпу короткими импульсами.',
   upgrades: [
    upgrade('c1', 1, 'Ударный противовес',
     'Разряды отталкивают на 8 px и получают +6% дальности.',
     380, '#ffd485', 'pulse', {pushAdd: 8, rangeMul: 1.06}),
    upgrade('c2', 2, 'Искровой язычок',
     'Каждое попадание оглушает на 0.22 с, интервал атаки −6%.',
     760, '#ffe7a3', 'breathe', {intervalMul: 0.94}, {addStatuses: [stun(0.22)]}),
    upgrade('c3', 3, 'Колокол резонанса',
     'Цепь становится кольцевой атакой: базовое пробитие 10 и радиус кольца 80 px, затем +4 пробития, +28 px площади, +30% урона.',
     1900, '#ffe6ad', 'pulse', {pierceAdd: 4, splashAdd: 28, damageMul: 1.3},
     {replaceAttack: {...electric, mode: 'ring', pierce: 10, chains: 0, chainRadius: 0, splash: 80, windup: 0.2}}),
    upgrade('c4', 4, 'Гармоники раската',
     '+34 px к кольцу, +20% урона, интервал −17%; оглушение усилено до 0.45 с.',
     4560, '#fff1cc', 'breathe', {splashAdd: 34, damageMul: 1.2, intervalMul: 0.83},
     {addStatuses: [stun(0.45)]}),
    upgrade('c5', 5, 'Соборный гром',
     'Два концентрических импульса, +55 px к кольцу и +35% урона. Эхо 35% через 2 с, до двух целей в радиусе 100 px; активный громовой удар 260 урона в 210 px / 55 с.',
     11400, '#fffefd', 'pulse', {countAdd: 1, splashAdd: 55, damageMul: 1.35},
     {addStatuses: [stun(0.7)],
      effects: [{id: 'tesla-thunder-echo', kind: 'echo', power: 0.35, radius: 100,
        interval: 2, duration: 0, cap: 2, element: 'electric'}],
      abilities: [{id: 'tesla-thunder-peal', name: 'Небесный раскат',
        description: 'Электрический импульс: 260 урона в радиусе 210 px; перезарядка 55 с.',
        kind: 'nova', cooldown: 55, power: 260, duration: 0, radius: 210, element: 'electric'}]}),
   ],
  },
 ],
};

/** Each caller receives a completely independent catalog entry (including nested effects). */
export function getTower(): TowerDef {
 return structuredClone(tower);
}
