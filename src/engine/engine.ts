import {
  buildAnnualDecks,
  createBarbarossaCard,
  createEvacuazioneUraliCard,
} from '../data/cards';
import { cloneConfig, config as defaultConfig } from '../data/config';
import {
  createVolkssturmFormations,
  getInitialAirZones,
  getInitialFormations,
  getReinforcementsForTurn,
} from '../data/formations';
import { areSectorsAdjacent, MAP_DATA, SECTORS } from '../data/map';
import { computeCombat, getSeason } from './combat';
import { shuffleArray } from './rng';
import {
  Card,
  EventCard,
  Formation,
  FormationType,
  GameAction,
  GameConfig,
  GameState,
  GroundEquipmentCard,
  LogEntry,
  SectorId,
  Side,
  TURNS,
} from './types';
import { checkBerlinImmediateVictory, evaluateEndOfTurnVictory } from './victory';

function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s));
}

function addLog(
  state: GameState,
  type: LogEntry['type'],
  message: string,
  side?: Side,
  breakdown?: LogEntry['breakdown']
): void {
  state.logs.push({
    id: `log_${state.logs.length + 1}_${state.turn}`,
    turn: state.turn,
    side,
    type,
    message,
    breakdown,
  });
}

export function canEquipCardOnFormation(card: GroundEquipmentCard, f: Formation): boolean {
  switch (card.requires) {
    case 'C':
      return f.type === 'CORAZZATA';
    case 'FM':
      return f.type === 'FANTERIA' || f.type === 'MOTORIZZATA';
    case 'CM':
      return f.type === 'CORAZZATA' || f.type === 'MOTORIZZATA';
    case 'ANY':
      return true;
  }
}

export function isFormationMobile(f: Formation): boolean {
  const isMotOrArm = f.type === 'CORAZZATA' || f.type === 'MOTORIZZATA';
  const hasHeavy = Boolean(f.equipment?.keywords.includes('PESANTE'));
  return isMotOrArm && !hasHeavy;
}

export function getMaxReactionsForDefender(state: GameState, defender: Side): number {
  if (!state.config.modules.reserves) return 0;
  let max = state.config.maxReactions;
  // Žukov: "+1 formazione può reagire dalla Riserva (ovunque)"
  if (defender === 'USSR') {
    const zukovInPlay = SECTORS.some(
      (s) => state.sectors[s].ussrCommander?.templateId === 'ussr_zukov_41'
    );
    if (zukovInPlay) {
      max += 1;
    }
  }
  return max;
}

export function getEligibleReactingFormations(state: GameState, defender: Side): Formation[] {
  return state.formations.filter(
    (f) =>
      f.side === defender &&
      f.location === 'RISERVA' &&
      !f.encircled &&
      !f.reactedThisTurn &&
      isFormationMobile(f)
  );
}

function drawCardsUpTo(state: GameState, side: Side, targetHandSize: number): void {
  const hand = state.hands[side];
  const maxHand = state.config.handMax;
  const limit = Math.min(targetHandSize, maxHand);

  while (hand.length < limit) {
    if (state.drawPiles[side].length === 0) {
      if (state.discardPiles[side].length === 0) break;
      const shuf = shuffleArray(state.discardPiles[side], state.rngState);
      state.drawPiles[side] = shuf.shuffled;
      state.discardPiles[side] = [];
      state.rngState = shuf.nextState;
      addLog(state, 'INFO', `${side}: Pila degli scarti rimescolata nel mazzo di pesca.`, side);
    }
    const card = state.drawPiles[side].shift();
    if (!card) break;
    hand.push(card);
  }
}

function computeTurnProduction(state: GameState, turnIndex: number): { axisAdded: number; ussrAdded: number } {
  const cfg = state.config;
  let axisProd = cfg.production.axis[turnIndex] ?? 6;
  let ussrProd = cfg.production.ussr[turnIndex] ?? 12;

  // Modifiers (section 7)
  // Asse +2 se controlla il Caucaso (marker SUD = 6)
  if (state.sectors.SUD.marker === 6) {
    axisProd += 2;
  }

  // URSS -2 per ogni città fra Mosca e Stalingrado controllata dall'Asse
  if (state.sectors.CENTRO.marker >= 5) {
    ussrProd -= 2;
  }
  if (state.sectors.SUD.marker >= 5) {
    ussrProd -= 2;
  }

  // URSS +2 a partire da E42 se nel 1941 ha giocato Evacuazione oltre gli Urali
  if (turnIndex >= 2 && state.uralsEvacuated) {
    ussrProd += 2;
  }

  ussrProd = Math.max(0, ussrProd);

  state.pp.AXIS = Math.min(state.pp.AXIS, cfg.ppCarryMax) + axisProd;
  state.pp.USSR = Math.min(state.pp.USSR, cfg.ppCarryMax) + ussrProd;

  return { axisAdded: axisProd, ussrAdded: ussrProd };
}

function assignOrdersForTurn(state: GameState): void {
  const base = state.config.ordersPerTurn;
  const bonus = state.config.modules.initiativeBonus ? state.config.initiativeBonusOrders : 0;

  state.ordersRemaining.AXIS = base + (state.initiative === 'AXIS' ? bonus : 0);
  state.ordersRemaining.USSR = base + (state.initiative === 'USSR' ? bonus : 0);
  state.passed.AXIS = false;
  state.passed.USSR = false;
  state.activeSide = state.initiative;
}

