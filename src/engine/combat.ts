import { getCellDefenderWouldLose, isSectorUrbanForDefender, MAP_DATA } from '../data/map';
import { rollD6 } from './rng';
import {
  CombatBreakdown,
  CombatOutcomeType,
  EventCard,
  ExperienceLevel,
  Formation,
  GameState,
  ModifierEntry,
  Season,
  SectorId,
  Side,
  TurnId,
} from './types';

export function getLevelBonus(level: ExperienceLevel, experienceEnabled: boolean): number {
  if (!experienceEnabled) return 0;
  switch (level) {
    case 'RECLUTA':
      return 0;
    case 'VETERANA':
      return 1;
    case 'ELITE':
      return 2;
  }
}

export function getSeason(turn: TurnId): Season {
  return turn.startsWith('E') ? 'ESTATE' : 'INVERNO';
}

export function getTurnYear(turn: TurnId): number {
  const num = parseInt(turn.slice(1), 10);
  return 1900 + num;
}

export function getFormationBaseAttack(f: Formation, experienceEnabled: boolean): number {
  return f.strength + getLevelBonus(f.level, experienceEnabled) + (f.equipment?.atk ?? 0);
}

export function getFormationBaseDefense(f: Formation, experienceEnabled: boolean): number {
  return f.strength + getLevelBonus(f.level, experienceEnabled) + (f.equipment?.def ?? 0);
}

export function getAirSuperiority(state: GameState): {
  axisFighter: number;
  ussrFighter: number;
  axisSupport: number;
  ussrSupport: number;
  superiority: Side | null;
} {
  if (!state.config.modules.air) {
    return { axisFighter: 0, ussrFighter: 0, axisSupport: 0, ussrSupport: 0, superiority: null };
  }
  const axisFighter = state.airZones.AXIS.reduce((sum, a) => sum + a.caccia, 0);
  const ussrFighter = state.airZones.USSR.reduce((sum, a) => sum + a.caccia, 0);
  const axisSupport = state.airZones.AXIS.reduce((sum, a) => sum + a.supporto, 0);
  const ussrSupport = state.airZones.USSR.reduce((sum, a) => sum + a.supporto, 0);

  let superiority: Side | null = null;
  if (axisFighter > ussrFighter) superiority = 'AXIS';
  else if (ussrFighter > axisFighter) superiority = 'USSR';

  return { axisFighter, ussrFighter, axisSupport, ussrSupport, superiority };
}

export function classifyOutcome(diff: number, thresholds: GameState['config']['outcomeThresholds']): CombatOutcomeType {
  if (diff <= thresholds.disfatta) return 'DISFATTA';
  if (diff <= thresholds.respinto) return 'RESPINTO';
  if (diff <= thresholds.avanzata) return 'AVANZATA';
  if (diff <= thresholds.netta) return 'VITTORIA_NETTA';
  return 'SFONDAMENTO';
}

