import { SECTORS } from '../data/map';
import { getTurnYear } from './combat';
import { GameState, Side } from './types';

/**
 * Counts how many ★ objective cities are currently controlled by the Axis:
 * - Leningrado: NORD marker >= 5
 * - Mosca: CENTRO marker >= 5
 * - Stalingrado: SUD marker >= 5
 * - Caucaso: SUD marker === 6
 */
export function getAxisControlledObjectiveCities(state: GameState): string[] {
  const cities: string[] = [];
  if (state.sectors.NORD.marker >= 5) cities.push('Leningrado');
  if (state.sectors.CENTRO.marker >= 5) cities.push('Mosca');
  if (state.sectors.SUD.marker >= 5) cities.push('Stalingrado');
  if (state.sectors.SUD.marker >= 6) cities.push('Caucaso');
  return cities;
}

/**
 * Checks if USSR has reached Berlin (CENTRO marker === 0).
 * This is an immediate victory condition at any point.
 */
export function checkBerlinImmediateVictory(state: GameState): { winner: Side | null; reason: string | null } {
  if (state.sectors.CENTRO.marker === 0) {
    return {
      winner: 'USSR',
      reason: "L'Armata Rossa ha conquistato Berlino (marker CENTRO a 0)!",
    };
  }
  return { winner: null, reason: null };
}

/**
 * Evaluates end-of-turn VP adjustments and checks end-of-turn victory conditions.
 */
export function evaluateEndOfTurnVictory(state: GameState): {
  vpDelta: number;
  vpBreakdown: string[];
  winner: Side | null;
  reason: string | null;
} {
  const cities = getAxisControlledObjectiveCities(state);
  const vpBreakdown: string[] = [];
  let vpDelta = 0;

  for (const c of cities) {
    vpDelta += 1;
    vpBreakdown.push(`+1 PV (${c})`);
  }

  const year = getTurnYear(state.turn);
  if (year >= 1944) {
    const threshold = state.config.victory.from1944PenaltyAtMarker;
    for (const sec of SECTORS) {
      if (state.sectors[sec].marker <= threshold) {
        vpDelta -= 1;
        vpBreakdown.push(`−1 PV (${sec} marker ≤ ${threshold})`);
      }
    }
  }

  const newTotalVp = state.axisVp + vpDelta;

  // Check Berlin first just in case
  const berlin = checkBerlinImmediateVictory(state);
  if (berlin.winner) {
    return { vpDelta, vpBreakdown, winner: berlin.winner, reason: berlin.reason };
  }

  // Immediate Axis victory: controls >= 3 objective cities ★ simultaneously at end of turn
  if (cities.length >= state.config.victory.axisSuddenDeathCities) {
    return {
      vpDelta,
      vpBreakdown,
      winner: 'AXIS',
      reason: `Vittoria immediata dell'Asse: controlla ${cities.length} città obiettivo (${cities.join(', ')}) a fine turno!`,
    };
  }

  // End of E45 check
  if (state.turn === 'E45') {
    if (newTotalVp >= state.config.victory.axisVpToWin) {
      return {
        vpDelta,
        vpBreakdown,
        winner: 'AXIS',
        reason: `Fine di E45: l'Asse vince ai punti con ${newTotalVp} PV (soglia: ${state.config.victory.axisVpToWin})!`,
      };
    } else {
      return {
        vpDelta,
        vpBreakdown,
        winner: 'USSR',
        reason: `Fine di E45: l'URSS vince perché l'Asse ha solo ${newTotalVp} PV (soglia richiesta: ${state.config.victory.axisVpToWin})!`,
      };
    }
  }

  return { vpDelta, vpBreakdown, winner: null, reason: null };
}
