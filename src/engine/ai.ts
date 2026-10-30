import { areSectorsAdjacent, MAP_DATA, SECTORS } from '../data/map';
import {
  computeCombat,
  getFormationBaseAttack,
  getFormationBaseDefense,
  getSeason,
} from './combat';
import {
  canEquipCardOnFormation,
  getEligibleReactingFormations,
  getMaxReactionsForDefender,
  isFormationMobile,
} from './engine';
import {
  EventCard,
  Formation,
  GameAction,
  GameState,
  Player,
  SectorId,
  Side,
} from './types';

export interface AiDecision {
  action: GameAction;
  reasoning: string;
}

/**
 * Strategic WWII War Room AI (implements Section 15 Player interface + detailed Italian radio log)
 */
export class StrategicBot implements Player {
  side: Side;

  constructor(side: Side) {
    this.side = side;
  }

  chooseAction(state: GameState): GameAction {
    return chooseAiAction(state).action;
  }
}

export function chooseAiAction(state: GameState): AiDecision {
  const side = state.activeSide;
  const enemy: Side = side === 'AXIS' ? 'USSR' : 'AXIS';
  const hqName = side === 'AXIS' ? 'OKW (Oberkommando)' : 'STAVKA (Comando Supremo)';

  // 1. Normandy Event (E44 mandatory for Axis)
  if (state.phase === 'NORMANDY_EVENT') {
    if (state.config.normandyAllowPayInstead && state.pp.AXIS >= state.config.normandyPayCost) {
      return {
        action: { type: 'RESOLVE_NORMANDY', choice: 'PAY_PP' },
        reasoning: `${hqName}: Pagati ${state.config.normandyPayCost} PP per trattenere le divisioni Panzer sul Fronte Orientale.`,
      };
    }
    const armorUnits = state.formations
      .filter((f) => f.side === 'AXIS' && f.type === 'CORAZZATA')
      .sort((a, b) => a.strength - b.strength);
    if (armorUnits.length > 0) {
      return {
        action: {
          type: 'RESOLVE_NORMANDY',
          choice: 'REMOVE_ARMOR',
          formationId: armorUnits[0].id,
        },
        reasoning: `${hqName}: Trasferita ${armorUnits[0].name} sul Fronte Occidentale (Normandia).`,
      };
    }
  }

  // 2. Multi-step Combat resolutions
  if (state.phase === 'COMBAT' && state.pendingCombat) {
    const pc = state.pendingCombat;

    // 2a. Defender Reaction
    if (pc.phase === 'REACTION') {
      const maxReact = pc.maskirovkaPlayed ? 0 : getMaxReactionsForDefender(state, pc.defender);
      const eligibleReserves =
        maxReact > 0 ? getEligibleReactingFormations(state, pc.defender) : [];

      // Sort reserves by defense value descending
      const sortedReserves = [...eligibleReserves].sort(
        (a, b) =>
          getFormationBaseDefense(b, state.config.modules.experience) -
          getFormationBaseDefense(a, state.config.modules.experience)
      );

      // Decide how many reserves to commit
      const currentDefenders = state.formations.filter(
        (f) => f.side === pc.defender && f.location === pc.sector
      );
      const attackers = state.formations.filter((f) => pc.attackerIds.includes(f.id));
      const baseAtk = attackers.reduce(
        (s, f) => s + getFormationBaseAttack(f, state.config.modules.experience),
        0
      );
      const baseDef = currentDefenders.reduce(
        (s, f) => s + getFormationBaseDefense(f, state.config.modules.experience),
        0
      );

      const reactingIds: string[] = [];
      let projectedDef = baseDef;
      for (const r of sortedReserves) {
        if (reactingIds.length >= maxReact) break;
        // Commit reserve if sector is contested or losing
        if (baseAtk >= projectedDef - 1 || pc.sector === 'CENTRO') {
          reactingIds.push(r.id);
          projectedDef += getFormationBaseDefense(r, state.config.modules.experience);
        }
      }

      // Check valid DIFESA event cards in hand
      const defenseEventsInHand = state.hands[pc.defender].filter(
        (c): c is EventCard => c.type === 'EVENTO' && c.timing === 'DIFESA'
      );
      const chosenDefenseEvents: string[] = [];
      for (const ev of defenseEventsInHand) {
        if (ev.templateId === 'axis_ritirata_elastica_43') {
          if (state.sectors[pc.sector].marker > 1 && baseAtk > projectedDef) {
            chosenDefenseEvents.push(ev.id);
          }
        } else if (ev.templateId === 'ussr_ordine_227_42') {
          if (baseAtk >= projectedDef) {
            chosenDefenseEvents.push(ev.id);
          }
        } else {
          if (baseAtk >= projectedDef) {
            chosenDefenseEvents.push(ev.id);
          }
        }
      }

      const descParts: string[] = [];
      if (reactingIds.length > 0) {
        descParts.push(`invia ${reactingIds.length} riserve mobili in ${pc.sector}`);
      }
      if (chosenDefenseEvents.length > 0) {
        descParts.push(`attiva direttive di difesa`);
      }

      return {
        action: {
          type: 'DEFENSE_REACTION',
          reactingFormationIds: reactingIds,
          eventCardIds: chosenDefenseEvents,
        },
        reasoning:
          descParts.length > 0
            ? `${hqName}: Reazione difensiva in ${pc.sector} (${descParts.join(' e ')}).`
            : `${hqName}: Le truppe in ${pc.sector} tengono la posizione senza impegnare la Riserva.`,
      };
    }

    // 2b. Assign Losses (Attacker or Defender)
    if (pc.phase === 'ATTACKER_LOSSES' || pc.phase === 'DEFENDER_LOSSES') {
      const lossSide = pc.phase === 'ATTACKER_LOSSES' ? pc.attacker : pc.defender;
      const candidates = state.formations.filter(
        (f) =>
          f.side === lossSide &&
          f.location === pc.sector &&
          (lossSide === pc.defender || pc.attackerIds.includes(f.id))
      );

      // Score units to pick the most expendable one for 1 step of loss:
      // Lower score = take loss first
      const scored = [...candidates].sort((a, b) => {
        const scoreUnit = (u: Formation): number => {
          let score = 0;
          // Avoid destroying a unit if it's at 1 strength (or 2 if FRAGILE)
          const lethalThreshold = u.keywords.includes('FRAGILE') ? 2 : 1;
          if (u.strength <= lethalThreshold) score += 100;
          // Avoid hitting FRAGILE units if possible since they suffer +1 extra loss
          if (u.keywords.includes('FRAGILE') && u.strength > 1) score += 45;
          // Protect armor and motorized over infantry
          if (u.type === 'CORAZZATA') score += 30;
          if (u.type === 'MOTORIZZATA') score += 15;
          // Protect Guards and Elite/Veterans
          if (u.keywords.includes('GUARDIA')) score += 20;
          if (u.level === 'ELITE') score += 20;
          if (u.level === 'VETERANA') score += 10;
          if (u.equipment) score += 15;
          // Prefer units with higher current strength so damage is spread out
          score -= u.strength * 4;
          return score;
        };
        return scoreUnit(a) - scoreUnit(b);
      });

      const target = scored[0];
      return {
        action: {
          type: 'ASSIGN_LOSSES',
          side: lossSide,
          formationId: target.id,
          amount: 1,
        },
        reasoning: `${hqName}: ${target.name} assorbe le perdite in ${pc.sector}.`,
      };
    }

    // 2c. Encirclement Choice
    if (pc.phase === 'ENCIRCLEMENT_CHOICE') {
      const sec = pc.threatenedSectors[0];
      const canRetreat =
        !(pc.defender === 'USSR' && state.sectors[sec].noRetreatUssrThisTurn) &&
        !(pc.defender === 'AXIS' && sec === 'CENTRO' && state.sectors.CENTRO.marker <= 1);

      const choice = canRetreat ? 'RITIRATA' : 'RESISTERE';
      return {
        action: {
          type: 'ENCIRCLEMENT_DECISION',
          sector: sec,
          choice,
        },
        reasoning:
          choice === 'RITIRATA'
            ? `${hqName}: Ripiegamento tattico in ${sec} per evitare l'accerchiamento!`
            : `${hqName}: Ordine di resistere a oltranza nella sacca di ${sec}!`,
      };
    }
  }

  // 3. ORDERS Phase
  const hand = state.hands[side];
  const pp = state.pp[side];
  const ordersLeft = state.ordersRemaining[side];

  // Free Action: Reconvert expired turn-specific cards in hand for free PP
  for (const card of hand) {
    if (card.type === 'EVENTO' && card.onlyTurn && card.onlyTurn !== state.turn) {
      return {
        action: { type: 'RECONVERT_CARD', cardId: card.id },
        reasoning: `${hqName}: Riconvertita direttiva scaduta "${card.name}" in Punti Produzione.`,
      };
    }
  }

  if (ordersLeft <= 0) {
    return {
      action: { type: 'PASS' },
      reasoning: `${hqName}: Fine degli ordini operativi per questo turno.`,
    };
  }

  // 3.1 High-priority ORDINE Events
  for (const card of hand) {
    if (card.type !== 'EVENTO' || card.timing !== 'ORDINE') continue;
    if (card.onlyTurn && card.onlyTurn !== state.turn) continue;

    if (card.templateId === 'axis_barbarossa_41' && state.turn === 'E41') {
      return {
        action: { type: 'PLAY_EVENT', cardId: card.id },
        reasoning: `${hqName}: Diramata la Direttiva Barbarossa! Tutte le armate hanno ordine di avanzare (+1 ATT, +1 Ordine).`,
      };
    }
    if (card.templateId === 'ussr_evacuazione_urali_41' && pp >= 3) {
      return {
        action: { type: 'PLAY_EVENT', cardId: card.id },
        reasoning: `${hqName}: Avviata l'Evacuazione delle industrie oltre gli Urali (+2 PP per turno dal 1942)!`,
      };
    }
    if (card.templateId === 'ussr_lend_lease_42') {
      return {
        action: { type: 'PLAY_EVENT', cardId: card.id },
        reasoning: `${hqName}: Ricevuti i convogli Alleati Lend-Lease (+3 PP)!`,
      };
    }
    if (card.templateId === 'axis_volkssturm_44') {
      return {
        action: { type: 'PLAY_EVENT', cardId: card.id },
        reasoning: `${hqName}: Mobilitata la Volkssturm in Riserva!`,
      };
    }
    if (card.templateId === 'axis_ponte_aereo_42' && pp >= 2) {
      const encircledSector = SECTORS.find((sec) =>
        state.formations.some((f) => f.side === 'AXIS' && f.location === sec && f.encircled)
      );
      if (encircledSector && !state.sectors[encircledSector].airliftProtectedThisTurn) {
        return {
          action: { type: 'PLAY_EVENT', cardId: card.id, targetSector: encircledSector },
          reasoning: `${hqName}: Attivato il Ponte Aereo della Luftwaffe per rifornire la sacca in ${encircledSector}.`,
        };
      }
    }
    if (card.templateId.startsWith('axis_rimpiazzi')) {
      const damaged = state.formations
        .filter((f) => f.side === 'AXIS' && !f.encircled && f.strength < f.maxStrength)
        .sort((a, b) => (b.type === 'CORAZZATA' ? 1 : 0) - (a.type === 'CORAZZATA' ? 1 : 0));
      const totalMissing = damaged.reduce((s, f) => s + (f.maxStrength - f.strength), 0);
      if (totalMissing >= 2 && damaged.length > 0) {
        let budget = 3;
        const allocations: { formationId: string; points: number }[] = [];
        for (const u of damaged) {
          if (budget <= 0) break;
          const give = Math.min(budget, u.maxStrength - u.strength);
          if (give > 0) {
            allocations.push({ formationId: u.id, points: give });
            budget -= give;
          }
        }
        if (allocations.length > 0) {
          return {
            action: { type: 'PLAY_EVENT', cardId: card.id, allocations },
            reasoning: `${hqName}: Inviati rimpiazzi d'élite al fronte senza perdita di esperienza.`,
          };
        }
      }
    }
  }

  // 3.2 Relieve Encirclement if a strategic retreat frees trapped formations
  for (const sec of SECTORS) {
    const trappedHere = state.formations.filter(
      (f) => f.side === side && f.location === sec && f.encircled
    );
    if (trappedHere.length > 0) {
      const secState = state.sectors[sec];
      const canRetreat =
        !(side === 'USSR' && secState.noRetreatUssrThisTurn) &&
        !(side === 'AXIS' && secState.marker <= 0) &&
        !(side === 'AXIS' && sec === 'CENTRO' && secState.marker <= 1) &&
        !(side === 'USSR' && secState.marker >= 6);

      if (canRetreat) {
        const nextMarker = side === 'AXIS' ? secState.marker - 1 : secState.marker + 1;
        const wouldFree = !MAP_DATA[sec].adjacent.some(
          (adj) =>
            Math.abs(state.sectors[adj].marker - nextMarker) >=
            state.config.encirclement.threatGap
        );
        if (wouldFree) {
          return {
            action: { type: 'RETREAT', sector: sec },
            reasoning: `${hqName}: Ritirata strategica in ${sec} per rompere l'accerchiamento e salvare ${trappedHere.length} unità!`,
          };
        }
      }
    }
  }

  // 3.3 Equip Commanders, Air, or Ground Equipment before attacking
  for (const card of hand) {
    if (card.cost > pp) continue;

    if (card.type === 'COMANDANTE') {
      // Pick sector with most friendly units that lacks a commander
      const bestSec = [...SECTORS]
        .filter((s) =>
          side === 'AXIS' ? !state.sectors[s].axisCommander : !state.sectors[s].ussrCommander
        )
        .sort((a, b) => {
          const countA = state.formations.filter((f) => f.side === side && f.location === a).length;
          const countB = state.formations.filter((f) => f.side === side && f.location === b).length;
          return countB - countA;
        })[0];

      if (bestSec) {
        return {
          action: { type: 'EQUIP', cardId: card.id, targetSector: bestSec },
          reasoning: `${hqName}: Il generale ${card.name} assume il comando del Settore ${bestSec}.`,
        };
      }
    }

    if (card.type === 'AEREO' && state.airZones[side].length < 3) {
      return {
        action: { type: 'EQUIP', cardId: card.id },
        reasoning: `${hqName}: Squadriglia aerea ${card.name} rischierata nella Zona Aviazione.`,
      };
    }

    if (card.type === 'EQUIPAGGIAMENTO_TERRA') {
      // Find best unequipped formation in a front sector
      const candidates = state.formations
        .filter(
          (f) =>
            f.side === side &&
            f.location !== 'RISERVA' &&
            !f.encircled &&
            !f.equipment &&
            canEquipCardOnFormation(card, f)
        )
        .sort((a, b) => b.strength - a.strength);

      if (candidates.length > 0) {
        const target = candidates[0];
        return {
          action: { type: 'EQUIP', cardId: card.id, targetFormationId: target.id },
          reasoning: `${hqName}: Consegnato equipaggiamento ${card.name} a ${target.name} (${target.location}).`,
        };
      }
    }
  }

  // 3.4 Evaluate Offensive Attacks across NORD, CENTRO, SUD
  interface AttackOption {
    sector: SectorId;
    eventIds: string[];
    diff: number;
    score: number;
  }
  const attackOptions: AttackOption[] = [];
  const season = getSeason(state.turn);

  for (const sec of SECTORS) {
    const marker = state.sectors[sec].marker;
    if (side === 'AXIS' && marker >= 6) continue;
    if (side === 'USSR' && marker <= 0) continue;

    const unencircledAttackers = state.formations.filter(
      (f) => f.side === side && f.location === sec && !f.exhausted && !f.encircled
    );
    const allAttackers = state.formations.filter(
      (f) => f.side === side && f.location === sec && !f.exhausted
    );
    if (unencircledAttackers.length === 0) continue;

    const defenders = state.formations.filter((f) => f.side === enemy && f.location === sec);

    // Check legal ATTACCO events in hand for this sector
    const validAtkEvents = hand.filter(
      (c): c is EventCard =>
        c.type === 'EVENTO' &&
        c.timing === 'ATTACCO' &&
        (!c.onlyTurn || c.onlyTurn === state.turn) &&
        (!c.onlySeason || c.onlySeason === season) &&
        (!c.allowedSectors || c.allowedSectors.includes(sec))
    );

    // Simulate combat without events first
    const baseSim = computeCombat(state, sec, side, allAttackers, defenders, [], [], false);
    let chosenEvents: EventCard[] = [];
    let bestDiff = baseSim.breakdown.diffWithoutDice;

    // If adding an attack event improves diff across a threshold or makes a tight battle favorable, attach it
    if (validAtkEvents.length > 0 && bestDiff >= -2 && bestDiff < 5) {
      chosenEvents = [validAtkEvents[0]];
      const simWithEv = computeCombat(
        state,
        sec,
        side,
        allAttackers,
        defenders,
        chosenEvents,
        [],
        false
      );
      bestDiff = simWithEv.breakdown.diffWithoutDice;
    }

    // Strategic value bonus for objective cities or encirclement opportunities
    let strategicBonus = 0;
    const targetCellIndex = side === 'AXIS' ? marker + 1 : marker;
    const targetCell = MAP_DATA[sec].cells[targetCellIndex];
    if (targetCell?.isObjectiveCity) strategicBonus += 2.5;
    if (side === 'USSR' && sec === 'CENTRO' && marker <= 2) strategicBonus += 3; // Drive on Berlin!

    attackOptions.push({
      sector: sec,
      eventIds: chosenEvents.map((e) => e.id),
      diff: bestDiff,
      score: bestDiff + strategicBonus,
    });
  }

  attackOptions.sort((a, b) => b.score - a.score);

  if (attackOptions.length > 0) {
    const best = attackOptions[0];
    // Attack if expected diff is >= 1, or >= 0 with high strategic value / initiative
    const minAcceptableDiff = side === 'AXIS' && state.turn === 'E41' ? 0 : 1;
    if (best.diff >= minAcceptableDiff || (best.diff >= 0 && best.score >= 2)) {
      return {
        action: {
          type: 'ATTACK',
          sector: best.sector,
          eventCardIds: best.eventIds,
        },
        reasoning: `${hqName}: Offensiva lanciata nel Settore ${best.sector} (Rapporto forze stimato: ${best.diff >= 0 ? '+' : ''}${best.diff})!`,
      };
    }
  }

  // 3.5 Redeploy formations from RISERVA (or shift from quiet sector to threatened sector)
  const reserveUnits = state.formations.filter(
    (f) => f.side === side && f.location === 'RISERVA' && !f.encircled
  );
  // Keep at most 1 mobile unit in Reserve for defensive reactions if enemy has orders left; move all Infantry or excess units to the front
  const mobileInReserve = reserveUnits.filter((f) => isFormationMobile(f));
  const nonMobileInReserve = reserveUnits.filter((f) => !isFormationMobile(f));

  const unitToMoveFromReserve =
    nonMobileInReserve[0] ?? (mobileInReserve.length > 1 || state.ordersRemaining[enemy] === 0 ? mobileInReserve[0] : undefined);

  if (unitToMoveFromReserve) {
    // Find sector most in need of reinforcement (lowest friendly strength relative to enemy strength)
    const targetSec = [...SECTORS].sort((a, b) => {
      const myA = state.formations
        .filter((f) => f.side === side && f.location === a)
        .reduce((s, f) => s + f.strength, 0);
      const enA = state.formations
        .filter((f) => f.side === enemy && f.location === a)
        .reduce((s, f) => s + f.strength, 0);
      const myB = state.formations
        .filter((f) => f.side === side && f.location === b)
        .reduce((s, f) => s + f.strength, 0);
      const enB = state.formations
        .filter((f) => f.side === enemy && f.location === b)
        .reduce((s, f) => s + f.strength, 0);
      return myA - enA - (myB - enB);
    })[0];

    return {
      action: {
        type: 'REDEPLOY',
        formationId: unitToMoveFromReserve.id,
        to: targetSec,
      },
      reasoning: `${hqName}: ${unitToMoveFromReserve.name} trasferita dalla Riserva al Settore ${targetSec}.`,
    };
  }

  // 3.6 Reorganize damaged formations on the front (1 PP for +1 Strength without losing XP)
  if (pp >= 1) {
    const damagedUnits = state.formations
      .filter((f) => f.side === side && !f.encircled && f.strength < f.maxStrength)
      .sort((a, b) => a.strength - b.strength);

    if (damagedUnits.length > 0) {
      const target = damagedUnits[0];
      // Heal 1 point to preserve veteran/elite status, or 2 points if Recluta and heavily damaged
      const pts =
        target.level === 'RECLUTA' && target.maxStrength - target.strength >= 2 && pp >= 2
          ? 2
          : 1;
      return {
        action: {
          type: 'REORGANIZE',
          formationId: target.id,
          points: pts,
        },
        reasoning: `${hqName}: Riorganizzata ${target.name} in ${target.location} (+${pts} Forza).`,
      };
    }
  }

  // 3.7 Rebuild a destroyed formation if affordable
  const rebuildCost = side === 'AXIS' ? state.config.rebuildCost.axis : state.config.rebuildCost.ussr;
  const canRebuild = side === 'USSR' || state.config.axisCanRebuild;
  if (canRebuild && pp >= rebuildCost) {
    const destroyed = state.destroyedFormations.filter((d) => d.side === side);
    if (destroyed.length > 0) {
      return {
        action: {
          type: 'REORGANIZE',
          rebuildDestroyedId: destroyed[0].id,
        },
        reasoning: `${hqName}: Ricostituita la formazione ${destroyed[0].baseName} nella Riserva.`,
      };
    }
  }

  // 3.8 Secondary Attack if we still have orders and an even-odds battle (diff >= 0)
  if (attackOptions.length > 0 && attackOptions[0].diff >= 0) {
    const best = attackOptions[0];
    return {
      action: {
        type: 'ATTACK',
        sector: best.sector,
        eventCardIds: best.eventIds,
      },
      reasoning: `${hqName}: Attacco di logoramento lanciato nel Settore ${best.sector}.`,
    };
  }

  // 3.9 Lateral Redeploy between adjacent sectors if one sector has a huge surplus and another is weak
  for (const fromSec of SECTORS) {
    const myUnitsHere = state.formations.filter(
      (f) => f.side === side && f.location === fromSec && !f.encircled && !f.exhausted
    );
    const enemyHere = state.formations.filter((f) => f.side === enemy && f.location === fromSec);
    if (myUnitsHere.length >= enemyHere.length + 2 && myUnitsHere.length >= 3) {
      const unit = myUnitsHere[0];
      const possibleTargets = SECTORS.filter(
        (toSec) =>
          toSec !== fromSec && (isFormationMobile(unit) || areSectorsAdjacent(fromSec, toSec))
      );
      const needyTarget = possibleTargets.find((toSec) => {
        const myThere = state.formations.filter((f) => f.side === side && f.location === toSec).length;
        const enThere = state.formations.filter((f) => f.side === enemy && f.location === toSec).length;
        return myThere < enThere;
      });
      if (needyTarget) {
        return {
          action: {
            type: 'REDEPLOY',
            formationId: unit.id,
            to: needyTarget,
          },
          reasoning: `${hqName}: Manovra laterale — ${unit.name} spostata da ${fromSec} a ${needyTarget}.`,
        };
      }
    }
  }

  // 3.10 Otherwise Pass
  return {
    action: { type: 'PASS' },
    reasoning: `${hqName}: Posizioni consolidate; passa il turno operativo.`,
  };
}