export function createInitialState(customConfig?: Partial<GameConfig>): GameState {
  const cfg: GameConfig = {
    ...cloneConfig(defaultConfig),
    ...customConfig,
    modules: {
      ...defaultConfig.modules,
      ...(customConfig?.modules ?? {}),
    },
  };

  let rng = cfg.seed;

  const axisDecks = buildAnnualDecks('AXIS');
  const ussrDecks = buildAnnualDecks('USSR');

  const shufAxis41 = shuffleArray(axisDecks[1941], rng);
  rng = shufAxis41.nextState;
  const shufUssr41 = shuffleArray(ussrDecks[1941], rng);
  rng = shufUssr41.nextState;

  const axisDraw = shufAxis41.shuffled;
  const ussrDraw = shufUssr41.shuffled;

  // Initial hands: Barbarossa + 4 cards from 1941 deck; Evacuazione + 4 cards from 1941 deck
  const axisHand: Card[] = [createBarbarossaCard(), ...axisDraw.splice(0, Math.max(0, cfg.handSize - 1))];
  const ussrHand: Card[] = [createEvacuazioneUraliCard(), ...ussrDraw.splice(0, Math.max(0, cfg.handSize - 1))];

  const state: GameState = {
    config: cfg,
    rngState: rng,
    turnIndex: 0,
    turn: 'E41',
    phase: 'ORDERS',
    activeSide: 'AXIS',
    initiative: 'AXIS',
    ordersRemaining: { AXIS: 0, USSR: 0 },
    passed: { AXIS: false, USSR: false },
    pp: { AXIS: 0, USSR: 0 },
    axisVp: 0,
    winner: null,
    victoryReason: null,

    sectors: {
      NORD: {
        id: 'NORD',
        marker: 1,
        axisCommander: null,
        ussrCommander: null,
        retreatedSidesThisTurn: [],
        airliftProtectedThisTurn: false,
        noRetreatUssrThisTurn: false,
        enemyAdvancedHereThisTurn: [],
      },
      CENTRO: {
        id: 'CENTRO',
        marker: 1,
        axisCommander: null,
        ussrCommander: null,
        retreatedSidesThisTurn: [],
        airliftProtectedThisTurn: false,
        noRetreatUssrThisTurn: false,
        enemyAdvancedHereThisTurn: [],
      },
      SUD: {
        id: 'SUD',
        marker: 1,
        axisCommander: null,
        ussrCommander: null,
        retreatedSidesThisTurn: [],
        airliftProtectedThisTurn: false,
        noRetreatUssrThisTurn: false,
        enemyAdvancedHereThisTurn: [],
      },
    },
    formations: getInitialFormations(),
    destroyedFormations: [],

    hands: { AXIS: axisHand, USSR: ussrHand },
    drawPiles: { AXIS: axisDraw, USSR: ussrDraw },
    discardPiles: { AXIS: [], USSR: [] },
    futureDecks: {
      AXIS: { 1942: axisDecks[1942], 1943: axisDecks[1943], 1944: axisDecks[1944] },
      USSR: { 1942: ussrDecks[1942], 1943: ussrDecks[1943], 1944: ussrDecks[1944] },
    },
    airZones: getInitialAirZones(),

    uralsEvacuated: false,
    barbarossaPlayedThisTurn: false,
    pendingCombat: null,
    logs: [],
    stats: {
      turnSnapshots: [],
      attacksBySide: { AXIS: 0, USSR: 0 },
      outcomesBySide: {
        AXIS: { DISFATTA: 0, RESPINTO: 0, AVANZATA: 0, VITTORIA_NETTA: 0, SFONDAMENTO: 0 },
        USSR: { DISFATTA: 0, RESPINTO: 0, AVANZATA: 0, VITTORIA_NETTA: 0, SFONDAMENTO: 0 },
      },
      breakthroughsBySide: { AXIS: 0, USSR: 0 },
      encirclementsCausedBySide: { AXIS: 0, USSR: 0 },
      diceTotalBattles: 0,
      diceChangedOutcomeCount: 0,
      ordersSpentByType: { AXIS: {}, USSR: {} },
      ppSpentByCategory: {
        AXIS: { equipment: 0, replacements: 0, prototypes: 0, events: 0 },
        USSR: { equipment: 0, replacements: 0, prototypes: 0, events: 0 },
      },
      destroyedLog: [],
    },
  };

  computeTurnProduction(state, 0);
  assignOrdersForTurn(state);

  addLog(
    state,
    'TURN',
    `Inizio partita — Turno E41 (Estate 1941). Iniziativa: Asse. Produzione: Asse ${state.pp.AXIS} PP, URSS ${state.pp.USSR} PP.`
  );

  return state;
}

function applyLossToFormation(state: GameState, f: Formation, loss: number): void {
  f.strength = Math.max(0, f.strength - loss);
  if (f.strength === 0) {
    // Destroyed!
    state.formations = state.formations.filter((item) => item.id !== f.id);
    // Equipment is lost (discarded)
    if (f.equipment) {
      state.discardPiles[f.side].push(f.equipment);
    }
    state.destroyedFormations.push({
      id: f.id,
      name: f.name,
      baseName: f.baseName,
      side: f.side,
      type: f.type,
      keywords: f.keywords,
      destroyedTurn: state.turn,
    });
    state.stats.destroyedLog.push({ name: f.name, side: f.side, turn: state.turn });
    addLog(state, 'COMBAT', `💥 ${f.name} (${f.side}) è stata DISTRUTTA!`, f.side);
  }
}

export function promoteFormationIfNeeded(state: GameState, f: Formation): void {
  if (!state.config.modules.experience) return;
  const { veteranXp, eliteXp } = state.config.experience;

  if (f.level === 'RECLUTA' && f.xp >= veteranXp) {
    f.level = 'VETERANA';
    if (f.side === 'USSR' && !f.keywords.includes('GUARDIA')) {
      f.keywords.push('GUARDIA');
      if (!f.name.includes('della Guardia')) {
        f.name = `${f.name} della Guardia`;
      }
      f.maxStrength += 1;
      f.strength += 1; // Promotion to Guards grants +1 maxStrength and +1 current strength
      addLog(
        state,
        'INFO',
        `⭐ Promozione: ${f.baseName} diventa VETERANA e riceve il titolo "${f.name}" (+1 Forza max)!`,
        'USSR'
      );
    } else {
      addLog(state, 'INFO', `⭐ Promozione: ${f.name} è ora VETERANA!`, f.side);
    }
  }

  if (f.level === 'VETERANA' && f.xp >= eliteXp) {
    f.level = 'ELITE';
    addLog(state, 'INFO', `⭐⭐ Promozione: ${f.name} è ora ELITE!`, f.side);
  }
}

function dropFormationExperienceLevel(state: GameState, f: Formation): void {
  if (!state.config.modules.experience || !state.config.experience.replacementsDropLevel) return;
  if (f.level === 'ELITE') {
    f.level = 'VETERANA';
    f.xp = state.config.experience.veteranXp;
    addLog(state, 'INFO', `${f.name} scende da ELITE a VETERANA per l'afflusso di rimpiazzi.`, f.side);
  } else if (f.level === 'VETERANA') {
    f.level = 'RECLUTA';
    f.xp = 0;
    addLog(state, 'INFO', `${f.name} scende da VETERANA a RECLUTA per l'afflusso di rimpiazzi.`, f.side);
  }
}

function advanceOrderTurnControl(state: GameState, actingSide: Side): void {
  const otherSide: Side = actingSide === 'AXIS' ? 'USSR' : 'AXIS';

  // Check if both sides have 0 orders or passed
  const actingDone = state.passed[actingSide] || state.ordersRemaining[actingSide] <= 0;
  const otherDone = state.passed[otherSide] || state.ordersRemaining[otherSide] <= 0;

  if (actingDone && otherDone) {
    endCurrentTurn(state);
    return;
  }

  if (!otherDone) {
    state.activeSide = otherSide;
  } else {
    state.activeSide = actingSide;
  }
}

