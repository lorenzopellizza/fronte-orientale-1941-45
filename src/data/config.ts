import { GameConfig } from '../engine/types';

export const config: GameConfig = {
  seed: 12345,
  ordersPerTurn: 3,
  initiativeBonusOrders: 1,
  handSize: 5,
  handMax: 7,
  ppCarryMax: 3,
  maxReactions: 2,
  dice: {
    enabled: true,
    table: { 1: -1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 },
  },
  outcomeThresholds: {
    disfatta: -3,
    respinto: 0,
    avanzata: 2,
    netta: 5,
  }, // >=6 sfondamento
  supply: {
    axisFreeUntil: 3,
    axisDefPenaltyFrom: 5,
    ussrPenalty: { 2: 1, 1: 2 },
  },
  encirclement: {
    threatGap: 2,
    autoGap: 3,
    attritionPerTurn: 1,
  },
  experience: {
    veteranXp: 2,
    eliteXp: 4,
    replacementsDropLevel: true,
  },
  victory: {
    axisVpToWin: 6,
    axisSuddenDeathCities: 3,
    from1944PenaltyAtMarker: 1,
  },
  production: {
    axis: [10, 8, 10, 9, 10, 9, 8, 7, 6],
    ussr: [5, 4, 7, 8, 10, 10, 12, 12, 12],
  },
  rebuildCost: {
    ussr: 4,
    axis: 8,
  },
  axisCanRebuild: true,
  prototypeCost: 4,
  normandyAllowPayInstead: true,
  normandyPayCost: 6,
  modules: {
    reserves: true,
    encirclement: true,
    supply: true,
    winter: true,
    air: true,
    experience: true,
    initiativeBonus: true,
    surprise: true,
    combinedArms: true,
    fogOfWar: false,
  },
};

export function cloneConfig(c: GameConfig = config): GameConfig {
  return JSON.parse(JSON.stringify(c));
}
