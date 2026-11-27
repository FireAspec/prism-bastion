import type {TowerDef} from '../../contracts';

const definition: TowerDef = {
  "id": "rocket",
  "name": "Ракетная батарея",
  "description": "Самонаводящиеся ракеты с взрывом при контакте; три направления модернизации.",
  "category": "tech",
  "cost": 1000,
  "footprint": 26,
  "placement": "land",
  "attack": {
    "mode": "splash",
    "element": "kinetic",
    "damage": 35,
    "interval": 1.6,
    "range": 230,
    "pierce": 1,
    "count": 1,
    "splash": 30,
    "chains": 0,
    "chainRadius": 0,
    "detects": false,
    "armorPierce": 0,
    "shieldMultiplier": 1,
    "bossMultiplier": 1,
    "executeBelow": 0,
    "push": 0,
    "statuses": [],
    "projectileSpeed": 400,
    "projectileRadius": 4,
    "homing": true,
    "windup": 0.08,
    "arc": 0
  },
  "effects": [],
  "abilities": [],
  "visual": {
    "asset": "/art/towers/rocket/base.svg",
    "accent": "#d8ad6e",
    "muzzle": "rocket-flash",
    "projectile": "rocket",
    "impact": "rocket-blast",
    "scale": 1,
    "glow": 0.25,
    "motion": "breathe"
  },
  "paths": [
    {
      "id": "salute",
      "name": "Салют",
      "description": "Массовые залпы и широкие взрывы.",
      "upgrades": [
        {
          "id": "rocket-a1",
          "name": "Расширитель сопел",
          "description": "Радиус взрыва +10 пкс; урон ×1,10.",
          "cost": 500,
          "tier": 1,
          "delta": {
            "splashAdd": 10,
            "damageMul": 1.1
          },
          "visual": {
            "asset": "/art/towers/rocket/a1.svg",
            "accent": "#59daca",
            "muzzle": "rocket-flash",
            "projectile": "rocket",
            "impact": "rocket-blast",
            "scale": 1.025,
            "glow": 0.37,
            "motion": "breathe"
          }
        },
        {
          "id": "rocket-a2",
          "name": "Конвейер ракет",
          "description": "Интервал залпа ×0,82; скорость ракеты ×1,15.",
          "cost": 1000,
          "tier": 2,
          "delta": {
            "intervalMul": 0.82,
            "projectileSpeedMul": 1.15
          },
          "visual": {
            "asset": "/art/towers/rocket/a2.svg",
            "accent": "#59daca",
            "muzzle": "rocket-flash",
            "projectile": "rocket",
            "impact": "rocket-blast",
            "scale": 1.05,
            "glow": 0.49,
            "motion": "breathe"
          }
        },
        {
          "id": "rocket-a3",
          "name": "Тройная кассета",
          "description": "Три ракеты за залп; урон каждой ×0,90.",
          "cost": 2500,
          "tier": 3,
          "delta": {
            "countAdd": 2,
            "damageMul": 0.9
          },
          "visual": {
            "asset": "/art/towers/rocket/a3.svg",
            "accent": "#59daca",
            "muzzle": "rocket-flash",
            "projectile": "rocket-salvo",
            "impact": "rocket-blast",
            "scale": 1.075,
            "glow": 0.61,
            "motion": "pulse"
          }
        },
        {
          "id": "rocket-a4",
          "name": "Перекрёстный залп",
          "description": "Пять ракет за залп; урон ×1,45, радиус +12 пкс.",
          "cost": 6000,
          "tier": 4,
          "delta": {
            "countAdd": 2,
            "damageMul": 1.45,
            "splashAdd": 12
          },
          "visual": {
            "asset": "/art/towers/rocket/a4.svg",
            "accent": "#59daca",
            "muzzle": "rocket-flash",
            "projectile": "rocket-salvo",
            "impact": "rocket-blast",
            "scale": 1.1,
            "glow": 0.73,
            "motion": "pulse"
          }
        },
        {
          "id": "rocket-a5",
          "name": "Салют",
          "description": "Девять ракет за залп; урон ×1,6, радиус +14 пкс. Перегрузка: +40% темпа на 8 с, откат 55 с.",
          "cost": 15000,
          "tier": 5,
          "delta": {
            "countAdd": 4,
            "damageMul": 1.6,
            "splashAdd": 14
          },
          "abilities": [
            {
              "id": "rocket-salvo",
              "name": "Праздник огня",
              "description": "Ускоряет собственные залпы на 8 секунд.",
              "kind": "overclock",
              "cooldown": 55,
              "power": 0.4,
              "duration": 8,
              "radius": 0,
              "element": "kinetic"
            }
          ],
          "visual": {
            "asset": "/art/towers/rocket/a5.svg",
            "accent": "#59daca",
            "muzzle": "rocket-flash",
            "projectile": "rocket-salvo",
            "impact": "rocket-blast",
            "scale": 1.125,
            "glow": 0.85,
            "motion": "pulse"
          }
        }
      ]
    },
    {
      "id": "titan",
      "name": "Титанобой",
      "description": "Тяжёлые ракеты против щитов, брони и боссов.",
      "upgrades": [
        {
          "id": "rocket-b1",
          "name": "Кумулятивная головка",
          "description": "Пробитие брони +8; урон ×1,12.",
          "cost": 575,
          "tier": 1,
          "delta": {
            "armorPierceAdd": 8,
            "damageMul": 1.12
          },
          "visual": {
            "asset": "/art/towers/rocket/b1.svg",
            "accent": "#c9e3ee",
            "muzzle": "rocket-flash",
            "projectile": "rocket",
            "impact": "heavy-blast",
            "scale": 1.025,
            "glow": 0.37,
            "motion": "breathe"
          }
        },
        {
          "id": "rocket-b2",
          "name": "Разрядник щитов",
          "description": "Урон щитам ×1,55; по боссам ×1,20.",
          "cost": 1150,
          "tier": 2,
          "delta": {
            "shieldMultiplierMul": 1.55,
            "bossMultiplierMul": 1.2
          },
          "visual": {
            "asset": "/art/towers/rocket/b2.svg",
            "accent": "#c9e3ee",
            "muzzle": "rocket-flash",
            "projectile": "rocket",
            "impact": "heavy-blast",
            "scale": 1.05,
            "glow": 0.49,
            "motion": "breathe"
          }
        },
        {
          "id": "rocket-b3",
          "name": "Тяжёлая направляющая",
          "description": "Урон ×3,2; пробитие +16; интервал ×1,20.",
          "cost": 2875,
          "tier": 3,
          "delta": {
            "damageMul": 3.2,
            "armorPierceAdd": 16,
            "intervalMul": 1.2
          },
          "visual": {
            "asset": "/art/towers/rocket/b3.svg",
            "accent": "#c9e3ee",
            "muzzle": "rocket-flash",
            "projectile": "rocket-heavy",
            "impact": "heavy-blast",
            "scale": 1.075,
            "glow": 0.61,
            "motion": "pulse"
          }
        },
        {
          "id": "rocket-b4",
          "name": "Двойной таран",
          "description": "Две тяжёлые ракеты; урон ×1,5; по боссам ×1,35.",
          "cost": 6900,
          "tier": 4,
          "delta": {
            "countAdd": 1,
            "damageMul": 1.5,
            "bossMultiplierMul": 1.35
          },
          "visual": {
            "asset": "/art/towers/rocket/b4.svg",
            "accent": "#c9e3ee",
            "muzzle": "rocket-flash",
            "projectile": "rocket-heavy",
            "impact": "heavy-blast",
            "scale": 1.1,
            "glow": 0.73,
            "motion": "pulse"
          }
        },
        {
          "id": "rocket-b5",
          "name": "Титанобой",
          "description": "Три тяжёлые ракеты; урон ×1,9, пробитие +30, щиты ×1,6, боссы ×1,5.",
          "cost": 17250,
          "tier": 5,
          "delta": {
            "countAdd": 1,
            "damageMul": 1.9,
            "armorPierceAdd": 30,
            "shieldMultiplierMul": 1.6,
            "bossMultiplierMul": 1.5
          },
          "visual": {
            "asset": "/art/towers/rocket/b5.svg",
            "accent": "#c9e3ee",
            "muzzle": "rocket-flash",
            "projectile": "rocket-heavy",
            "impact": "heavy-blast",
            "scale": 1.125,
            "glow": 0.85,
            "motion": "pulse"
          }
        }
      ]
    },
    {
      "id": "comet",
      "name": "Комета",
      "description": "Горение, дальность и огненная артиллерия.",
      "upgrades": [
        {
          "id": "rocket-c1",
          "name": "Термитная оболочка",
          "description": "Поджог: 6 ед. урона/с на стек, 2,5 с, до двух стеков.",
          "cost": 450,
          "tier": 1,
          "delta": {},
          "addStatuses": [
            {
              "kind": "burn",
              "power": 6,
              "duration": 2.5,
              "maxStacks": 2
            }
          ],
          "visual": {
            "asset": "/art/towers/rocket/c1.svg",
            "accent": "#ff9c49",
            "muzzle": "fire-flash",
            "projectile": "rocket-comet",
            "impact": "fire-burst",
            "scale": 1.025,
            "glow": 0.37,
            "motion": "breathe"
          }
        },
        {
          "id": "rocket-c2",
          "name": "Турбонаддув",
          "description": "Дальность ×1,14, скорость ракеты ×1,25; радиус +5 пкс.",
          "cost": 900,
          "tier": 2,
          "delta": {
            "rangeMul": 1.14,
            "projectileSpeedMul": 1.25,
            "splashAdd": 5
          },
          "visual": {
            "asset": "/art/towers/rocket/c2.svg",
            "accent": "#ff9c49",
            "muzzle": "fire-flash",
            "projectile": "rocket-comet",
            "impact": "fire-burst",
            "scale": 1.05,
            "glow": 0.49,
            "motion": "breathe"
          }
        },
        {
          "id": "rocket-c3",
          "name": "Огненный след",
          "description": "Огненный урон ×1,8; радиус +15 пкс; горение 20/с на 4 с, до трёх стеков.",
          "cost": 2250,
          "tier": 3,
          "delta": {
            "damageMul": 1.8,
            "splashAdd": 15
          },
          "replaceAttack": {
            "mode": "splash",
            "element": "fire",
            "damage": 35,
            "interval": 1.6,
            "range": 230,
            "pierce": 1,
            "count": 1,
            "splash": 30,
            "chains": 0,
            "chainRadius": 0,
            "detects": false,
            "armorPierce": 0,
            "shieldMultiplier": 1,
            "bossMultiplier": 1,
            "executeBelow": 0,
            "push": 0,
            "statuses": [],
            "projectileSpeed": 400,
            "projectileRadius": 4,
            "homing": true,
            "windup": 0.08,
            "arc": 0
          },
          "addStatuses": [
            {
              "kind": "burn",
              "power": 20,
              "duration": 4,
              "maxStacks": 3
            }
          ],
          "visual": {
            "asset": "/art/towers/rocket/c3.svg",
            "accent": "#ff9c49",
            "muzzle": "fire-flash",
            "projectile": "rocket-comet",
            "impact": "fire-burst",
            "scale": 1.075,
            "glow": 0.61,
            "motion": "rotate"
          }
        },
        {
          "id": "rocket-c4",
          "name": "Кометный веер",
          "description": "Три огненные ракеты; урон ×1,5, радиус +10 пкс; горение 38/с на 5 с, до трёх стеков.",
          "cost": 5400,
          "tier": 4,
          "delta": {
            "countAdd": 2,
            "damageMul": 1.5,
            "splashAdd": 10
          },
          "addStatuses": [
            {
              "kind": "burn",
              "power": 38,
              "duration": 5,
              "maxStacks": 3
            }
          ],
          "visual": {
            "asset": "/art/towers/rocket/c4.svg",
            "accent": "#ff9c49",
            "muzzle": "fire-flash",
            "projectile": "rocket-comet",
            "impact": "fire-burst",
            "scale": 1.1,
            "glow": 0.73,
            "motion": "rotate"
          }
        },
        {
          "id": "rocket-c5",
          "name": "Комета",
          "description": "Пять огненных ракет; урон ×1,7, радиус +15 пкс; горение 75/с на 6 с, до четырёх стеков. Метеор: 700 урона, радиус 120, откат 60 с.",
          "cost": 13500,
          "tier": 5,
          "delta": {
            "countAdd": 2,
            "damageMul": 1.7,
            "splashAdd": 15
          },
          "addStatuses": [
            {
              "kind": "burn",
              "power": 75,
              "duration": 6,
              "maxStacks": 4
            }
          ],
          "abilities": [
            {
              "id": "rocket-cometfall",
              "name": "Падение кометы",
              "description": "Огненный метеор в области боевой цели.",
              "kind": "meteor",
              "cooldown": 60,
              "power": 700,
              "duration": 0,
              "radius": 120,
              "element": "fire"
            }
          ],
          "visual": {
            "asset": "/art/towers/rocket/c5.svg",
            "accent": "#ff9c49",
            "muzzle": "fire-flash",
            "projectile": "rocket-comet",
            "impact": "fire-burst",
            "scale": 1.125,
            "glow": 0.85,
            "motion": "rotate"
          }
        }
      ]
    }
  ]
};

export function getTower(): TowerDef { return structuredClone(definition); }