function endCurrentTurn(state: GameState): void {
  addLog(state, 'TURN', `--- Fine del turno ${state.turn} ---`);

  // 5.1 Logoramento delle formazioni accerchiate (6.6)
  if (state.config.modules.encirclement) {
    const encircledUnits = state.formations.filter((f) => f.encircled);
    for (const f of encircledUnits) {
      const sec = f.location as SectorId;
      if (f.side === 'AXIS' && state.sectors[sec]?.airliftProtectedThisTurn) {
        addLog(state, 'INFO', `Ponte aereo protegge ${f.name} dal logoramento in ${sec}.`, 'AXIS');
        continue;
      }
      const attr = state.config.encirclement.attritionPerTurn;
      if (attr > 0) {
        addLog(state, 'INFO', `Logoramento sacca: ${f.name} in ${sec} perde ${attr} Forza.`, f.side);
        applyLossToFormation(state, f, attr);
      }
    }

    // 5.2 Verifica della liberazione dalle sacche:
    // "se la differenza tra il marker del loro settore e quello del settore adiacente che ha causato la sacca torna sotto 2, le formazioni tornano rifornite"
    for (const f of state.formations) {
      if (!f.encircled || f.location === 'RISERVA') continue;
      const sec = f.location as SectorId;
      const myMarker = state.sectors[sec].marker;
      const causes = f.encircledBySectors.length > 0 ? f.encircledBySectors : MAP_DATA[sec].adjacent;

      const stillTrapped = causes.some((adjSec) => {
        const adjMarker = state.sectors[adjSec].marker;
        // For USSR trapped in sec, Axis pushed adjSec ahead (adjMarker - myMarker >= threatGap)
        // For AXIS trapped in sec, USSR pushed adjSec back (myMarker - adjMarker >= threatGap)
        const gap = Math.abs(adjMarker - myMarker);
        return gap >= state.config.encirclement.threatGap;
      });

      if (!stillTrapped) {
        f.encircled = false;
        f.encircledBySectors = [];
        addLog(state, 'INFO', `Liberazione: ${f.name} in ${sec} non è più accerchiata!`, f.side);
      }
    }
  }

  // 5.3 Promozioni per esperienza
  for (const f of state.formations) {
    promoteFormationIfNeeded(state, f);
  }

  // 5.4 Punti vittoria (sezione 8) e verifica della vittoria
  const vic = evaluateEndOfTurnVictory(state);
  state.axisVp += vic.vpDelta;
  if (vic.vpBreakdown.length > 0) {
    addLog(
      state,
      'INFO',
      `Punti Vittoria Asse fine turno: ${vic.vpDelta >= 0 ? '+' : ''}${vic.vpDelta} (${vic.vpBreakdown.join(', ')}) → Totale: ${state.axisVp} PV.`
    );
  } else {
    addLog(state, 'INFO', `Punti Vittoria Asse invariati: ${state.axisVp} PV.`);
  }

  // Save turn snapshot for M3 analytics
  state.stats.turnSnapshots.push({
    turn: state.turn,
    markers: {
      NORD: state.sectors.NORD.marker,
      CENTRO: state.sectors.CENTRO.marker,
      SUD: state.sectors.SUD.marker,
    },
    axisVp: state.axisVp,
    axisPp: state.pp.AXIS,
    ussrPp: state.pp.USSR,
  });

  if (vic.winner) {
    state.winner = vic.winner;
    state.victoryReason = vic.reason;
    state.phase = 'GAME_OVER';
    addLog(state, 'VICTORY', `🏆 VITTORIA ${vic.winner}: ${vic.reason}`, vic.winner);
    return;
  }

  // 5.5 Reset dei flag exhausted e reactedThisTurn
  for (const f of state.formations) {
    f.exhausted = false;
    f.reactedThisTurn = false;
  }
  for (const sec of SECTORS) {
    state.sectors[sec].retreatedSidesThisTurn = [];
    state.sectors[sec].airliftProtectedThisTurn = false;
    state.sectors[sec].noRetreatUssrThisTurn = false;
    state.sectors[sec].enemyAdvancedHereThisTurn = [];
  }
  state.barbarossaPlayedThisTurn = false;

  // 5.6 Avanzamento della stagione
  const nextIndex = state.turnIndex + 1;
  if (nextIndex >= TURNS.length) {
    state.phase = 'GAME_OVER';
    return;
  }

  state.turnIndex = nextIndex;
  state.turn = TURNS[nextIndex];

  startNewTurn(state);
}

function startNewTurn(state: GameState): void {
  const turn = state.turn;
  addLog(state, 'TURN', `=== Inizio turno ${turn} (${getSeason(turn)}) ===`);

  // 1.1 Rinforzi del turno entrano nella Riserva del proprietario
  const reinf = getReinforcementsForTurn(turn);
  for (const r of reinf) {
    state.formations.push(r);
    addLog(state, 'INFO', `Rinforzo arrivato in Riserva (${r.side}): ${r.name}.`, r.side);
  }

  // 1.2 Se è il primo turno di un nuovo anno (E42, E43, E44), il mazzo di quell'anno viene mescolato nella pila di pesca
  if (turn === 'E42' || turn === 'E43' || turn === 'E44') {
    const year = turn === 'E42' ? 1942 : turn === 'E43' ? 1943 : 1944;
    for (const side of ['AXIS', 'USSR'] as Side[]) {
      const annualCards = state.futureDecks[side][year] ?? [];
      if (annualCards.length > 0) {
        const combined = [...state.drawPiles[side], ...annualCards];
        state.futureDecks[side][year] = [];
        const shuf = shuffleArray(combined, state.rngState);
        state.drawPiles[side] = shuf.shuffled;
        state.rngState = shuf.nextState;
        addLog(
          state,
          'INFO',
          `${side}: Il mazzo annuale ${year} (${annualCards.length} carte) è stato mescolato nella pila di pesca.`,
          side
        );
      }
    }
  }

  // 2. Produzione
  const prod = computeTurnProduction(state, state.turnIndex);
  addLog(
    state,
    'INFO',
    `Produzione turno ${turn}: Asse +${prod.axisAdded} PP (tot ${state.pp.AXIS}), URSS +${prod.ussrAdded} PP (tot ${state.pp.USSR}).`
  );

  // 3. Pesca fino a handSize (default 5)
  drawCardsUpTo(state, 'AXIS', state.config.handSize);
  drawCardsUpTo(state, 'USSR', state.config.handSize);

  // 4. Ordini
  assignOrdersForTurn(state);

  // 1.1 Evento programmato E44: Sbarco in Normandia
  if (turn === 'E44') {
    state.phase = 'NORMANDY_EVENT';
    state.activeSide = 'AXIS';
    addLog(
      state,
      'EVENT',
      'Evento obbligatorio "Sbarco in Normandia": l’Asse deve rimuovere dal gioco 1 formazione CORAZZATA o pagare 6 PP.',
      'AXIS'
    );
  } else {
    state.phase = 'ORDERS';
  }
}