export function computeCombat(
  state: GameState,
  sector: SectorId,
  attacker: Side,
  attackingFormations: Formation[],
  defendingFormations: Formation[],
  attackEvents: EventCard[],
  defenseEvents: EventCard[],
  elasticRetreatPlayed: boolean
): { breakdown: CombatBreakdown; nextRngState: number } {
  const defender: Side = attacker === 'AXIS' ? 'USSR' : 'AXIS';
  const cfg = state.config;
  const secState = state.sectors[sector];
  const marker = secState.marker;
  const season = getSeason(state.turn);
  const xpEnabled = cfg.modules.experience;

  const attackModifiers: ModifierEntry[] = [];
  const defenseModifiers: ModifierEntry[] = [];

  // 1. Formations base values
  for (const f of attackingFormations) {
    const val = getFormationBaseAttack(f, xpEnabled);
    const details: string[] = [`F${f.strength}`];
    const lvl = getLevelBonus(f.level, xpEnabled);
    if (lvl > 0) details.push(`+${lvl} ${f.level}`);
    if (f.equipment && f.equipment.atk > 0) details.push(`+${f.equipment.atk} ${f.equipment.name}`);
    attackModifiers.push({
      source: `${f.name} (${details.join(', ')})`,
      value: val,
    });
  }

  for (const f of defendingFormations) {
    const val = getFormationBaseDefense(f, xpEnabled);
    const details: string[] = [`F${f.strength}`];
    const lvl = getLevelBonus(f.level, xpEnabled);
    if (lvl > 0) details.push(`+${lvl} ${f.level}`);
    if (f.equipment && f.equipment.def > 0) details.push(`+${f.equipment.def} ${f.equipment.name}`);
    defenseModifiers.push({
      source: `${f.name} (${details.join(', ')})`,
      value: val,
    });
  }

  // 2. Combined Arms (Armi combinate)
  const attackerHasArmor = attackingFormations.some((f) => f.type === 'CORAZZATA');
  const attackerHasInfOrMot = attackingFormations.some((f) => f.type === 'FANTERIA' || f.type === 'MOTORIZZATA');
  if (cfg.modules.combinedArms && attackerHasArmor && attackerHasInfOrMot) {
    attackModifiers.push({ source: 'Armi combinate (Corazzata + Fanteria/Mot.)', value: 1 });
  }

  // 3. Barbarossa active this turn
  if (attacker === 'AXIS' && state.barbarossaPlayedThisTurn) {
    const bonus = attackingFormations.length;
    if (bonus > 0) {
      attackModifiers.push({
        source: `Direttiva Barbarossa (+1 per formazione: ${bonus})`,
        value: bonus,
      });
    }
  }

  // 4. Objective City Defense Bonus & URBANO keyword
  const cellToLose = getCellDefenderWouldLose(sector, defender, marker);
  if (cellToLose?.isObjectiveCity) {
    defenseModifiers.push({
      source: `Difesa città obiettivo (${cellToLose.name})`,
      value: 1,
    });
  }

  if (isSectorUrbanForDefender(sector, defender, marker)) {
    for (const f of defendingFormations) {
      if (f.keywords.includes('URBANO')) {
        defenseModifiers.push({
          source: `Combattimento urbano (${f.name})`,
          value: 2,
        });
      }
    }
  }

  // 5. ANTICARRO in defense
  if (attackerHasArmor) {
    for (const f of defendingFormations) {
      if (f.equipment?.keywords.includes('ANTICARRO')) {
        defenseModifiers.push({
          source: `Anticarro (${f.equipment.name} su ${f.name})`,
          value: 2,
        });
      }
    }
  }

  // 6. FRAGILE in defense
  for (const f of defendingFormations) {
    if (f.keywords.includes('FRAGILE')) {
      const penalty = attackerHasArmor ? -2 : -1;
      defenseModifiers.push({
        source: `Formazione Fragile (${f.name}${attackerHasArmor ? ' vs Corazzate' : ''})`,
        value: penalty,
      });
    }
  }

  // 7. Retreat bonus in sector
  if (elasticRetreatPlayed) {
    defenseModifiers.push({ source: 'Evento: Ritirata elastica', value: 2 });
  } else if (secState.retreatedSidesThisTurn.includes(defender)) {
    defenseModifiers.push({ source: 'Linea accorciata (Ritirata in questo turno)', value: 1 });
  }

  // 8. Commanders
  const atkCommander = attacker === 'AXIS' ? secState.axisCommander : secState.ussrCommander;
  const defCommander = defender === 'AXIS' ? secState.axisCommander : secState.ussrCommander;

  if (atkCommander) {
    if (atkCommander.templateId === 'axis_guderian_41') {
      const armorCount = attackingFormations.filter((f) => f.type === 'CORAZZATA').length;
      if (armorCount > 0) {
        attackModifiers.push({ source: `Comandante Guderian (+1 x ${armorCount} Corazzate)`, value: armorCount });
      }
    } else if (atkCommander.templateId === 'axis_manstein_42') {
      const adj = [sector, ...MAP_DATA[sector].adjacent];
      const enemyAdvanced = adj.some((s) => state.sectors[s].enemyAdvancedHereThisTurn.includes('USSR'));
      if (enemyAdvanced) {
        attackModifiers.push({ source: 'Comandante Manstein (Contrattacco mobile)', value: 2 });
      }
    } else if (atkCommander.templateId === 'ussr_zukov_41') {
      attackModifiers.push({ source: 'Comandante Žukov', value: 1 });
    }
  }

  if (defCommander) {
    if (defCommander.templateId === 'axis_model_44') {
      defenseModifiers.push({ source: 'Comandante Model', value: 2 });
    } else if (defCommander.templateId === 'ussr_rokossovskij_43') {
      if (defendingFormations.length >= 3) {
        defenseModifiers.push({ source: 'Comandante Rokossovskij (≥3 formazioni)', value: 2 });
      }
    }
  }

  // 9. Air Superiority & Support
  if (cfg.modules.air) {
    const air = getAirSuperiority(state);
    const cujkovInSector =
      secState.ussrCommander?.templateId === 'ussr_cujkov_42';

    if (air.superiority === attacker) {
      const blockedByCujkov = attacker === 'AXIS' && cujkovInSector;
      if (blockedByCujkov) {
        attackModifiers.push({ source: 'Čujkov annulla il bonus aereo tedesco', value: 0 });
      } else {
        attackModifiers.push({ source: 'Superiorità aerea', value: 1 });
        const sup = attacker === 'AXIS' ? air.axisSupport : air.ussrSupport;
        if (sup > 0) {
          attackModifiers.push({ source: 'Supporto aereo a terra', value: sup });
        }
      }
    } else if (air.superiority === defender) {
      const blockedByCujkov = defender === 'AXIS' && cujkovInSector;
      if (blockedByCujkov) {
        defenseModifiers.push({ source: 'Čujkov annulla il bonus aereo tedesco', value: 0 });
      } else {
        defenseModifiers.push({ source: 'Superiorità aerea', value: 1 });
      }
    }
  }

  // 10. Events
  const studebakerPlayed = attackEvents.some((e) => e.templateId.startsWith('ussr_studebaker'));
  const partisansCount = attackEvents.filter((e) => e.templateId.startsWith('ussr_partigiani')).length;

  for (const ev of attackEvents) {
    if (ev.templateId === 'axis_tifone_41' && sector === 'CENTRO') {
      attackModifiers.push({ source: 'Evento: Tifone', value: 3 });
    } else if (ev.templateId === 'axis_fall_blau_42' && sector === 'SUD') {
      attackModifiers.push({ source: 'Evento: Fall Blau', value: 3 });
    } else if (ev.templateId === 'axis_zitadelle_43' && (sector === 'CENTRO' || sector === 'SUD')) {
      const heavyCats = attackingFormations.filter((f) => {
        const eqName = f.equipment?.name ?? '';
        return eqName.includes('Panther') || eqName.includes('Tiger') || eqName.includes('Ferdinand');
      }).length;
      if (heavyCats > 0) {
        attackModifiers.push({
          source: `Evento: Zitadelle (+2 x ${heavyCats} Panther/Tiger/Ferdinand)`,
          value: heavyCats * 2,
        });
      }
    } else if (ev.templateId === 'ussr_operazione_urano_42' && sector === 'SUD' && season === 'INVERNO') {
      const hasFragileDef = defendingFormations.some((f) => f.keywords.includes('FRAGILE'));
      attackModifiers.push({ source: 'Evento: Operazione Urano', value: 3 });
      if (hasFragileDef) {
        attackModifiers.push({ source: 'Operazione Urano (vs formazioni Fragili)', value: 2 });
      }
    } else if (ev.templateId === 'ussr_bagration_44' && sector === 'CENTRO' && season === 'ESTATE') {
      attackModifiers.push({ source: 'Evento: Operazione Bagration', value: 4 });
    } else if (ev.templateId === 'ussr_studebaker_44') {
      const armorCount = attackingFormations.filter((f) => f.type === 'CORAZZATA').length;
      if (armorCount > 0) {
        attackModifiers.push({
          source: `Evento: Camion Studebaker (+1 x ${armorCount} Corazzate)`,
          value: armorCount,
        });
      }
    }
  }

  for (const ev of defenseEvents) {
    if (ev.templateId === 'ussr_ordine_227_42') {
      const count = defendingFormations.length;
      if (count > 0) {
        defenseModifiers.push({
          source: `Evento: Ordine 227 (+1 x ${count} formazioni)`,
          value: count,
        });
      }
    }
  }

  // 11. Supply and Culminating Point (6.5)
  if (cfg.modules.supply) {
    if (attacker === 'AXIS') {
      const over = marker - cfg.supply.axisFreeUntil;
      if (over > 0) {
        attackModifiers.push({
          source: `Rifornimento Asse (marker ${marker} > ${cfg.supply.axisFreeUntil})`,
          value: -over,
        });
      }
    } else if (attacker === 'USSR' && !studebakerPlayed) {
      const pen = cfg.supply.ussrPenalty[marker] ?? 0;
      if (pen > 0) {
        attackModifiers.push({
          source: `Rifornimento URSS in territorio nemico (marker ${marker})`,
          value: -pen,
        });
      }
    }

    if (defender === 'AXIS') {
      let defSupplyPen = 0;
      if (marker >= cfg.supply.axisDefPenaltyFrom) {
        defSupplyPen += 1;
      }
      if (partisansCount > 0) {
        defSupplyPen += partisansCount;
      }
      if (defSupplyPen > 0) {
        defenseModifiers.push({
          source: `Sovraestensione / Partigiani Asse`,
          value: -defSupplyPen,
        });
      }
    }
  }

  // 12. Winter (6.7)
  if (cfg.modules.winter && season === 'INVERNO') {
    const isI41 = state.turn === 'I41';

    if (attacker === 'AXIS') {
      let winterPen = 0;
      for (const f of attackingFormations) {
        if (f.keywords.includes('INVERNO')) continue;
        if (isI41) {
          winterPen += 1;
        } else if (f.type === 'CORAZZATA' || f.type === 'MOTORIZZATA') {
          winterPen += 1;
        }
      }
      if (winterPen > 0) {
        attackModifiers.push({
          source: isI41 ? 'Impreparazione invernale I41 (Asse)' : 'Inverno su Corazzate/Motorizzate (Asse)',
          value: -winterPen,
        });
      }
    } else if (attacker === 'USSR') {
      const winterUnits = attackingFormations.filter((f) => f.keywords.includes('INVERNO')).length;
      if (winterUnits > 0) {
        attackModifiers.push({
          source: `Specialisti Invernali URSS (+1 x ${winterUnits})`,
          value: winterUnits,
        });
      }
    }

    if (defender === 'AXIS' && isI41) {
      const nonWinterCount = defendingFormations.filter((f) => !f.keywords.includes('INVERNO')).length;
      if (nonWinterCount > 0) {
        defenseModifiers.push({
          source: `Impreparazione invernale I41 in difesa (${nonWinterCount} formazioni)`,
          value: -nonWinterCount,
        });
      }
    }
  }

  // 13. Surprise in E41 (6.8)
  if (cfg.modules.surprise && state.turn === 'E41' && defender === 'USSR') {
    const defCount = defendingFormations.length;
    if (defCount > 0) {
      defenseModifiers.push({
        source: `Sorpresa strategica E41 (−1 x ${defCount} formazioni URSS)`,
        value: -defCount,
      });
    }
  }

  const totalAttack = attackModifiers.reduce((sum, m) => sum + m.value, 0);
  const totalDefense = Math.max(0, defenseModifiers.reduce((sum, m) => sum + m.value, 0));

  let diceRoll: number | null = null;
  let diceModifier = 0;
  let nextRngState = state.rngState;

  if (cfg.dice.enabled) {
    const rolled = rollD6(nextRngState);
    diceRoll = rolled.roll;
    nextRngState = rolled.nextState;
    diceModifier = cfg.dice.table[diceRoll] ?? 0;
  }

  const diffWithoutDice = totalAttack - totalDefense;
  const finalDiff = diffWithoutDice + diceModifier;

  const outcomeWithoutDice = classifyOutcome(diffWithoutDice, cfg.outcomeThresholds);
  const outcome = classifyOutcome(finalDiff, cfg.outcomeThresholds);
  const diceChangedOutcome = outcomeWithoutDice !== outcome;

  let markerShift = 0;
  let attackerLosses = 0;
  let defenderLosses = 0;
  let initiativePassedTo: Side | null = null;

  switch (outcome) {
    case 'DISFATTA':
      markerShift = 0;
      defenderLosses = 0;
      attackerLosses = 2;
      if (state.initiative !== defender) {
        initiativePassedTo = defender;
      }
      break;
    case 'RESPINTO':
      markerShift = 0;
      defenderLosses = 0;
      attackerLosses = 1;
      break;
    case 'AVANZATA':
      markerShift = 1;
      defenderLosses = 1;
      attackerLosses = 1;
      break;
    case 'VITTORIA_NETTA':
      markerShift = 1;
      defenderLosses = 2;
      attackerLosses = 0;
      break;
    case 'SFONDAMENTO':
      markerShift = 2;
      defenderLosses = 2;
      attackerLosses = 0;
      if (state.initiative !== attacker) {
        initiativePassedTo = attacker;
      }
      break;
  }

  // Zitadelle penalty: if outcome is RESPINTO or DISFATTA, initiative passes to USSR
  const zitadellePlayed = attackEvents.some((e) => e.templateId === 'axis_zitadelle_43');
  if (zitadellePlayed && (outcome === 'RESPINTO' || outcome === 'DISFATTA')) {
    if (state.initiative !== 'USSR') {
      initiativePassedTo = 'USSR';
    }
  }

  // Operazione Bagration & Konev on SFONDAMENTO
  if (outcome === 'SFONDAMENTO') {
    const bagrationPlayed = attackEvents.some((e) => e.templateId === 'ussr_bagration_44');
    if (bagrationPlayed && sector === 'CENTRO' && season === 'ESTATE') {
      markerShift = 3;
    }
    if (atkCommander?.templateId === 'ussr_konev_44') {
      markerShift += 1;
    }
  }

  // Cap markerShift to valid board bounds [0..6]
  if (attacker === 'AXIS') {
    markerShift = Math.min(markerShift, 6 - marker);
  } else {
    markerShift = Math.min(markerShift, marker);
  }

  // If no defenders exist in sector, defenderLosses is 0
  if (defendingFormations.length === 0) {
    defenderLosses = 0;
  }

  const breakdown: CombatBreakdown = {
    sector,
    attacker,
    defender,
    attackModifiers,
    defenseModifiers,
    totalAttack,
    totalDefense,
    diceRoll,
    diceModifier,
    diffWithoutDice,
    finalDiff,
    outcomeWithoutDice,
    outcome,
    diceChangedOutcome,
    markerShift,
    attackerLosses,
    defenderLosses,
    initiativePassedTo,
  };

  return { breakdown, nextRngState };
}
