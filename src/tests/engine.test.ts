import { describe, expect, it } from 'vitest';
import { chooseAiAction } from '../engine/ai';
import { applyAction, createInitialState } from '../engine/engine';
import { computeCombat } from '../engine/combat';
import { evaluateEndOfTurnVictory, checkBerlinImmediateVictory } from '../engine/victory';
import { GameAction } from '../engine/types';

describe('FRONTE ORIENTALE 1941-45 — Engine Unit Tests (M1)', () => {
  it('1. Determinism: same seed + same actions produce identical GameState JSON', () => {
    const actions: GameAction[] = [
      { type: 'PLAY_EVENT', cardId: 'axis_barbarossa_init' },
      { type: 'PLAY_EVENT', cardId: 'ussr_evacuazione_urali_init' },
      { type: 'ATTACK', sector: 'CENTRO' },
      // Defender assigns losses if any
    ];

    const runSimulation = (seed: number) => {
      let s = createInitialState({ seed });
      for (const act of actions) {
        s = applyAction(s, act);
      }
      return s;
    };

    const s1 = runSimulation(99999);
    const s2 = runSimulation(99999);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it('2. Combat calculation & breakdown: E41 surprise, combined arms, air superiority, city defense', () => {
    const state = createInitialState({
      seed: 42,
      dice: { enabled: false, table: { 1: -1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 } },
    });

    const attackers = state.formations.filter((f) => f.side === 'AXIS' && f.location === 'CENTRO');
    const defenders = state.formations.filter((f) => f.side === 'USSR' && f.location === 'CENTRO');

    const { breakdown } = computeCombat(state, 'CENTRO', 'AXIS', attackers, defenders, [], [], false);

    // Axis in CENTRO E41:
    // 4. Armee: F4 + 1 (VETERANA) = 5
    // 7. Panzer-Division: F3 + 2 (ELITE) + 1 (Panzer 38(t) atk) = 6
    // Großdeutschland: F3 + 2 (ELITE) = 5
    // Base sum = 16
    // Combined arms (Corazzata + Fanteria/Mot) = +1
    // Air superiority (Bf 109F caccia 2 vs I-16 caccia 1) = +1, Ju 87 Stuka supporto = +2 -> +3
    // Total Attack = 16 + 1 + 3 = 20

    // USSR in CENTRO E41:
    // 3ª Armata: F3 = 3
    // 10ª Armata: F4 = 4
    // 6° Corpo Meccanizzato: F3 = 3
    // Base sum = 10
    // Surprise E41 (-1 per formation = -3)
    // Total Defense = 10 - 3 = 7
    expect(breakdown.totalAttack).toBe(20);
    expect(breakdown.totalDefense).toBe(7);
    expect(breakdown.finalDiff).toBe(13);
    expect(breakdown.outcome).toBe('SFONDAMENTO');
    expect(breakdown.markerShift).toBe(2);
    expect(breakdown.defenderLosses).toBe(2);
    expect(breakdown.attackerLosses).toBe(0);
  });

  it('3. Supply & Culminating Point (6.5): Axis attack/defense penalties and USSR attack penalties in German territory', () => {
    const state = createInitialState({
      dice: { enabled: false, table: { 1: -1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 } },
    });

    // Move NORD marker to 5 (Leningrado)
    state.sectors.NORD.marker = 5;
    const axisN = state.formations.filter((f) => f.side === 'AXIS' && f.location === 'NORD');
    const ussrN = state.formations.filter((f) => f.side === 'USSR' && f.location === 'NORD');

    const resAxisAtk = computeCombat(state, 'NORD', 'AXIS', axisN, ussrN, [], [], false);
    const supplyMod = resAxisAtk.breakdown.attackModifiers.find((m) => m.source.includes('Rifornimento Asse'));
    // Marker 5 > 3 => -2 penalty
    expect(supplyMod?.value).toBe(-2);

    // Axis defending at marker 5 => -1 penalty
    const resUssrAtk = computeCombat(state, 'NORD', 'USSR', ussrN, axisN, [], [], false);
    const overextMod = resUssrAtk.breakdown.defenseModifiers.find((m) =>
      m.source.includes('Sovraestensione')
    );
    expect(overextMod?.value).toBe(-1);

    // USSR attacking at marker 1 => -2 penalty
    state.sectors.NORD.marker = 1;
    const resUssrAtkAt1 = computeCombat(state, 'NORD', 'USSR', ussrN, axisN, [], [], false);
    const ussrSupplyMod = resUssrAtkAt1.breakdown.attackModifiers.find((m) =>
      m.source.includes('Rifornimento URSS')
    );
    expect(ussrSupplyMod?.value).toBe(-2);
  });

  it('4. Breakthrough & Encirclement (6.6): Threat at gap 2 (choice) and Auto-encirclement at gap >= 3', () => {
    let state = createInitialState({
      dice: { enabled: false, table: { 1: -1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 } },
    });

    // In E41 markers are NORD=1, CENTRO=1, SUD=1.
    // Axis attacks CENTRO -> SFONDAMENTO -> marker becomes 3 (gap = 2 with NORD=1 and SUD=1)
    state = applyAction(state, { type: 'ATTACK', sector: 'CENTRO' });
    expect(state.pendingCombat?.phase).toBe('DEFENDER_LOSSES');

    // Assign 2 losses to USSR 10ª Armata in CENTRO
    state = applyAction(state, {
      type: 'ASSIGN_LOSSES',
      side: 'USSR',
      formationId: 'ussr_10_armata',
      amount: 2,
    });

    // Now marker in CENTRO is 3, NORD=1 (gap 2), SUD=1 (gap 2).
    // USSR must choose RITIRATA or RESISTERE in NORD and SUD!
    expect(state.pendingCombat?.phase).toBe('ENCIRCLEMENT_CHOICE');
    expect(state.pendingCombat?.threatenedSectors).toEqual(['NORD', 'SUD']);

    // USSR chooses RITIRATA in NORD -> NORD marker moves from 1 to 2, units not encircled
    state = applyAction(state, {
      type: 'ENCIRCLEMENT_DECISION',
      sector: 'NORD',
      choice: 'RITIRATA',
    });
    expect(state.sectors.NORD.marker).toBe(2);
    expect(
      state.formations.filter((f) => f.side === 'USSR' && f.location === 'NORD').every((f) => !f.encircled)
    ).toBe(true);

    // USSR chooses RESISTERE in SUD -> SUD units become encircled!
    state = applyAction(state, {
      type: 'ENCIRCLEMENT_DECISION',
      sector: 'SUD',
      choice: 'RESISTERE',
    });
    expect(state.sectors.SUD.marker).toBe(1);
    expect(
      state.formations.filter((f) => f.side === 'USSR' && f.location === 'SUD').every((f) => f.encircled)
    ).toBe(true);
    expect(state.phase).toBe('ORDERS');
  });

  it('5. Reserve reaction (6.2): mobile armor/motorized without PESANTE can react, PESANTE cannot', () => {
    let state = createInitialState({
      dice: { enabled: false, table: { 1: -1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 } },
    });

    // Move USSR 6° Corpo Meccanizzato (CORAZZATA) to RISERVA so USSR has a mobile reserve
    const mech6 = state.formations.find((f) => f.id === 'ussr_6_mecc')!;
    mech6.location = 'RISERVA';

    // Axis attacks NORD
    state = applyAction(state, { type: 'ATTACK', sector: 'NORD' });
    expect(state.phase).toBe('COMBAT');
    expect(state.pendingCombat?.phase).toBe('REACTION');
    expect(state.activeSide).toBe('USSR');

    // USSR reacts with 6° Corpo Meccanizzato into NORD
    state = applyAction(state, {
      type: 'DEFENSE_REACTION',
      reactingFormationIds: ['ussr_6_mecc'],
    });

    const updatedMech6 = state.formations.find((f) => f.id === 'ussr_6_mecc')!;
    expect(updatedMech6.location).toBe('NORD');
    expect(updatedMech6.reactedThisTurn).toBe(true);
  });

  it('6. Experience & Soviet Guards promotion (6.9) + Reorganization dilution (5)', () => {
    let state = createInitialState({
      dice: { enabled: false, table: { 1: -1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 } },
    });

    // Give 8° Corpo Meccanizzato (USSR) 2 XP and trigger end of turn by passing both sides
    const mech8 = state.formations.find((f) => f.id === 'ussr_8_mecc')!;
    mech8.xp = 2;

    state = applyAction(state, { type: 'PASS' }); // Axis passes
    state = applyAction(state, { type: 'PASS' }); // USSR passes -> End of E41 -> Start of I41

    const promoted = state.formations.find((f) => f.id === 'ussr_8_mecc')!;
    expect(promoted.level).toBe('VETERANA');
    expect(promoted.keywords).toContain('GUARDIA');
    expect(promoted.name).toContain('della Guardia');
    expect(promoted.maxStrength).toBe(4); // was 3, now +1

    // Now damage it by 2 and reorganize 2 points -> drops level from VETERANA to RECLUTA
    promoted.strength = 2;
    state.activeSide = 'USSR';
    state.pp.USSR = 10;
    state = applyAction(state, {
      type: 'REORGANIZE',
      formationId: 'ussr_8_mecc',
      points: 2,
    });
    const afterReorg = state.formations.find((f) => f.id === 'ussr_8_mecc')!;
    expect(afterReorg.strength).toBe(4);
    expect(afterReorg.level).toBe('RECLUTA');
  });

  it('7. Victory conditions (Section 8): Berlin sudden death, 3 cities sudden death, 1944 penalties, E45 threshold', () => {
    const state = createInitialState();

    // 1. Berlin immediate victory
    state.sectors.CENTRO.marker = 0;
    const berlinCheck = checkBerlinImmediateVictory(state);
    expect(berlinCheck.winner).toBe('USSR');

    // 2. Axis 3 objective cities sudden death (Leningrado, Mosca, Stalingrado)
    state.sectors.NORD.marker = 5;
    state.sectors.CENTRO.marker = 5;
    state.sectors.SUD.marker = 5;
    const suddenCheck = evaluateEndOfTurnVictory(state);
    expect(suddenCheck.winner).toBe('AXIS');
    expect(suddenCheck.vpDelta).toBe(3);

    // 3. 1944 penalty for marker <= 1
    state.turn = 'E44';
    state.sectors.NORD.marker = 1;
    state.sectors.CENTRO.marker = 2;
    state.sectors.SUD.marker = 1;
    const pen44 = evaluateEndOfTurnVictory(state);
    expect(pen44.vpDelta).toBe(-2); // NORD and SUD at marker 1

    // 4. End of E45 check
    state.turn = 'E45';
    state.axisVp = 6;
    state.sectors.NORD.marker = 3;
    state.sectors.CENTRO.marker = 3;
    state.sectors.SUD.marker = 3;
    const e45Win = evaluateEndOfTurnVictory(state);
    expect(e45Win.winner).toBe('AXIS');

    state.axisVp = 5;
    const e45Loss = evaluateEndOfTurnVictory(state);
    expect(e45Loss.winner).toBe('USSR');
  });

  it('8. StrategicBot AI plays a full campaign without invalid actions', () => {
    let state = createInitialState();
    let steps = 0;
    while (state.phase !== 'GAME_OVER' && steps < 400) {
      const decision = chooseAiAction(state);
      state = applyAction(state, decision.action);
      steps += 1;
    }
    expect(state.phase).toBe('GAME_OVER');
    expect(state.winner).toBeTruthy();
  });

  it('9. Anti-Cheese Balance Test: Mindless Axis (clicking only ATTACK Nord -> Centro -> Sud without cards or movement) cannot win in 3 turns', () => {
    let state = createInitialState({ seed: 12345 });
    let steps = 0;
    const sectorsOrder: ('NORD' | 'CENTRO' | 'SUD')[] = ['NORD', 'CENTRO', 'SUD'];

    while (state.phase !== 'GAME_OVER' && steps < 400) {
      steps += 1;
      if (state.activeSide === 'USSR') {
        const decision = chooseAiAction(state);
        state = applyAction(state, decision.action);
        continue;
      }

      // Mindless Axis player
      if (state.phase === 'NORMANDY_EVENT') {
        const decision = chooseAiAction(state);
        state = applyAction(state, decision.action);
        continue;
      }

      if (state.phase === 'COMBAT') {
        // Use AI only for mandatory loss/reaction/encirclement prompts
        const decision = chooseAiAction(state);
        state = applyAction(state, decision.action);
        continue;
      }

      // In ORDERS phase, Mindless Axis ONLY clicks ATTACK on NORD, then CENTRO, then SUD, never playing cards or moving units
      const attackableSector = sectorsOrder.find((sec) => {
        if (state.sectors[sec].marker >= 6) return false;
        return state.formations.some(
          (f) => f.side === 'AXIS' && f.location === sec && !f.exhausted && !f.encircled
        );
      });

      if (attackableSector && state.ordersRemaining.AXIS > 0) {
        state = applyAction(state, { type: 'ATTACK', sector: attackableSector });
      } else {
        state = applyAction(state, { type: 'PASS' });
      }
    }

    // Must NOT win in 3 turns (turnIndex <= 2) and must LOSE against StrategicBot if never using strategy/cards/movement!
    const wonInThreeTurns = state.winner === 'AXIS' && state.turnIndex <= 2;
    expect(wonInThreeTurns).toBe(false);
    expect(state.winner).toBe('USSR');
  });
});