function finalizeCombatPostLosses(state: GameState): void {
  const pc = state.pendingCombat;
  if (!pc || !pc.breakdown) return;

  const { breakdown, sector, attacker, defender } = pc;
  const secState = state.sectors[sector];

  // Move marker if markerShift > 0
  if (breakdown.markerShift > 0) {
    const oldMarker = secState.marker;
    if (attacker === 'AXIS') {
      secState.marker = Math.min(6, secState.marker + breakdown.markerShift);
    } else {
      secState.marker = Math.max(0, secState.marker - breakdown.markerShift);
    }
    if (secState.marker !== oldMarker) {
      if (!secState.enemyAdvancedHereThisTurn.includes(attacker)) {
        secState.enemyAdvancedHereThisTurn.push(attacker);
      }
      addLog(
        state,
        'COMBAT',
        `Il fronte nel settore ${sector} avanza da ${oldMarker} a ${secState.marker} (${MAP_DATA[sector].cells[secState.marker].name}).`,
        attacker
      );
    }
  }

  // Check immediate Berlin victory
  const berlin = checkBerlinImmediateVictory(state);
  if (berlin.winner) {
    state.winner = berlin.winner;
    state.victoryReason = berlin.reason;
    state.pendingCombat = null;
    state.phase = 'GAME_OVER';
    addLog(state, 'VICTORY', `🏆 VITTORIA ${berlin.winner}: ${berlin.reason}`, berlin.winner);
    return;
  }

  // Initiative pass
  if (breakdown.initiativePassedTo && state.initiative !== breakdown.initiativePassedTo) {
    state.initiative = breakdown.initiativePassedTo;
    addLog(state, 'COMBAT', `⚡ L'iniziativa passa a ${state.initiative}!`, state.initiative);
  }

  // Experience gain (6.9): |DIFF| >= 3 in own favor -> +1 XP to all participating formations of that side
  if (state.config.modules.experience && Math.abs(breakdown.finalDiff) >= 3) {
    const winnerSide: Side = breakdown.finalDiff >= 3 ? attacker : defender;
    const participantIds =
      winnerSide === attacker
        ? pc.attackerIds
        : state.formations
            .filter((f) => f.side === defender && f.location === sector)
            .map((f) => f.id);

    for (const fid of participantIds) {
      const f = state.formations.find((unit) => unit.id === fid);
      if (f) {
        f.xp += 1;
        addLog(state, 'INFO', `${f.name} guadagna +1 XP (totale ${f.xp} XP).`, f.side);
      }
    }
  }

  // Check Encirclement on SFONDAMENTO (6.6)
  if (breakdown.outcome === 'SFONDAMENTO' && state.config.modules.encirclement) {
    const newMarkerX = secState.marker;
    const threatened: SectorId[] = [];

    for (const adjY of MAP_DATA[sector].adjacent) {
      const markerY = state.sectors[adjY].marker;
      const gap = Math.abs(newMarkerX - markerY);
      const defenderUnitsInY = state.formations.filter(
        (f) => f.side === defender && f.location === adjY && !f.encircled
      );

      // Verify the direction of the salient actually traps the defender:
      // If Axis broke through in X, Axis advanced to a higher marker than Y (newMarkerX - markerY >= threatGap)
      // If USSR broke through in X, USSR pushed marker X lower than Y (markerY - newMarkerX >= threatGap)
      const isSalientAgainstDefender =
        attacker === 'AXIS'
          ? newMarkerX - markerY >= state.config.encirclement.threatGap
          : markerY - newMarkerX >= state.config.encirclement.threatGap;

      if (isSalientAgainstDefender && defenderUnitsInY.length > 0) {
        if (gap >= state.config.encirclement.autoGap) {
          // Automatic encirclement!
          for (const u of defenderUnitsInY) {
            u.encircled = true;
            if (!u.encircledBySectors.includes(sector)) {
              u.encircledBySectors.push(sector);
            }
          }
          state.stats.encirclementsCausedBySide[attacker] += defenderUnitsInY.length;
          addLog(
            state,
            'COMBAT',
            `⛓️ Accerchiamento automatico in ${adjY} (divario fronte = ${gap} ≥ ${state.config.encirclement.autoGap})! ${defenderUnitsInY.map((u) => u.name).join(', ')} sono insaccate!`,
            attacker
          );
        } else {
          // If defender played Order 227 in adjY this turn, cannot retreat!
          const order227Blocked = defender === 'USSR' && state.sectors[adjY].noRetreatUssrThisTurn;
          const canRetreatMarker =
            defender === 'USSR' ? state.sectors[adjY].marker < 6 : state.sectors[adjY].marker > 0;

          if (order227Blocked || !canRetreatMarker) {
            for (const u of defenderUnitsInY) {
              u.encircled = true;
              if (!u.encircledBySectors.includes(sector)) {
                u.encircledBySectors.push(sector);
              }
            }
            state.stats.encirclementsCausedBySide[attacker] += defenderUnitsInY.length;
            addLog(
              state,
              'COMBAT',
              `⛓️ Accerchiamento in ${adjY} (ritirata impossibile): ${defenderUnitsInY.map((u) => u.name).join(', ')} sono insaccate!`,
              attacker
            );
          } else {
            threatened.push(adjY);
          }
        }
      }
    }

    if (threatened.length > 0) {
      pc.threatenedSectors = threatened;
      pc.phase = 'ENCIRCLEMENT_CHOICE';
      state.activeSide = defender;
      return;
    }
  }

  // Combat is completely finished
  state.pendingCombat = null;
  state.phase = 'ORDERS';
  advanceOrderTurnControl(state, attacker);
}

function resolveCombatCalculation(state: GameState): void {
  const pc = state.pendingCombat;
  if (!pc) return;

  const { sector, attacker, defender, attackerIds, attackEvents, defenseEvents, elasticRetreatPlayed } = pc;

  // Apply Elastic Retreat marker move BEFORE combat calculation if played
  if (elasticRetreatPlayed) {
    const secState = state.sectors[sector];
    if (defender === 'AXIS' && secState.marker > 0) {
      secState.marker -= 1;
      if (!secState.retreatedSidesThisTurn.includes('AXIS')) {
        secState.retreatedSidesThisTurn.push('AXIS');
      }
      addLog(
        state,
        'COMBAT',
        `Ritirata elastica: l'Asse arretra il fronte in ${sector} a ${secState.marker} prima dell'impatto (+2 Difesa).`,
        'AXIS'
      );
    }
  }

  const attackingUnits = state.formations.filter((f) => attackerIds.includes(f.id));
  const defendingUnits = state.formations.filter((f) => f.side === defender && f.location === sector);

  const { breakdown, nextRngState } = computeCombat(
    state,
    sector,
    attacker,
    attackingUnits,
    defendingUnits,
    attackEvents,
    defenseEvents,
    elasticRetreatPlayed
  );

  state.rngState = nextRngState;
  pc.breakdown = breakdown;
  pc.remainingAttackerLosses = breakdown.attackerLosses;
  pc.remainingDefenderLosses = breakdown.defenderLosses;

  // Update stats
  state.stats.attacksBySide[attacker] += 1;
  state.stats.outcomesBySide[attacker][breakdown.outcome] += 1;
  if (breakdown.outcome === 'SFONDAMENTO') {
    state.stats.breakthroughsBySide[attacker] += 1;
  }
  if (state.config.dice.enabled) {
    state.stats.diceTotalBattles += 1;
    if (breakdown.diceChangedOutcome) {
      state.stats.diceChangedOutcomeCount += 1;
    }
  }

  addLog(
    state,
    'COMBAT',
    `⚔️ Battaglia in ${sector} (${attacker} vs ${defender}): Attacco ${breakdown.totalAttack} vs Difesa ${breakdown.totalDefense}` +
      (breakdown.diceRoll !== null ? `, Dado ${breakdown.diceRoll} (${breakdown.diceModifier >= 0 ? '+' : ''}${breakdown.diceModifier})` : '') +
      ` → DIFF ${breakdown.finalDiff} → ${breakdown.outcome}!`,
    attacker,
    breakdown
  );

  stepCombatLossPhase(state);
}

function stepCombatLossPhase(state: GameState): void {
  const pc = state.pendingCombat;
  if (!pc) return;

  const atkUnits = state.formations.filter(
    (f) => f.side === pc.attacker && f.location === pc.sector && pc.attackerIds.includes(f.id)
  );
  if (atkUnits.length === 0) {
    pc.remainingAttackerLosses = 0;
  }

  if (pc.remainingAttackerLosses > 0) {
    pc.phase = 'ATTACKER_LOSSES';
    state.activeSide = pc.attacker;
    return;
  }

  const defUnits = state.formations.filter((f) => f.side === pc.defender && f.location === pc.sector);
  if (defUnits.length === 0) {
    pc.remainingDefenderLosses = 0;
  }

  if (pc.remainingDefenderLosses > 0) {
    pc.phase = 'DEFENDER_LOSSES';
    state.activeSide = pc.defender;
    return;
  }

  finalizeCombatPostLosses(state);
}

function recordOrderSpent(state: GameState, side: Side, actionType: string): void {
  state.ordersRemaining[side] = Math.max(0, state.ordersRemaining[side] - 1);
  state.stats.ordersSpentByType[side][actionType] =
    (state.stats.ordersSpentByType[side][actionType] ?? 0) + 1;
}

