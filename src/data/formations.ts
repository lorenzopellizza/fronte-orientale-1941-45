import {
  AirCard,
  ExperienceLevel,
  Formation,
  FormationKeyword,
  FormationType,
  GroundEquipmentCard,
  LocationId,
  Side,
  TurnId,
} from '../engine/types';

function makeInitialEquip(
  id: string,
  name: string,
  side: Side,
  cost: number,
  atk: number,
  def: number,
  keywords: ('ANTICARRO' | 'PESANTE')[] = [],
  year: 1941 | 1942 | 1943 | 1944 = 1941
): GroundEquipmentCard {
  return {
    id,
    templateId: id,
    name,
    side,
    year,
    type: 'EQUIPAGGIAMENTO_TERRA',
    cost,
    atk,
    def,
    requires: 'C',
    keywords,
  };
}

function makeFormation(
  id: string,
  name: string,
  side: Side,
  type: FormationType,
  location: LocationId,
  strength: number,
  level: ExperienceLevel,
  equipment: GroundEquipmentCard | null = null,
  keywords: FormationKeyword[] = [],
  xpForLevel?: number
): Formation {
  const defaultXp = level === 'ELITE' ? 4 : level === 'VETERANA' ? 2 : 0;
  return {
    id,
    name,
    baseName: name,
    side,
    type,
    maxStrength: strength,
    strength,
    xp: xpForLevel ?? defaultXp,
    level,
    keywords,
    equipment,
    location,
    exhausted: false,
    encircled: false,
    encircledBySectors: [],
    reactedThisTurn: false,
  };
}

export function getInitialFormations(): Formation[] {
  return [
    // Asse E41
    makeFormation('axis_18_armee', '18. Armee', 'AXIS', 'FANTERIA', 'NORD', 4, 'VETERANA'),
    makeFormation(
      'axis_1_pz',
      '1. Panzer-Division',
      'AXIS',
      'CORAZZATA',
      'NORD',
      3,
      'VETERANA',
      makeInitialEquip('init_eq_axis_1pz', 'Panzer III', 'AXIS', 2, 2, 1)
    ),
    makeFormation('axis_4_armee', '4. Armee', 'AXIS', 'FANTERIA', 'CENTRO', 4, 'VETERANA'),
    makeFormation(
      'axis_7_pz',
      '7. Panzer-Division',
      'AXIS',
      'CORAZZATA',
      'CENTRO',
      3,
      'ELITE',
      makeInitialEquip('init_eq_axis_7pz', 'Panzer 38(t)', 'AXIS', 1, 1, 1)
    ),
    makeFormation('axis_gd', 'Großdeutschland', 'AXIS', 'MOTORIZZATA', 'CENTRO', 3, 'ELITE'),
    makeFormation('axis_6_armee', '6. Armee', 'AXIS', 'FANTERIA', 'SUD', 4, 'VETERANA'),
    makeFormation(
      'axis_11_pz',
      '11. Panzer-Division',
      'AXIS',
      'CORAZZATA',
      'SUD',
      3,
      'VETERANA',
      makeInitialEquip('init_eq_axis_11pz', 'Panzer III', 'AXIS', 2, 2, 1)
    ),
    makeFormation('axis_3_rumena', '3ª Armata rumena', 'AXIS', 'FANTERIA', 'SUD', 2, 'RECLUTA', null, ['FRAGILE']),

    // URSS E41
    makeFormation('ussr_8_armata', '8ª Armata', 'USSR', 'FANTERIA', 'NORD', 3, 'RECLUTA'),
    makeFormation('ussr_11_armata', '11ª Armata', 'USSR', 'FANTERIA', 'NORD', 3, 'RECLUTA'),
    makeFormation('ussr_3_armata', '3ª Armata', 'USSR', 'FANTERIA', 'CENTRO', 3, 'RECLUTA'),
    makeFormation('ussr_10_armata', '10ª Armata', 'USSR', 'FANTERIA', 'CENTRO', 4, 'RECLUTA'),
    makeFormation('ussr_6_mecc', '6° Corpo Meccanizzato', 'USSR', 'CORAZZATA', 'CENTRO', 3, 'RECLUTA'),
    makeFormation('ussr_5_armata', '5ª Armata', 'USSR', 'FANTERIA', 'SUD', 3, 'RECLUTA'),
    makeFormation(
      'ussr_8_mecc',
      '8° Corpo Meccanizzato',
      'USSR',
      'CORAZZATA',
      'SUD',
      3,
      'RECLUTA',
      makeInitialEquip('init_eq_ussr_8mecc', 'T-34/76', 'USSR', 2, 2, 2)
    ),
    makeFormation('ussr_16_armata', '16ª Armata', 'USSR', 'FANTERIA', 'RISERVA', 3, 'RECLUTA'),
  ];
}

