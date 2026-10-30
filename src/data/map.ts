import { SectorId } from '../engine/types';

export interface MapCell {
  index: number;
  name: string;
  isObjectiveCity: boolean;
  isBerlin?: boolean;
  isOil?: boolean;
}

export interface SectorDefinition {
  id: SectorId;
  label: string;
  adjacent: SectorId[];
  cells: MapCell[];
}

export const SECTORS: SectorId[] = ['NORD', 'CENTRO', 'SUD'];

export const MAP_DATA: Record<SectorId, SectorDefinition> = {
  NORD: {
    id: 'NORD',
    label: 'Settore Nord',
    adjacent: ['CENTRO'],
    cells: [
      { index: 0, name: 'Königsberg', isObjectiveCity: false },
      { index: 1, name: 'Confine baltico', isObjectiveCity: false },
      { index: 2, name: 'Riga', isObjectiveCity: false },
      { index: 3, name: 'Pskov', isObjectiveCity: false },
      { index: 4, name: 'Luga', isObjectiveCity: false },
      { index: 5, name: 'Leningrado ★', isObjectiveCity: true },
      { index: 6, name: 'Tichvin', isObjectiveCity: false },
    ],
  },
  CENTRO: {
    id: 'CENTRO',
    label: 'Settore Centro',
    adjacent: ['NORD', 'SUD'],
    cells: [
      { index: 0, name: 'Berlino', isObjectiveCity: false, isBerlin: true },
      { index: 1, name: 'Brest (confine)', isObjectiveCity: false },
      { index: 2, name: 'Minsk', isObjectiveCity: false },
      { index: 3, name: 'Smolensk', isObjectiveCity: false },
      { index: 4, name: "Vjaz'ma", isObjectiveCity: false },
      { index: 5, name: 'Mosca ★', isObjectiveCity: true },
      { index: 6, name: "Gor'kij", isObjectiveCity: false },
    ],
  },
  SUD: {
    id: 'SUD',
    label: 'Settore Sud',
    adjacent: ['CENTRO'],
    cells: [
      { index: 0, name: 'Cracovia', isObjectiveCity: false },
      { index: 1, name: 'Leopoli (confine)', isObjectiveCity: false },
      { index: 2, name: 'Kiev', isObjectiveCity: false },
      { index: 3, name: 'Charkov', isObjectiveCity: false },
      { index: 4, name: 'Rostov', isObjectiveCity: false },
      { index: 5, name: 'Stalingrado ★', isObjectiveCity: true },
      { index: 6, name: 'Caucaso ★ (petrolio)', isObjectiveCity: true, isOil: true },
    ],
  },
};

export function areSectorsAdjacent(a: SectorId, b: SectorId): boolean {
  return MAP_DATA[a].adjacent.includes(b);
}

/**
 * Which cell would the defender lose if the marker moved 1 step towards the defender?
 * - Recall: cells <= marker are controlled by Axis; cells > marker are controlled by USSR.
 * - If Axis attacks USSR at marker M, advancing moves marker to M + 1, so USSR loses cell M + 1.
 * - If USSR attacks Axis at marker M, advancing moves marker to M - 1, so Axis loses cell M.
 */
export function getCellDefenderWouldLose(sector: SectorId, defender: 'AXIS' | 'USSR', currentMarker: number): MapCell | null {
  const cells = MAP_DATA[sector].cells;
  if (defender === 'USSR') {
    const targetIdx = currentMarker + 1;
    return cells[targetIdx] ?? null;
  } else {
    const targetIdx = currentMarker;
    return cells[targetIdx] ?? null;
  }
}

/**
 * Checks whether a sector's current marker is on an objective city ★ or defending one.
 * Used for URBANO keyword: "+2 in difesa se il settore ha il marker su una città ★ o la difende."
 */
export function isSectorUrbanForDefender(sector: SectorId, defender: 'AXIS' | 'USSR', currentMarker: number): boolean {
  const currentCell = MAP_DATA[sector].cells[currentMarker];
  const cellToLose = getCellDefenderWouldLose(sector, defender, currentMarker);
  return Boolean(currentCell?.isObjectiveCity || cellToLose?.isObjectiveCity);
}
