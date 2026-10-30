export type Side = 'AXIS' | 'USSR';
export type SectorId = 'NORD' | 'CENTRO' | 'SUD';
export type LocationId = SectorId | 'RISERVA';
export type TurnId = 'E41' | 'I41' | 'E42' | 'I42' | 'E43' | 'I43' | 'E44' | 'I44' | 'E45';
export type Season = 'ESTATE' | 'INVERNO';

export const TURNS: TurnId[] = ['E41', 'I41', 'E42', 'I42', 'E43', 'I43', 'E44', 'I44', 'E45'];

export type FormationType = 'FANTERIA' | 'MOTORIZZATA' | 'CORAZZATA';
export type ExperienceLevel = 'RECLUTA' | 'VETERANA' | 'ELITE';
export type FormationKeyword = 'FRAGILE' | 'INVERNO' | 'URBANO' | 'GUARDIA';
export type EquipmentKeyword = 'ANTICARRO' | 'PESANTE';
export type EquipmentRequirement = 'C' | 'FM' | 'CM' | 'ANY';

export type CardType = 'EQUIPAGGIAMENTO_TERRA' | 'AEREO' | 'COMANDANTE' | 'EVENTO';
export type EventTiming = 'ORDINE' | 'ATTACCO' | 'DIFESA';

export interface GroundEquipmentCard {
  id: string;
  templateId: string;
  name: string;
  side: Side;
  year: 1941 | 1942 | 1943 | 1944;
  type: 'EQUIPAGGIAMENTO_TERRA';
  cost: number;
  atk: number;
  def: number;
  requires: EquipmentRequirement;
  keywords: EquipmentKeyword[];
  description?: string;
}

export interface AirCard {
  id: string;
  templateId: string;
  name: string;
  side: Side;
  year: 1941 | 1942 | 1943 | 1944;
  type: 'AEREO';
  cost: number;
  caccia: number;
  supporto: number;
  description?: string;
}

export interface CommanderCard {
  id: string;
  templateId: string;
  name: string;
  side: Side;
  year: 1941 | 1942 | 1943 | 1944;
  type: 'COMANDANTE';
  cost: number;
  effectText: string;
}

export interface EventCard {
  id: string;
  templateId: string;
  name: string;
  side: Side;
  year: 1941 | 1942 | 1943 | 1944;
  type: 'EVENTO';
  cost: number;
  timing: EventTiming;
  effectText: string;
  onlyTurn?: TurnId;
  onlySeason?: Season;
  allowedSectors?: SectorId[];
}

export type Card = GroundEquipmentCard | AirCard | CommanderCard | EventCard;

export interface Formation {
  id: string;
  name: string;
  baseName: string;
  side: Side;
  type: FormationType;
  maxStrength: number;
  strength: number;
  xp: number;
  level: ExperienceLevel;
  keywords: FormationKeyword[];
  equipment: GroundEquipmentCard | null;
  location: LocationId;
  exhausted: boolean;
  encircled: boolean;
  encircledBySectors: SectorId[]; // tracks adjacent sectors causing the pocket
  reactedThisTurn: boolean;
}

export interface DestroyedFormation {
  id: string;
  name: string;
  baseName: string;
  side: Side;
  type: FormationType;
  keywords: FormationKeyword[];
  destroyedTurn: TurnId;
}

export interface ModifierEntry {
  source: string;
  value: number;
}

export type CombatOutcomeType = 'DISFATTA' | 'RESPINTO' | 'AVANZATA' | 'VITTORIA_NETTA' | 'SFONDAMENTO';

export interface CombatBreakdown {
  sector: SectorId;
  attacker: Side;
  defender: Side;
  attackModifiers: ModifierEntry[];
  defenseModifiers: ModifierEntry[];
  totalAttack: number;
  totalDefense: number;
  diceRoll: number | null; // 1-6 or null if dice disabled
  diceModifier: number;
  diffWithoutDice: number;
  finalDiff: number;
  outcomeWithoutDice: CombatOutcomeType;
  outcome: CombatOutcomeType;
  diceChangedOutcome: boolean;
  markerShift: number;
  attackerLosses: number;
  defenderLosses: number;
  initiativePassedTo: Side | null;
}

export interface PendingCombatState {
  phase: 'REACTION' | 'ATTACKER_LOSSES' | 'DEFENDER_LOSSES' | 'ENCIRCLEMENT_CHOICE' | 'RESOLVED';
  sector: SectorId;
  attacker: Side;
  defender: Side;
  attackerIds: string[];
  attackEvents: EventCard[];
  defenseEvents: EventCard[];
  reactedIds: string[];
  elasticRetreatPlayed: boolean;
  order227Played: boolean;
  maskirovkaPlayed: boolean;
  breakdown?: CombatBreakdown;
  remainingAttackerLosses: number;
  remainingDefenderLosses: number;
  threatenedSectors: SectorId[];
}

export interface PendingNormandyState {
  active: boolean;
}

export interface SectorState {
  id: SectorId;
  marker: number; // 0 to 6
  axisCommander: CommanderCard | null;
  ussrCommander: CommanderCard | null;
  retreatedSidesThisTurn: Side[];
  airliftProtectedThisTurn: boolean; // Ponte aereo
  noRetreatUssrThisTurn: boolean; // Ordine 227
  enemyAdvancedHereThisTurn: Side[]; // for Manstein trigger
}

export interface LogEntry {
  id: string;
  turn: TurnId;
  side?: Side;
  type: 'INFO' | 'ACTION' | 'COMBAT' | 'EVENT' | 'TURN' | 'VICTORY';
  message: string;
  breakdown?: CombatBreakdown;
}

