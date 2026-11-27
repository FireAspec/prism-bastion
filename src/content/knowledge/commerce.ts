import type {KnowledgeNode} from '../../contracts';

const nodes: KnowledgeNode[] = [
  {
    "id": "commerce-01",
    "branch": "commerce",
    "index": 1,
    "name": "Полевой паёк",
    "description": "Стартовые кредиты +1%.",
    "requires": [],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 30,
    "effects": [
      {
        "stat": "startingCash",
        "value": 0.01
      }
    ],
    "icon": "art/knowledge/commerce/commerce-01.svg"
  },
  {
    "id": "commerce-02",
    "branch": "commerce",
    "index": 2,
    "name": "Лёгкий кошель",
    "description": "Скидка на покупки +0,25%.",
    "requires": [
      "commerce-01"
    ],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 35,
    "effects": [
      {
        "stat": "purchaseDiscount",
        "value": 0.0025
      }
    ],
    "icon": "art/knowledge/commerce/commerce-02.svg"
  },
  {
    "id": "commerce-03",
    "branch": "commerce",
    "index": 3,
    "name": "Ровная чеканка",
    "description": "Пассивный доход +1,5% (Монетный двор, Кристальный банк).",
    "requires": [
      "commerce-02"
    ],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 40,
    "effects": [
      {
        "stat": "passiveIncome",
        "value": 0.015,
        "towers": [
          "mint",
          "bank"
        ]
      }
    ],
    "icon": "art/knowledge/commerce/commerce-03.svg"
  },
  {
    "id": "commerce-04",
    "branch": "commerce",
    "index": 4,
    "name": "Ученик снабжения",
    "description": "Опыт +0,5%.",
    "requires": [
      "commerce-03"
    ],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 50,
    "effects": [
      {
        "stat": "xpGain",
        "value": 0.005
      }
    ],
    "icon": "art/knowledge/commerce/commerce-04.svg"
  },
  {
    "id": "commerce-05",
    "branch": "commerce",
    "index": 5,
    "name": "Первый резерв",
    "description": "Стартовые кредиты +1%; Пассивный доход +1%.",
    "requires": [
      "commerce-04"
    ],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 55,
    "effects": [
      {
        "stat": "startingCash",
        "value": 0.01
      },
      {
        "stat": "passiveIncome",
        "value": 0.01
      }
    ],
    "icon": "art/knowledge/commerce/commerce-05.svg"
  },
  {
    "id": "commerce-06",
    "branch": "commerce",
    "index": 6,
    "name": "Чистый урожай",
    "description": "Пассивный доход +1,5% (Искровой сад, Дозорный причал).",
    "requires": [
      "commerce-05"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 65,
    "effects": [
      {
        "stat": "passiveIncome",
        "value": 0.015,
        "towers": [
          "orchard",
          "harbor"
        ]
      }
    ],
    "icon": "art/knowledge/commerce/commerce-06.svg"
  },
  {
    "id": "commerce-07",
    "branch": "commerce",
    "index": 7,
    "name": "Общий склад",
    "description": "Стартовые кредиты +1%.",
    "requires": [
      "commerce-06"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 75,
    "effects": [
      {
        "stat": "startingCash",
        "value": 0.01
      }
    ],
    "icon": "art/knowledge/commerce/commerce-07.svg"
  },
  {
    "id": "commerce-08",
    "branch": "commerce",
    "index": 8,
    "name": "Точный учёт",
    "description": "Скидка на покупки +0,35%.",
    "requires": [
      "commerce-07"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 85,
    "effects": [
      {
        "stat": "purchaseDiscount",
        "value": 0.0035
      }
    ],
    "icon": "art/knowledge/commerce/commerce-08.svg"
  },
  {
    "id": "commerce-09",
    "branch": "commerce",
    "index": 9,
    "name": "Память пути",
    "description": "Опыт +0,5%.",
    "requires": [
      "commerce-08"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 95,
    "effects": [
      {
        "stat": "xpGain",
        "value": 0.005
      }
    ],
    "icon": "art/knowledge/commerce/commerce-09.svg"
  },
  {
    "id": "commerce-10",
    "branch": "commerce",
    "index": 10,
    "name": "Складской мастер",
    "description": "Пассивный доход +1,25%; Стартовые кредиты +0,75%.",
    "requires": [
      "commerce-09"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 105,
    "effects": [
      {
        "stat": "passiveIncome",
        "value": 0.0125
      },
      {
        "stat": "startingCash",
        "value": 0.0075
      }
    ],
    "icon": "art/knowledge/commerce/commerce-10.svg"
  },
  {
    "id": "commerce-11",
    "branch": "commerce",
    "index": 11,
    "name": "Сбережённая медь",
    "description": "Скидка на покупки +0,4%.",
    "requires": [
      "commerce-10"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 120,
    "effects": [
      {
        "stat": "purchaseDiscount",
        "value": 0.004
      }
    ],
    "icon": "art/knowledge/commerce/commerce-11.svg"
  },
  {
    "id": "commerce-12",
    "branch": "commerce",
    "index": 12,
    "name": "Сезонный сбор",
    "description": "Пассивный доход +1,5% (Искровой сад, Монетный двор).",
    "requires": [
      "commerce-11"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 130,
    "effects": [
      {
        "stat": "passiveIncome",
        "value": 0.015,
        "towers": [
          "orchard",
          "mint"
        ]
      }
    ],
    "icon": "art/knowledge/commerce/commerce-12.svg"
  },
  {
    "id": "commerce-13",
    "branch": "commerce",
    "index": 13,
    "name": "Ранний заказ",
    "description": "Скидка на покупки +0,4%.",
    "requires": [
      "commerce-12"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 145,
    "effects": [
      {
        "stat": "purchaseDiscount",
        "value": 0.004
      }
    ],
    "icon": "art/knowledge/commerce/commerce-13.svg"
  },
  {
    "id": "commerce-14",
    "branch": "commerce",
    "index": 14,
    "name": "Полевой дневник",
    "description": "Опыт +0,6%.",
    "requires": [
      "commerce-13"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 160,
    "effects": [
      {
        "stat": "xpGain",
        "value": 0.006
      }
    ],
    "icon": "art/knowledge/commerce/commerce-14.svg"
  },
  {
    "id": "commerce-15",
    "branch": "commerce",
    "index": 15,
    "name": "Казначей",
    "description": "Скидка на покупки +0,4%; Стартовые кредиты +1%.",
    "requires": [
      "commerce-14"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 170,
    "effects": [
      {
        "stat": "purchaseDiscount",
        "value": 0.004
      },
      {
        "stat": "startingCash",
        "value": 0.01
      }
    ],
    "icon": "art/knowledge/commerce/commerce-15.svg"
  },
  {
    "id": "commerce-16",
    "branch": "commerce",
    "index": 16,
    "name": "Запас семян",
    "description": "Пассивный доход +1,25% (Искровой сад, Монетный двор).",
    "requires": [
      "commerce-15"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 190,
    "effects": [
      {
        "stat": "passiveIncome",
        "value": 0.0125,
        "towers": [
          "orchard",
          "mint"
        ]
      }
    ],
    "icon": "art/knowledge/commerce/commerce-16.svg"
  },
  {
    "id": "commerce-17",
    "branch": "commerce",
    "index": 17,
    "name": "Экономный чертёж",
    "description": "Скидка на покупки +0,4%.",
    "requires": [
      "commerce-16"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 205,
    "effects": [
      {
        "stat": "purchaseDiscount",
        "value": 0.004
      }
    ],
    "icon": "art/knowledge/commerce/commerce-17.svg"
  },
  {
    "id": "commerce-18",
    "branch": "commerce",
    "index": 18,
    "name": "Честная торговля",
    "description": "Печати +0,5%.",
    "requires": [
      "commerce-17"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 220,
    "effects": [
      {
        "stat": "sealGain",
        "value": 0.005
      }
    ],
    "icon": "art/knowledge/commerce/commerce-18.svg"
  },
  {
    "id": "commerce-19",
    "branch": "commerce",
    "index": 19,
    "name": "Карты снабжения",
    "description": "Опыт +0,6%.",
    "requires": [
      "commerce-18"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 240,
    "effects": [
      {
        "stat": "xpGain",
        "value": 0.006
      }
    ],
    "icon": "art/knowledge/commerce/commerce-19.svg"
  },
  {
    "id": "commerce-20",
    "branch": "commerce",
    "index": 20,
    "name": "Большой обоз",
    "description": "Стартовые кредиты +1,25%; Пассивный доход +1,5%.",
    "requires": [
      "commerce-19"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 255,
    "effects": [
      {
        "stat": "startingCash",
        "value": 0.0125
      },
      {
        "stat": "passiveIncome",
        "value": 0.015
      }
    ],
    "icon": "art/knowledge/commerce/commerce-20.svg"
  },
  {
    "id": "commerce-21",
    "branch": "commerce",
    "index": 21,
    "name": "Надёжный процент",
    "description": "Пассивный доход +1,75% (Кристальный банк, Монетный двор).",
    "requires": [
      "commerce-20"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 275,
    "effects": [
      {
        "stat": "passiveIncome",
        "value": 0.0175,
        "towers": [
          "bank",
          "mint"
        ]
      }
    ],
    "icon": "art/knowledge/commerce/commerce-21.svg"
  },
  {
    "id": "commerce-22",
    "branch": "commerce",
    "index": 22,
    "name": "Пакет деталей",
    "description": "Скидка на покупки +0,5%.",
    "requires": [
      "commerce-21"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 295,
    "effects": [
      {
        "stat": "purchaseDiscount",
        "value": 0.005
      }
    ],
    "icon": "art/knowledge/commerce/commerce-22.svg"
  },
  {
    "id": "commerce-23",
    "branch": "commerce",
    "index": 23,
    "name": "Портовые сборы",
    "description": "Пассивный доход +1,5% (Дозорный причал, Кристальный банк).",
    "requires": [
      "commerce-22"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 315,
    "effects": [
      {
        "stat": "passiveIncome",
        "value": 0.015,
        "towers": [
          "harbor",
          "bank"
        ]
      }
    ],
    "icon": "art/knowledge/commerce/commerce-23.svg"
  },
  {
    "id": "commerce-24",
    "branch": "commerce",
    "index": 24,
    "name": "Опыт экспедиции",
    "description": "Опыт +0,7%.",
    "requires": [
      "commerce-23"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 335,
    "effects": [
      {
        "stat": "xpGain",
        "value": 0.007
      }
    ],
    "icon": "art/knowledge/commerce/commerce-24.svg"
  },
  {
    "id": "commerce-25",
    "branch": "commerce",
    "index": 25,
    "name": "Стратегический запас",
    "description": "Стартовые кредиты +1,75%; Печати +1%.",
    "requires": [
      "commerce-24"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 355,
    "effects": [
      {
        "stat": "startingCash",
        "value": 0.0175
      },
      {
        "stat": "sealGain",
        "value": 0.01
      }
    ],
    "icon": "art/knowledge/commerce/commerce-25.svg"
  },
  {
    "id": "commerce-26",
    "branch": "commerce",
    "index": 26,
    "name": "Золотой пресс",
    "description": "Пассивный доход +1,25% (Монетный двор, Кристальный банк).",
    "requires": [
      "commerce-25"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 380,
    "effects": [
      {
        "stat": "passiveIncome",
        "value": 0.0125,
        "towers": [
          "mint",
          "bank"
        ]
      }
    ],
    "icon": "art/knowledge/commerce/commerce-26.svg"
  },
  {
    "id": "commerce-27",
    "branch": "commerce",
    "index": 27,
    "name": "Сеть поставщиков",
    "description": "Скидка на покупки +0,7%.",
    "requires": [
      "commerce-26"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 400,
    "effects": [
      {
        "stat": "purchaseDiscount",
        "value": 0.007
      }
    ],
    "icon": "art/knowledge/commerce/commerce-27.svg"
  },
  {
    "id": "commerce-28",
    "branch": "commerce",
    "index": 28,
    "name": "Наследие маршрута",
    "description": "Опыт +1%; Печати +0,75%.",
    "requires": [
      "commerce-27"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 425,
    "effects": [
      {
        "stat": "xpGain",
        "value": 0.01
      },
      {
        "stat": "sealGain",
        "value": 0.0075
      }
    ],
    "icon": "art/knowledge/commerce/commerce-28.svg"
  },
  {
    "id": "commerce-29",
    "branch": "commerce",
    "index": 29,
    "name": "Печать гильдии",
    "description": "Печати +1,5%.",
    "requires": [
      "commerce-28"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 450,
    "effects": [
      {
        "stat": "sealGain",
        "value": 0.015
      }
    ],
    "icon": "art/knowledge/commerce/commerce-29.svg"
  },
  {
    "id": "commerce-30",
    "branch": "commerce",
    "index": 30,
    "name": "Снабжение без сбоев",
    "description": "Стартовые кредиты +2,25%; Пассивный доход +1%; Скидка на покупки +0,6%; Опыт +1,1%; Печати +1,25%.",
    "requires": [
      "commerce-29"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 470,
    "effects": [
      {
        "stat": "startingCash",
        "value": 0.0225
      },
      {
        "stat": "passiveIncome",
        "value": 0.01
      },
      {
        "stat": "purchaseDiscount",
        "value": 0.006
      },
      {
        "stat": "xpGain",
        "value": 0.011
      },
      {
        "stat": "sealGain",
        "value": 0.0125
      }
    ],
    "icon": "art/knowledge/commerce/commerce-30.svg"
  }
];

export function getKnowledge(): KnowledgeNode[] {
  return nodes.map(node => ({
    ...node,
    requires: [...node.requires],
    effects: node.effects.map(effect => ({ ...effect, ...(effect.towers ? { towers: [...effect.towers] } : {}) })),
  }));
}