export function applyAction(currentState: GameState, action: GameAction): GameState {
  const state = cloneState(currentState);
  if (state.phase === 'GAME_OVER') {
    throw new Error('La partita è già terminata.');
  }

  // Handle Normandy mandatory event in E44
  if (state.phase === 'NORMANDY_EVENT') {
    if (action.type !== 'RESOLVE_NORMANDY') {
      throw new Error('Devi prima risolvere l’evento obbligatorio "Sbarco in Normandia".');
    }
    if (action.choice === 'PAY_PP') {
      if (!state.config.normandyAllowPayInstead) {
        throw new Error('La configurazione non permette di pagare PP per la Normandia.');
      }
      if (state.pp.AXIS < state.config.normandyPayCost) {
        throw new Error('PP insufficienti per pagare il costo dello Sbarco in Normandia.');
      }
      state.pp.AXIS -= state.config.normandyPayCost;
      state.stats.ppSpentByCategory.AXIS.events += state.config.normandyPayCost;
      addLog(
        state,
        'EVENT',
        `Sbarco in Normandia: l'Asse paga ${state.config.normandyPayCost} PP per mantenere le divisioni corazzate sul Fronte Orientale.`,
        'AXIS'
      );
    } else {
      const f = state.formations.find(
        (u) => u.id === action.formationId && u.side === 'AXIS' && u.type === 'CORAZZATA'
      );
      if (!f) {
        throw new Error('Seleziona una formazione CORAZZATA dell’Asse valida da trasferire ad Ovest.');
      }
      state.formations = state.formations.filter((u) => u.id !== f.id);
      if (f.equipment) {
        state.discardPiles.AXIS.push(f.equipment);
      }
      addLog(
        state,
        'EVENT',
        `Sbarco in Normandia: ${f.name} viene trasferita sul Fronte Occidentale e rimossa dal gioco.`,
        'AXIS'
      );
    }
    state.phase = 'ORDERS';
    state.activeSide = state.initiative;
    return state;
  }

  // Handle multi-step COMBAT prompts
  if (state.phase === 'COMBAT') {
    const pc = state.pendingCombat;
    if (!pc) throw new Error('Stato di combattimento mancante.');

    if (pc.phase === 'REACTION') {
      if (action.type !== 'DEFENSE_REACTION') {
        throw new Error('In attesa della reazione del difensore.');
      }
      const maxReact = pc.maskirovkaPlayed ? 0 : getMaxReactionsForDefender(state, pc.defender);
      if (action.reactingFormationIds.length > maxReact) {
        throw new Error(`Puoi far reagire al massimo ${maxReact} formazioni.`);
      }

      for (const fid of action.reactingFormationIds) {
        const f = state.formations.find((u) => u.id === fid);
        if (
          !f ||
          f.side !== pc.defender ||
          f.location !== 'RISERVA' ||
          f.encircled ||
          f.reactedThisTurn ||
          !isFormationMobile(f)
        ) {
          throw new Error(`La formazione ${fid} non è idonea a reagire dalla Riserva.`);
        }
        f.location = pc.sector;
        f.reactedThisTurn = true;
        pc.reactedIds.push(f.id);
        addLog(
          state,
          'COMBAT',
          `Reazione dalla Riserva: ${f.name} si sposta in ${pc.sector} per difendere!`,
          pc.defender
        );
      }

      // Play defense events if any
      for (const cid of action.eventCardIds ?? []) {
        const cardIdx = state.hands[pc.defender].findIndex((c) => c.id === cid);
        if (cardIdx === -1) throw new Error(`Carta evento difesa ${cid} non in mano.`);
        const card = state.hands[pc.defender][cardIdx];
        if (card.type !== 'EVENTO' || card.timing !== 'DIFESA') {
          throw new Error(`La carta ${card.name} non è un evento di DIFESA.`);
        }
        state.hands[pc.defender].splice(cardIdx, 1);
        state.discardPiles[pc.defender].push(card);
        pc.defenseEvents.push(card);

        if (card.templateId === 'axis_ritirata_elastica_43') {
          pc.elasticRetreatPlayed = true;
        } else if (card.templateId === 'ussr_ordine_227_42') {
          pc.order227Played = true;
          state.sectors[pc.sector].noRetreatUssrThisTurn = true;
        }
        addLog(state, 'EVENT', `${pc.defender} gioca evento di difesa: ${card.name}.`, pc.defender);
      }

      resolveCombatCalculation(state);
      return state;
    }

    if (pc.phase === 'ATTACKER_LOSSES' || pc.phase === 'DEFENDER_LOSSES') {
      if (action.type !== 'ASSIGN_LOSSES') {
        throw new Error('Devi assegnare le perdite di combattimento.');
      }
      const expectedSide = pc.phase === 'ATTACKER_LOSSES' ? pc.attacker : pc.defender;
      if (action.side !== expectedSide) {
        throw new Error(`Tocca a ${expectedSide} assegnare le perdite.`);
      }
      const f = state.formations.find(
        (u) => u.id === action.formationId && u.side === expectedSide && u.location === pc.sector
      );
      if (!f) {
        throw new Error('Formazione non valida per assegnare le perdite.');
      }
      if (expectedSide === pc.attacker && !pc.attackerIds.includes(f.id)) {
        throw new Error('Solo le formazioni che hanno partecipato all’attacco possono subire queste perdite.');
      }

      const maxRemaining =
        pc.phase === 'ATTACKER_LOSSES' ? pc.remainingAttackerLosses : pc.remainingDefenderLosses;
      const amount = Math.min(action.amount, f.strength, maxRemaining);
      if (amount <= 0) {
        throw new Error('Quantità di perdite non valida.');
      }

      addLog(state, 'COMBAT', `${f.name} subisce ${amount} perdit${amount === 1 ? 'a' : 'e'}.`, expectedSide);
      applyLossToFormation(state, f, amount);

      if (pc.phase === 'ATTACKER_LOSSES') {
        pc.remainingAttackerLosses -= amount;
      } else {
        pc.remainingDefenderLosses -= amount;
      }

      stepCombatLossPhase(state);
      return state;
    }

    if (pc.phase === 'ENCIRCLEMENT_CHOICE') {
      if (action.type !== 'ENCIRCLEMENT_DECISION') {
        throw new Error('Devi decidere tra Ritirata o Resistere nel settore minacciato.');
      }
      const idx = pc.threatenedSectors.indexOf(action.sector);
      if (idx === -1) {
        throw new Error(`Il settore ${action.sector} non è tra quelli minacciati.`);
      }

      const def = pc.defender;
      const unitsInY = state.formations.filter(
        (f) => f.side === def && f.location === action.sector && !f.encircled
      );

      if (action.choice === 'RITIRATA') {
        if (def === 'USSR' && state.sectors[action.sector].noRetreatUssrThisTurn) {
          throw new Error('Ordine 227 impedisce la ritirata in questo settore!');
        }
        if (def === 'USSR') {
          state.sectors[action.sector].marker = Math.min(6, state.sectors[action.sector].marker + 1);
        } else {
          state.sectors[action.sector].marker = Math.max(0, state.sectors[action.sector].marker - 1);
        }
        addLog(
          state,
          'COMBAT',
          `${def} sceglie RITIRATA in ${action.sector} per evitare l'accerchiamento (marker → ${state.sectors[action.sector].marker}).`,
          def
        );
        // Check Berlin if Axis retreated to 0 in CENTRO
        const berlin = checkBerlinImmediateVictory(state);
        if (berlin.winner) {
          state.winner = berlin.winner;
          state.victoryReason = berlin.reason;
          state.pendingCombat = null;
          state.phase = 'GAME_OVER';
          addLog(state, 'VICTORY', `🏆 VITTORIA ${berlin.winner}: ${berlin.reason}`, berlin.winner);
          return state;
        }
      } else {
        for (const u of unitsInY) {
          u.encircled = true;
          if (!u.encircledBySectors.includes(pc.sector)) {
            u.encircledBySectors.push(pc.sector);
          }
        }
        state.stats.encirclementsCausedBySide[pc.attacker] += unitsInY.length;
        addLog(
          state,
          'COMBAT',
          `${def} sceglie RESISTERE in ${action.sector}: ${unitsInY.map((u) => u.name).join(', ')} sono ora ACCERCHIATE!`,
          def
        );
      }

      pc.threatenedSectors.splice(idx, 1);
      if (pc.threatenedSectors.length === 0) {
        const atk = pc.attacker;
        state.pendingCombat = null;
        state.phase = 'ORDERS';
        advanceOrderTurnControl(state, atk);
      }
      return state;
    }
  }

  // Phase ORDERS
  const side = state.activeSide;

  // Free actions: RECONVERT_CARD and RECONVERT_EQUIPMENT
  if (action.type === 'RECONVERT_CARD') {
    const idx = state.hands[side].findIndex((c) => c.id === action.cardId);
    if (idx === -1) throw new Error('Carta non trovata nella mano.');
    const card = state.hands[side][idx];
    state.hands[side].splice(idx, 1);
    state.discardPiles[side].push(card);
    const refund = Math.max(1, Math.ceil(card.cost / 2));
    state.pp[side] += refund;
    addLog(state, 'ACTION', `Riconversione: ${side} scarta "${card.name}" per +${refund} PP.`, side);
    return state;
  }

  if (action.type === 'RECONVERT_EQUIPMENT') {
    const f = state.formations.find((u) => u.id === action.formationId && u.side === side);
    if (!f || !f.equipment) throw new Error('Formazione o equipaggiamento non trovato.');
    const eq = f.equipment;
    f.equipment = null;
    state.discardPiles[side].push(eq);
    const refund = Math.max(1, Math.ceil(eq.cost / 2));
    state.pp[side] += refund;
    addLog(
      state,
      'ACTION',
      `Riconversione: ${side} rimuove "${eq.name}" da ${f.name} per +${refund} PP.`,
      side
    );
    return state;
  }

  if (action.type === 'PASS') {
    state.passed[side] = true;
    state.ordersRemaining[side] = 0;
    addLog(state, 'ACTION', `${side} passa il resto della fase Ordini.`, side);
    advanceOrderTurnControl(state, side);
    return state;
  }

  if (state.ordersRemaining[side] <= 0) {
    throw new Error(`Nessun ordine rimasto per ${side}.`);
  }

  switch (action.type) {
    case 'ATTACK': {
      const { sector, eventCardIds = [] } = action;
      const secState = state.sectors[sector];

      if (side === 'AXIS' && secState.marker >= 6) {
        throw new Error('L’Asse controlla già l’intero settore fino alla casella 6.');
      }
      if (side === 'USSR' && secState.marker <= 0) {
        throw new Error('L’URSS controlla già l’intero settore fino alla casella 0.');
      }

      // Eligible attackers: in sector, not exhausted.
      // Note on encircled units (6.6): "possono attaccare solo nel proprio settore", whereas 6.1 says:
      // "L'attaccante sceglie un settore in cui ha almeno 1 formazione non esausta e non accerchiata."
      const hasUnencircledAttacker = state.formations.some(
        (f) => f.side === side && f.location === sector && !f.exhausted && !f.encircled
      );
      const allEligibleAttackers = state.formations.filter(
        (f) => f.side === side && f.location === sector && !f.exhausted
      );

      if (!hasUnencircledAttacker && allEligibleAttackers.length === 0) {
        throw new Error(`Nessuna formazione idonea e non esausta per attaccare in ${sector}.`);
      }

      // Validate and consume attack events
      const playedAttackEvents: EventCard[] = [];
      let maskirovka = false;
      for (const cid of eventCardIds) {
        const idx = state.hands[side].findIndex((c) => c.id === cid);
        if (idx === -1) throw new Error(`Carta evento ${cid} non presente in mano.`);
        const card = state.hands[side][idx];
        if (card.type !== 'EVENTO' || card.timing !== 'ATTACCO') {
          throw new Error(`La carta ${card.name} non ha timing ATTACCO.`);
        }
        if (card.onlyTurn && card.onlyTurn !== state.turn) {
          throw new Error(`La carta ${card.name} può essere giocata solo nel turno ${card.onlyTurn}.`);
        }
        if (card.onlySeason && card.onlySeason !== getSeason(state.turn)) {
          throw new Error(`La carta ${card.name} può essere giocata solo in ${card.onlySeason}.`);
        }
        if (card.allowedSectors && !card.allowedSectors.includes(sector)) {
          throw new Error(`La carta ${card.name} non può essere giocata nel settore ${sector}.`);
        }

        state.hands[side].splice(idx, 1);
        state.discardPiles[side].push(card);
        playedAttackEvents.push(card);

        if (card.templateId.startsWith('ussr_maskirovka')) {
          maskirovka = true;
        }
        if (card.templateId === 'axis_fall_blau_42') {
          state.ordersRemaining[side] += 1;
          addLog(state, 'EVENT', 'Fall Blau conferisce +1 ordine in questo turno!', side);
        }
        addLog(state, 'EVENT', `${side} gioca evento d'attacco: ${card.name}.`, side);
      }

      recordOrderSpent(state, side, 'ATTACCARE');

      for (const f of allEligibleAttackers) {
        f.exhausted = true;
      }

      const defender: Side = side === 'AXIS' ? 'USSR' : 'AXIS';
      state.pendingCombat = {
        phase: 'REACTION',
        sector,
        attacker: side,
        defender,
        attackerIds: allEligibleAttackers.map((f) => f.id),
        attackEvents: playedAttackEvents,
        defenseEvents: [],
        reactedIds: [],
        elasticRetreatPlayed: false,
        order227Played: false,
        maskirovkaPlayed: maskirovka,
        remainingAttackerLosses: 0,
        remainingDefenderLosses: 0,
        threatenedSectors: [],
      };

      // Check if defender can react or play defense events
      const maxReact = maskirovka ? 0 : getMaxReactionsForDefender(state, defender);
      const eligibleReserves = maxReact > 0 ? getEligibleReactingFormations(state, defender) : [];
      const defenseEventsInHand = state.hands[defender].filter(
        (c) => c.type === 'EVENTO' && c.timing === 'DIFESA'
      );

      if (eligibleReserves.length > 0 || defenseEventsInHand.length > 0) {
        state.phase = 'COMBAT';
        state.activeSide = defender;
        addLog(
          state,
          'COMBAT',
          `${side} dichiara un attacco in ${sector} con ${allEligibleAttackers.map((f) => f.name).join(', ')}. In attesa della reazione di ${defender}.`,
          side
        );
      } else {
        state.phase = 'COMBAT';
        resolveCombatCalculation(state);
      }
      return state;
    }

    case 'REDEPLOY': {
      const f = state.formations.find((u) => u.id === action.formationId && u.side === side);
      if (!f) throw new Error('Formazione non trovata.');
      if (f.encircled) throw new Error('Non si possono ridislocare formazioni accerchiate.');
      if (f.location === action.to) throw new Error('La formazione si trova già in quella posizione.');

      const mobile = isFormationMobile(f);
      if (!mobile) {
        // Fanteria o unità con equipaggiamento PESANTE: settore <-> Riserva, oppure settore -> settore adiacente
        const from = f.location;
        const to = action.to;
        const valid =
          from === 'RISERVA' ||
          to === 'RISERVA' ||
          areSectorsAdjacent(from as SectorId, to as SectorId);
        if (!valid) {
          throw new Error(
            `${f.name} non è mobile (o ha equipaggiamento PESANTE) e non può spostarsi direttamente da ${from} a ${to}.`
          );
        }
      }

      const oldLoc = f.location;
      f.location = action.to;
      recordOrderSpent(state, side, 'RIDISLOCARE');
      addLog(state, 'ACTION', `Ridispiegamento: ${f.name} si sposta da ${oldLoc} a ${action.to}.`, side);
      advanceOrderTurnControl(state, side);
      return state;
    }

    case 'EQUIP': {
      const cardIdx = state.hands[side].findIndex((c) => c.id === action.cardId);
      if (cardIdx === -1) throw new Error('Carta non trovata nella mano.');
      const card = state.hands[side][cardIdx];

      if (state.pp[side] < card.cost) {
        throw new Error(`PP insufficienti (costo ${card.cost}, disponibili ${state.pp[side]}).`);
      }

      if (card.type === 'EQUIPAGGIAMENTO_TERRA') {
        const f = state.formations.find((u) => u.id === action.targetFormationId && u.side === side);
        if (!f) throw new Error('Seleziona una formazione valida a cui assegnare l’equipaggiamento.');
        if (f.encircled) throw new Error('Non si può equipaggiare una formazione accerchiata.');
        if (!canEquipCardOnFormation(card, f)) {
          throw new Error(`La formazione ${f.name} (${f.type}) non soddisfa il requisito (${card.requires}) di ${card.name}.`);
        }

        state.pp[side] -= card.cost;
        state.stats.ppSpentByCategory[side].equipment += card.cost;
        state.hands[side].splice(cardIdx, 1);

        if (f.equipment) {
          state.discardPiles[side].push(f.equipment);
        }
        f.equipment = card;
        recordOrderSpent(state, side, 'EQUIPAGGIARE');
        addLog(
          state,
          'ACTION',
          `Equipaggiamento: ${side} assegna ${card.name} (+${card.atk}/+${card.def}) a ${f.name} (−${card.cost} PP).`,
          side
        );
      } else if (card.type === 'AEREO') {
        const airZone = state.airZones[side];
        if (airZone.length >= 3) {
          if (!action.replaceAirCardId) {
            throw new Error('Zona Aviazione piena (max 3 aerei). Scegli un aereo da sostituire.');
          }
          const repIdx = airZone.findIndex((a) => a.id === action.replaceAirCardId);
          if (repIdx === -1) throw new Error('Aereo da sostituire non trovato.');
          const removed = airZone.splice(repIdx, 1)[0];
          state.discardPiles[side].push(removed);
        }
        state.pp[side] -= card.cost;
        state.stats.ppSpentByCategory[side].equipment += card.cost;
        state.hands[side].splice(cardIdx, 1);
        airZone.push(card);
        recordOrderSpent(state, side, 'EQUIPAGGIARE');
        addLog(
          state,
          'ACTION',
          `Aviazione: ${side} schiera ${card.name} (Caccia ${card.caccia}, Supporto ${card.supporto}) (−${card.cost} PP).`,
          side
        );
      } else if (card.type === 'COMANDANTE') {
        const sec = action.targetSector;
        if (!sec) throw new Error('Seleziona un settore per il Comandante.');
        state.pp[side] -= card.cost;
        state.stats.ppSpentByCategory[side].equipment += card.cost;
        state.hands[side].splice(cardIdx, 1);

        const secState = state.sectors[sec];
        if (side === 'AXIS') {
          if (secState.axisCommander) state.discardPiles.AXIS.push(secState.axisCommander);
          secState.axisCommander = card;
        } else {
          if (secState.ussrCommander) state.discardPiles.USSR.push(secState.ussrCommander);
          secState.ussrCommander = card;
        }
        recordOrderSpent(state, side, 'EQUIPAGGIARE');
        addLog(state, 'ACTION', `Comandante: ${side} assegna ${card.name} al settore ${sec} (−${card.cost} PP).`, side);
      } else {
        throw new Error('Usa GIOCARE EVENTO per le carte evento.');
      }

      advanceOrderTurnControl(state, side);
      return state;
    }

    case 'REORGANIZE': {
      if (action.rebuildDestroyedId) {
        if (side === 'AXIS' && !state.config.axisCanRebuild) {
          throw new Error('La ricostituzione per l’Asse è disabilitata nelle impostazioni.');
        }
        const cost = side === 'AXIS' ? state.config.rebuildCost.axis : state.config.rebuildCost.ussr;
        if (state.pp[side] < cost) {
          throw new Error(`PP insufficienti per ricostituire (richiesti ${cost} PP).`);
        }
        const dIdx = state.destroyedFormations.findIndex(
          (d) => d.id === action.rebuildDestroyedId && d.side === side
        );
        if (dIdx === -1) throw new Error('Formazione distrutta non trovata.');
        const d = state.destroyedFormations.splice(dIdx, 1)[0];

        const rebuilt: Formation = {
          id: `${d.id}_rebuilt_${state.turn}`,
          name: d.baseName,
          baseName: d.baseName,
          side: d.side,
          type: d.type,
          maxStrength: 3,
          strength: 3,
          xp: 0,
          level: 'RECLUTA',
          keywords: d.keywords.filter((k) => k !== 'GUARDIA'),
          equipment: null,
          location: 'RISERVA',
          exhausted: false,
          encircled: false,
          encircledBySectors: [],
          reactedThisTurn: false,
        };

        state.pp[side] -= cost;
        state.stats.ppSpentByCategory[side].replacements += cost;
        state.formations.push(rebuilt);
        recordOrderSpent(state, side, 'RIORGANIZZARE');
        addLog(
          state,
          'ACTION',
          `Ricostituzione: ${side} ricostituisce ${rebuilt.name} in Riserva (RECLUTA, Forza 3) per ${cost} PP.`,
          side
        );
        advanceOrderTurnControl(state, side);
        return state;
      }

      const f = state.formations.find((u) => u.id === action.formationId && u.side === side);
      if (!f) throw new Error('Formazione non trovata.');
      if (f.encircled) throw new Error('Non si può riorganizzare una formazione accerchiata.');
      const missing = f.maxStrength - f.strength;
      if (missing <= 0) throw new Error('La formazione è già alla Forza massima.');

      const pts = Math.min(action.points ?? 1, 3, missing);
      if (pts <= 0) throw new Error('Numero di punti Forza da ripristinare non valido.');
      if (state.pp[side] < pts) throw new Error(`PP insufficienti (richiesti ${pts} PP).`);

      state.pp[side] -= pts;
      state.stats.ppSpentByCategory[side].replacements += pts;
      f.strength += pts;

      if (pts >= 2) {
        dropFormationExperienceLevel(state, f);
      }

      recordOrderSpent(state, side, 'RIORGANIZZARE');
      addLog(
        state,
        'ACTION',
        `Riorganizzazione: ${f.name} recupera +${pts} Forza (ora ${f.strength}/${f.maxStrength}) per ${pts} PP.`,
        side
      );
      advanceOrderTurnControl(state, side);
      return state;
    }

    case 'RETREAT': {
      const sec = action.sector;
      const secState = state.sectors[sec];
      if (side === 'USSR' && secState.noRetreatUssrThisTurn) {
        throw new Error('Ordine 227 impedisce la ritirata in questo settore!');
      }
      if (side === 'AXIS' && secState.marker <= 0) {
        throw new Error('Il marker è già a 0.');
      }
      if (side === 'USSR' && secState.marker >= 6) {
        throw new Error('Il marker è già a 6.');
      }

      if (side === 'AXIS') {
        secState.marker -= 1;
      } else {
        secState.marker += 1;
      }

      if (!secState.retreatedSidesThisTurn.includes(side)) {
        secState.retreatedSidesThisTurn.push(side);
      }

      // Check if retreat relieves encirclement immediately
      for (const f of state.formations) {
        if (f.side === side && f.location === sec && f.encircled) {
          const stillGap = MAP_DATA[sec].adjacent.some(
            (adj) => Math.abs(state.sectors[adj].marker - secState.marker) >= state.config.encirclement.threatGap
          );
          if (!stillGap) {
            f.encircled = false;
            f.encircledBySectors = [];
          }
        }
      }

      recordOrderSpent(state, side, 'RITIRATA');
      addLog(
        state,
        'ACTION',
        `Ritirata strategica: ${side} arretra il fronte in ${sec} alla casella ${secState.marker} (+1 Difesa in questo turno).`,
        side
      );

      const berlin = checkBerlinImmediateVictory(state);
      if (berlin.winner) {
        state.winner = berlin.winner;
        state.victoryReason = berlin.reason;
        state.phase = 'GAME_OVER';
        addLog(state, 'VICTORY', `🏆 VITTORIA ${berlin.winner}: ${berlin.reason}`, berlin.winner);
        return state;
      }

      advanceOrderTurnControl(state, side);
      return state;
    }

    case 'PROTOTYPE': {
      const cost = state.config.prototypeCost;
      if (state.pp[side] < cost) {
        throw new Error(`PP insufficienti per Prototipo (richiesti ${cost} PP).`);
      }
      if (state.hands[side].length >= state.config.handMax) {
        throw new Error(`Mano piena (massimo ${state.config.handMax} carte).`);
      }

      const currentYear = 1900 + parseInt(state.turn.slice(1), 10);
      const nextYear = currentYear + 1;
      const nextDeck = state.futureDecks[side][nextYear] ?? [];
      if (nextDeck.length === 0) {
        throw new Error(`Nessuna carta disponibile nel mazzo dell'anno successivo (${nextYear}).`);
      }

      const cIdx = nextDeck.findIndex((c) => c.id === action.chosenCardId);
      if (cIdx === -1) {
        throw new Error('Carta scelta non trovata nel mazzo dell’anno successivo.');
      }

      const chosen = nextDeck.splice(cIdx, 1)[0];
      state.pp[side] -= cost;
      state.stats.ppSpentByCategory[side].prototypes += cost;
      state.hands[side].push(chosen);
      recordOrderSpent(state, side, 'PROTOTIPO');
      addLog(
        state,
        'ACTION',
        `Prototipo (${nextYear}): ${side} investe ${cost} PP e acquisisce in anticipo "${chosen.name}".`,
        side
      );
      advanceOrderTurnControl(state, side);
      return state;
    }

    case 'PLAY_EVENT': {
      const idx = state.hands[side].findIndex((c) => c.id === action.cardId);
      if (idx === -1) throw new Error('Carta evento non trovata in mano.');
      const card = state.hands[side][idx];
      if (card.type !== 'EVENTO' || card.timing !== 'ORDINE') {
        throw new Error('Solo le carte EVENTO con timing ORDINE si giocano con questa azione.');
      }
      if (card.onlyTurn && card.onlyTurn !== state.turn) {
        throw new Error(`La carta ${card.name} può essere giocata solo nel turno ${card.onlyTurn}.`);
      }

      if (card.templateId === 'axis_barbarossa_41') {
        state.hands[side].splice(idx, 1);
        state.discardPiles[side].push(card);
        recordOrderSpent(state, side, 'EVENTO');
        // +1 order net (+1 added after spending 1)
        state.ordersRemaining[side] += 1;
        state.barbarossaPlayedThisTurn = true;
        addLog(
          state,
          'EVENT',
          'Direttiva Barbarossa: +1 ordine e tutte le formazioni tedesche ricevono +1 in attacco in questo turno!',
          'AXIS'
        );
      } else if (card.templateId === 'ussr_evacuazione_urali_41') {
        if (state.pp.USSR < 3) {
          throw new Error('Servono almeno 3 PP per giocare Evacuazione oltre gli Urali.');
        }
        state.pp.USSR -= 3;
        state.stats.ppSpentByCategory.USSR.events += 3;
        state.uralsEvacuated = true;
        state.hands[side].splice(idx, 1);
        state.discardPiles[side].push(card);
        recordOrderSpent(state, side, 'EVENTO');
        addLog(
          state,
          'EVENT',
          'Evacuazione oltre gli Urali: −3 PP ora; +2 PP a ogni turno a partire da E42!',
          'USSR'
        );
      } else if (card.templateId.startsWith('axis_rimpiazzi')) {
        const allocations = action.allocations ?? [];
        const totalPts = allocations.reduce((s, a) => s + a.points, 0);
        if (totalPts <= 0 || totalPts > 3) {
          throw new Error('Rimpiazzi deve assegnare da 1 a 3 punti Forza totali.');
        }
        for (const alloc of allocations) {
          if (alloc.points <= 0) continue;
          const f = state.formations.find((u) => u.id === alloc.formationId && u.side === side);
          if (!f) throw new Error('Formazione non valida per Rimpiazzi.');
          if (f.encircled) throw new Error('Non puoi assegnare Rimpiazzi a formazioni accerchiate.');
          f.strength = Math.min(f.maxStrength, f.strength + alloc.points);
        }
        state.hands[side].splice(idx, 1);
        state.discardPiles[side].push(card);
        recordOrderSpent(state, side, 'EVENTO');
        addLog(
          state,
          'EVENT',
          `Rimpiazzi: l'Asse ripristina ${totalPts} Forza senza perdita di esperienza.`,
          'AXIS'
        );
      } else if (card.templateId === 'axis_ponte_aereo_42') {
        const sec = action.targetSector;
        if (!sec) throw new Error('Seleziona un settore per Ponte aereo.');
        if (state.pp.AXIS < 2) throw new Error('Servono 2 PP per giocare Ponte aereo.');
        state.pp.AXIS -= 2;
        state.stats.ppSpentByCategory.AXIS.events += 2;
        state.sectors[sec].airliftProtectedThisTurn = true;
        state.hands[side].splice(idx, 1);
        state.discardPiles[side].push(card);
        recordOrderSpent(state, side, 'EVENTO');
        addLog(
          state,
          'EVENT',
          `Ponte aereo nel settore ${sec}: le formazioni accerchiate non perdono Forza a fine turno (−2 PP).`,
          'AXIS'
        );
      } else if (card.templateId === 'axis_volkssturm_44') {
        const vs = createVolkssturmFormations(state.turn);
        state.formations.push(...vs);
        state.hands[side].splice(idx, 1);
        state.discardPiles[side].push(card);
        recordOrderSpent(state, side, 'EVENTO');
        addLog(
          state,
          'EVENT',
          'Volkssturm: 2 formazioni FANTERIA (F1, RECLUTA, FRAGILE) entrano nella Riserva dell’Asse.',
          'AXIS'
        );
      } else if (card.templateId === 'ussr_lend_lease_42') {
        state.pp.USSR += 3;
        state.hands[side].splice(idx, 1);
        state.discardPiles[side].push(card);
        recordOrderSpent(state, side, 'EVENTO');
        addLog(state, 'EVENT', 'Lend-Lease: l’URSS riceve +3 PP!', 'USSR');
      }

      advanceOrderTurnControl(state, side);
      return state;
    }

    default:
      throw new Error('Azione non consentita in questa fase.');
  }
}