export interface TurnHistorySnapshot {
  turn: TurnId;
  markers: Record<SectorId, number>;
  axisVp: number;
  axisPp: number;
  ussrPp: number;
}

export interface GameStats {
  turnSnapshots: TurnHistorySnapshot[];
  attacksBySide: Record<Side, number>;
  outcomesBySide: Record<Side, Record<CombatOutcomeType, number>>;
  breakthroughsBySide: Record<Side, number>;
  encirclementsCausedBySide: Record<Side, number>;
  diceTotalBattles: number;
  diceChangedOutcomeCount: number;
  ordersSpentByType: Record<Side, Record<string, number>>;
  ppSpentByCategory: Record<Side, { equipment: number; replacements: number; prototypes: number; events: number }>;
  destroyedLog: { name: string; side: Side; turn: TurnId }[];
}

export interface GameConfig {
  seed: number;
  ordersPerTurn: number;
  initiativeBonusOrders: number;
  handSize: number;
  handMax: number;
  ppCarryMax: number;
  maxReactions: number;
  dice: {
    enabled: boolean;
    table: Record<number, number>;
  };
  outcomeThresholds: {
    disfatta: number;
    respinto: number;
    avanzata: number;
    netta: number;
  };
  supply: {
    axisFreeUntil: number;
    axisDefPenaltyFrom: number;
    ussrPenalty: Record<number, number>;
  };
  encirclement: {
    threatGap: number;
    autoGap: number;
    attritionPerTurn: number;
  };
  experience: {
    veteranXp: number;
    eliteXp: number;
    replacementsDropLevel: boolean;
  };
  victory: {
    axisVpToWin: number;
    axisSuddenDeathCities: number;
    from1944PenaltyAtMarker: number;
  };
  production: {
    axis: number[];
    ussr: number[];
  };
  rebuildCost: {
    ussr: number;
    axis: number;
  };
  axisCanRebuild: boolean;
  prototypeCost: number;
  normandyAllowPayInstead: boolean;
  normandyPayCost: number;
  modules: {
    reserves: boolean;
    encirclement: boolean;
    supply: boolean;
    winter: boolean;
    air: boolean;
    experience: boolean;
    initiativeBonus: boolean;
    surprise: boolean;
    combinedArms: boolean;
    fogOfWar: boolean;
  };
}

export interface GameState {
  config: GameConfig;
  rngState: number;
  turnIndex: number; // 0..8
  turn: TurnId;
  phase: 'NORMANDY_EVENT' | 'ORDERS' | 'COMBAT' | 'GAME_OVER';
  activeSide: Side; // whose turn to issue an order or resolve a prompt
  initiative: Side;
  ordersRemaining: Record<Side, number>;
  passed: Record<Side, boolean>;
  pp: Record<Side, number>;
  axisVp: number;
  winner: Side | null;
  victoryReason: string | null;

  sectors: Record<SectorId, SectorState>;
  formations: Formation[];
  destroyedFormations: DestroyedFormation[];

  hands: Record<Side, Card[]>;
  drawPiles: Record<Side, Card[]>;
  discardPiles: Record<Side, Card[]>;
  futureDecks: Record<Side, Record<number, Card[]>>; // 1942, 1943, 1944
  airZones: Record<Side, AirCard[]>;

  // Persistent / turn flags
  uralsEvacuated: boolean;
  barbarossaPlayedThisTurn: boolean;

  pendingCombat: PendingCombatState | null;
  logs: LogEntry[];
  stats: GameStats;
}

// Serializable Actions
export type GameAction =
  | {
      type: 'ATTACK';
      sector: SectorId;
      eventCardIds?: string[]; // timing ATTACCO
    }
  | {
      type: 'DEFENSE_REACTION';
      reactingFormationIds: string[]; // up to maxReactions (+1 if Zukov)
      eventCardIds?: string[]; // timing DIFESA
    }
  | {
      type: 'ASSIGN_LOSSES';
      side: Side;
      formationId: string;
      amount: number;
    }
  | {
      type: 'ENCIRCLEMENT_DECISION';
      sector: SectorId;
      choice: 'RITIRATA' | 'RESISTERE';
    }
  | {
      type: 'REDEPLOY';
      formationId: string;
      to: LocationId;
    }
  | {
      type: 'EQUIP';
      cardId: string;
      targetFormationId?: string; // for EQUIPAGGIAMENTO_TERRA
      targetSector?: SectorId; // for COMANDANTE
      replaceAirCardId?: string; // if air zone is full (3)
    }
  | {
      type: 'REORGANIZE';
      formationId?: string; // existing formation
      points?: number; // 1..3
      rebuildDestroyedId?: string; // or rebuild a destroyed formation
    }
  | {
      type: 'RETREAT';
      sector: SectorId;
    }
  | {
      type: 'PROTOTYPE';
      chosenCardId: string;
    }
  | {
      type: 'PLAY_EVENT';
      cardId: string;
      targetSector?: SectorId;
      allocations?: { formationId: string; points: number }[]; // for Rimpiazzi
    }
  | {
      type: 'RECONVERT_CARD';
      cardId: string;
    }
  | {
      type: 'RECONVERT_EQUIPMENT';
      formationId: string;
    }
  | {
      type: 'PASS';
    }
  | {
      type: 'RESOLVE_NORMANDY';
      choice: 'PAY_PP' | 'REMOVE_ARMOR';
      formationId?: string;
    };

// Bot / Player interface as required by section 15
export interface Player {
  side: Side;
  chooseAction(state: GameState): GameAction;
}
