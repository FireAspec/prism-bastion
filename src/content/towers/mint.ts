import type {AbilityDef, AttackDef, EffectDef, TowerDef, UpgradeDef, VisualState} from '../../contracts';

// Normal-difficulty prices and income, before the mode multiplier.
// Identical IDs intentionally replace lower-tier effects and abilities.
type Branch = 'a'|'b'|'c';
type Row = {cost:number; name:string; description:string; effects:EffectDef[]; abilities?:AbilityDef[]};
const assetRoot = '/art/towers/mint/';

function visual(file:string, branch?:Branch, tier = 0):VisualState {
  return {
    asset:`${assetRoot}${file}.svg`,
    accent:branch === 'a' ? '#f3b86a' : branch === 'b' ? '#fbe17e' : branch === 'c' ? '#95e8d7' : '#dba46d',
    muzzle:'none', projectile:'none', impact:'coin-spark', scale:1,
    glow:tier === 5 ? .85 : tier >= 3 ? .5 : .32,
    motion:tier === 5 ? 'rotate' : tier >= 3 ? 'pulse' : 'breathe',
  };
}

function income(amount:number):EffectDef {
  return {id:'mint-wave-income', kind:'income', power:amount, radius:0, interval:0, duration:0, cap:0};
}
function aura(id:string, stat:NonNullable<EffectDef['stat']>, power:number, radius:number):EffectDef {
  return {id, kind:'aura', stat, power, radius, interval:0, duration:0, cap:0};
}
function harvest(power:number, radius:number, cap:number):EffectDef {
  return {id:'mint-harvest', kind:'harvest', power, radius, cap, interval:0, duration:0};
}
function reserve(power:number, cooldown:number):AbilityDef {
  return {id:'mint-reserve', name:'Открыть резерв',
    description:`Получить ${power} кредитов немедленно; перезарядка ${cooldown} с игрового времени.`,
    kind:'mint', power, cooldown, duration:0, radius:0, element:'kinetic'};
}

const rows:Record<Branch,Row[]> = {
  a:[
    {cost:500, name:'Стальная матрица', description:'Доход увеличен с 65 до 95 кредитов за завершённую волну.', effects:[income(95)]},
    {cost:1000, name:'Серийные штемпели', description:'135 кредитов за волну; соседним башням в радиусе 115 скидка 4% на покупки.', effects:[income(135),aura('mint-discount','discount',.04,115)]},
    {cost:2500, name:'Непрерывный пресс', description:'Большой механический пресс приносит гарантированные 260 кредитов за волну.', effects:[income(260)]},
    {cost:6000, name:'Чеканная линия', description:'540 кредитов за волну; скидка соседним башням 7% в радиусе 150.', effects:[income(540),aura('mint-discount','discount',.07,150)]},
    {cost:15000, name:'Город тысячи монет', description:'Трёхъярусный вертикальный пресс: 1280 кредитов за волну; скидка соседям 10% в радиусе 165. Нет процентного роста.', effects:[income(1280),aura('mint-discount','discount',.10,165)]},
  ],
  b:[
    {cost:525, name:'Геодезический визир', description:'Даёт соседним атакующим башням +7% дальности в радиусе 120.', effects:[aura('mint-range','range',.07,120)]},
    {cost:1050, name:'Рудничная сирена', description:'Даёт соседним атакующим башням +8% темпа в радиусе 120; аура дальности сохраняется.', effects:[aura('mint-rhythm','attackSpeed',.08,120)]},
    {cost:2625, name:'Сито добытчика', description:'+14% награды за убийства врагов в радиусе 175, не более 150 дополнительных кредитов за волну.', effects:[harvest(.14,175,150)]},
    {cost:6300, name:'Открытая залежь', description:'+20% награды за убийства в радиусе 195, максимум 400 за волну; аура дальности 11% в радиусе 145.', effects:[harvest(.20,195,400),aura('mint-range','range',.11,145)]},
    {cost:15750, name:'Сердце золотой лихорадки', description:'Открытая жила и вращающееся сито: +28% награды за убийства в радиусе 230, максимум 1150 за волну; +14% темпа союзникам в радиусе 155.', effects:[harvest(.28,230,1150),aura('mint-rhythm','attackSpeed',.14,155)]},
  ],
  c:[
    {cost:475, name:'Сигнальные печати', description:'Фонари казначейства дают соседним башням обнаружение скрытых врагов в радиусе 145.', effects:[aura('mint-guard-detect','detect',1,145)]},
    {cost:950, name:'Гвардия казначейства', description:'Охрана даёт боевым башням +6% урона в радиусе 120; обнаружение сохраняется.', effects:[aura('mint-guard-damage','damage',.06,120)]},
    {cost:2375, name:'Тревожная касса', description:'Активная выплата 450 кредитов; перезарядка 130 с. Заряд не копится автоматически.', effects:[], abilities:[reserve(450,130)]},
    {cost:5700, name:'Барабанная смета', description:'Активная выплата 1300 кредитов с перезарядкой 145 с; союзникам +9% урона в радиусе 150.', effects:[aura('mint-guard-damage','damage',.09,150)], abilities:[reserve(1300,145)]},
    {cost:14250, name:'Государственный резерв', description:'Большое хранилище с тремя механическими счётчиками: активная выплата 3600 кредитов раз в 165 с; союзникам +13% урона в радиусе 165.', effects:[aura('mint-guard-damage','damage',.13,165)], abilities:[reserve(3600,165)]},
  ],
};

function path(branch:Branch, name:string, description:string):TowerDef['paths'][number] {
  return {id:`mint-${branch}`, name, description, upgrades:rows[branch].map((r,i):UpgradeDef=>({
    id:`mint-${branch}${i+1}`, tier:(i+1) as UpgradeDef['tier'], cost:r.cost,
    name:r.name, description:r.description, delta:{},
    effects:r.effects.map(e=>({...e})), abilities:r.abilities?.map(a=>({...a})),
    visual:visual(`${branch}${i+1}`,branch,i+1),
  }))};
}

function idleAttack():AttackDef {
  return {
    mode:'shot', element:'kinetic', damage:0, interval:1, range:0,
    pierce:1, count:1, splash:0, chains:0, chainRadius:0,
    detects:false, armorPierce:0, shieldMultiplier:1, bossMultiplier:1,
    executeBelow:0, push:0, statuses:[], projectileSpeed:0,
    projectileRadius:0, homing:false, windup:0, arc:0,
  };
}

/** Return independent data so a resolver can safely merge and replace by ID. */
export function getTower():TowerDef {
  return {
    id:'mint', name:'Монетный двор',
    description:'Не атакует; базовый доход 65 кредитов за завершённую волну. Развивается в чеканку, золотодобычу или резерв.',
    category:'economy', cost:1000, footprint:26, placement:'land',
    attack:idleAttack(), effects:[income(65)], abilities:[], visual:visual('base'),
    paths:[
      path('a','Чеканка','Стабильный доход за волну и скидки соседям.'),
      path('b','Золотая лихорадка','Лимитированная награда за убийства рядом и поддержка дальности/темпа.'),
      path('c','Резерв','Активная выдача больших сумм с долгой перезарядкой и охрана.'),
    ],
  };
}