export function getInitialAirZones(): Record<Side, AirCard[]> {
  return {
    AXIS: [
      {
        id: 'init_air_axis_bf109f',
        templateId: 'axis_bf109f_41',
        name: 'Bf 109F',
        side: 'AXIS',
        year: 1941,
        type: 'AEREO',
        cost: 2,
        caccia: 2,
        supporto: 0,
      },
      {
        id: 'init_air_axis_ju87',
        templateId: 'axis_ju87_41',
        name: 'Ju 87 Stuka',
        side: 'AXIS',
        year: 1941,
        type: 'AEREO',
        cost: 2,
        caccia: 0,
        supporto: 2,
      },
    ],
    USSR: [
      {
        id: 'init_air_ussr_i16',
        templateId: 'ussr_i16_41',
        name: 'I-16',
        side: 'USSR',
        year: 1941,
        type: 'AEREO',
        cost: 1,
        caccia: 1,
        supporto: 0,
      },
    ],
  };
}

export function getReinforcementsForTurn(turn: TurnId): Formation[] {
  switch (turn) {
    case 'I41':
      return [
        makeFormation('reinf_axis_2pz_i41', '2. Panzer-Division', 'AXIS', 'CORAZZATA', 'RISERVA', 3, 'VETERANA'),
        makeFormation('reinf_ussr_sib_i41', 'Divisioni siberiane', 'USSR', 'FANTERIA', 'RISERVA', 4, 'VETERANA', null, ['INVERNO']),
        makeFormation('reinf_ussr_1urto_i41', "1ª Armata d'urto", 'USSR', 'FANTERIA', 'RISERVA', 4, 'RECLUTA'),
      ];
    case 'E42':
      return [
        makeFormation('reinf_axis_24pz_e42', '24. Panzer-Division', 'AXIS', 'CORAZZATA', 'RISERVA', 3, 'RECLUTA'),
        makeFormation('reinf_axis_armir_e42', '8ª Armata italiana – ARMIR', 'AXIS', 'FANTERIA', 'RISERVA', 2, 'RECLUTA', null, ['FRAGILE']),
        makeFormation('reinf_axis_2ung_e42', '2ª Armata ungherese', 'AXIS', 'FANTERIA', 'RISERVA', 2, 'RECLUTA', null, ['FRAGILE']),
        makeFormation('reinf_ussr_62_e42', '62ª Armata', 'USSR', 'FANTERIA', 'RISERVA', 4, 'RECLUTA', null, ['URBANO']),
        makeFormation('reinf_ussr_5cor_e42', '5ª Armata Corazzata', 'USSR', 'CORAZZATA', 'RISERVA', 3, 'RECLUTA'),
      ];
    case 'I42':
      return [
        makeFormation('reinf_ussr_2g_i42', '2ª Armata della Guardia', 'USSR', 'FANTERIA', 'RISERVA', 5, 'VETERANA', null, ['GUARDIA']),
      ];
    case 'E43':
      return [
        makeFormation(
          'reinf_axis_spz503_e43',
          'schwere Panzer-Abteilung 503',
          'AXIS',
          'CORAZZATA',
          'RISERVA',
          2,
          'VETERANA',
          makeInitialEquip('reinf_eq_tiger_503', 'Tiger I', 'AXIS', 5, 4, 3, ['PESANTE'], 1943)
        ),
        makeFormation('reinf_ussr_5corg_e43', '5ª Armata Corazzata della Guardia', 'USSR', 'CORAZZATA', 'RISERVA', 5, 'VETERANA', null, ['GUARDIA']),
        makeFormation('reinf_ussr_1cor_e43', '1ª Armata Corazzata', 'USSR', 'CORAZZATA', 'RISERVA', 4, 'RECLUTA'),
      ];
    case 'I43':
      return [
        makeFormation('reinf_ussr_3corg_i43', '3ª Armata Corazzata della Guardia', 'USSR', 'CORAZZATA', 'RISERVA', 4, 'VETERANA', null, ['GUARDIA']),
      ];
    case 'E44':
      return [
        makeFormation('reinf_ussr_2cor_e44', '2ª Armata Corazzata', 'USSR', 'CORAZZATA', 'RISERVA', 4, 'RECLUTA'),
      ];
    default:
      return [];
  }
}

export function createVolkssturmFormations(turn: TurnId): Formation[] {
  return [
    makeFormation(`volkssturm_1_${turn}`, 'Volkssturm I', 'AXIS', 'FANTERIA', 'RISERVA', 1, 'RECLUTA', null, ['FRAGILE']),
    makeFormation(`volkssturm_2_${turn}`, 'Volkssturm II', 'AXIS', 'FANTERIA', 'RISERVA', 1, 'RECLUTA', null, ['FRAGILE']),
  ];
}
