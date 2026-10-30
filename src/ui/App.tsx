import React, { useEffect, useState } from 'react';
import { areSectorsAdjacent, MAP_DATA, SECTORS } from '../data/map';
import {
  getAirSuperiority,
  getFormationBaseAttack,
  getFormationBaseDefense,
  getSeason,
  getTurnYear,
} from '../engine/combat';
import {
  applyAction,
  canEquipCardOnFormation,
  createInitialState,
  isFormationMobile,
} from '../engine/engine';
import {
  Card,
  CombatBreakdown,
  Formation,
  GameAction,
  GameConfig,
  GameState,
  LocationId,
  SectorId,
  Side,
  TURNS,
} from '../engine/types';
import { BattleModal } from './BattleModal';
import { DevToolsPanel } from './DevToolsPanel';
import { FormationCard } from './FormationCard';
import { RulesModal } from './RulesModal';
import { SettingsModal } from './SettingsModal';
import { StatsModal } from './StatsModal';
import { KEYWORD_TOOLTIPS, RULE_TOOLTIPS } from './tooltips';
import {
  CardIllustrationFrame,
  CityLandmarkIcon,
  FactionEmblem,
  SectorBattlefieldBanner,
  WarRoomCompassSvg,
} from './WargameArtwork';
import { chooseAiAction } from '../engine/ai';

const STORAGE_KEY = 'fronte_orientale_1941_45_save_v1';

export type GameMode = 'VS_AI_USSR' | 'VS_AI_AXIS' | 'HOTSEAT';

export const App: React.FC = () => {
  const [state, setState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as GameState;
      }
    } catch {
      // ignore invalid localStorage
    }
    return createInitialState();
  });

  const [history, setHistory] = useState<GameState[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // UI modals & drawers
  const [rulesOpen, setRulesOpen] = useState<boolean>(false);
  const [logOpen, setLogOpen] = useState<boolean>(false);
  const [devOpen, setDevOpen] = useState<boolean>(false);
  const [statsOpen, setStatsOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [inspectedBreakdown, setInspectedBreakdown] = useState<CombatBreakdown | null>(null);

  // Game mode (Single-Player vs AI or 2-Player Hotseat)
  const [gameMode, setGameMode] = useState<GameMode>('VS_AI_USSR');
  const [aiPaused, setAiPaused] = useState<boolean>(false);
  const [lastAiRadio, setLastAiRadio] = useState<string | null>(
    'Comando IA pronto. Scegli il tuo schieramento o muovi le tue divisioni sulla mappa.'
  );

  // Hotseat curtain state
  const [hotseatEnabled, setHotseatEnabled] = useState<boolean>(false);
  const [curtainSide, setCurtainSide] = useState<Side | null>(null);

  // Board-game direct interaction state
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const [movingFormationId, setMovingFormationId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [attackConfirmSector, setAttackConfirmSector] = useState<SectorId | null>(null);
  const [selectedAttackEvents, setSelectedAttackEvents] = useState<string[]>([]);
  const [showSpecialDrawer, setShowSpecialDrawer] = useState<'NONE' | 'REORGANIZE' | 'PROTOTYPE' | 'RIMPIAZZI'>('NONE');

  // Sub-forms for special drawer
  const [reorgPoints, setReorgPoints] = useState<number>(1);
  const [rimpiazziAlloc, setRimpiazziAlloc] = useState<Record<string, number>>({});
  const [normandyFormationId, setNormandyFormationId] = useState<string>('');

  // Auto-open Stats modal on Game Over
  useEffect(() => {
    if (state.phase === 'GAME_OVER') {
      setStatsOpen(true);
    }
  }, [state.phase]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 3200);
  };

  const getInteractiveSide = (s: GameState): Side => {
    if (s.phase === 'NORMANDY_EVENT') {
      return 'AXIS';
    }
    if (s.phase === 'COMBAT' && s.pendingCombat) {
      if (
        s.pendingCombat.phase === 'REACTION' ||
        s.pendingCombat.phase === 'DEFENDER_LOSSES' ||
        s.pendingCombat.phase === 'ENCIRCLEMENT_CHOICE'
      ) {
        return s.pendingCombat.defender;
      }
      if (s.pendingCombat.phase === 'ATTACKER_LOSSES') {
        return s.pendingCombat.attacker;
      }
    }
    return s.activeSide;
  };

  const aiSide: Side | null =
    gameMode === 'VS_AI_USSR' ? 'USSR' : gameMode === 'VS_AI_AXIS' ? 'AXIS' : null;

  const clearBoardSelection = () => {
    setMovingFormationId(null);
    setSelectedCardId(null);
    setAttackConfirmSector(null);
    setSelectedAttackEvents([]);
    setShowSpecialDrawer('NONE');
    setRimpiazziAlloc({});
  };

  const dispatch = (action: GameAction) => {
    setErrorMsg(null);
    try {
      const prevInteractive = getInteractiveSide(state);
      const prevLogLen = state.logs.length;
      const next = applyAction(state, action);
      setHistory((prev) => [...prev.slice(-39), state]);
      setState(next);

      const newCombatLog = next.logs
        .slice(prevLogLen)
        .reverse()
        .find((l) => l.type === 'COMBAT' && l.breakdown);
      if (newCombatLog) {
        showToast(newCombatLog.message);
      }

      const nextInteractive = getInteractiveSide(next);
      if (
        gameMode === 'HOTSEAT' &&
        hotseatEnabled &&
        prevInteractive !== nextInteractive &&
        next.phase !== 'GAME_OVER'
      ) {
        setCurtainSide(nextInteractive);
      }

      if (
        action.type !== 'DEFENSE_REACTION' &&
        action.type !== 'ASSIGN_LOSSES' &&
        action.type !== 'ENCIRCLEMENT_DECISION' &&
        action.type !== 'RECONVERT_CARD' &&
        action.type !== 'RECONVERT_EQUIPMENT'
      ) {
        clearBoardSelection();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveGame = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      showToast('Partita salvata sul browser.');
    } catch {
      setErrorMsg('Impossibile salvare in localStorage.');
    }
  };

  const handleLoadGame = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setErrorMsg('Nessun salvataggio trovato.');
        return;
      }
      const loaded = JSON.parse(raw) as GameState;
      setHistory((prev) => [...prev, state]);
      setState(loaded);
      clearBoardSelection();
      showToast('Partita caricata.');
    } catch {
      setErrorMsg('File di salvataggio corrotto.');
    }
  };

  const handleNewGame = (customCfg?: GameConfig) => {
    const fresh = createInitialState(customCfg ?? state.config);
    setHistory([]);
    setState(fresh);
    setErrorMsg(null);
    clearBoardSelection();
    showToast(`Nuova campagna iniziata (Seed ${fresh.config.seed}).`);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setErrorMsg(null);
    clearBoardSelection();
  };

  const interactiveSide = getInteractiveSide(state);
  const humanSide: Side =
    aiSide === 'USSR' ? 'AXIS' : aiSide === 'AXIS' ? 'USSR' : interactiveSide;
  const isAiTurn = state.phase !== 'GAME_OVER' && aiSide !== null && interactiveSide === aiSide;

  // Automatic AI Opponent execution when it's AI's turn or combat reaction/loss decision
  useEffect(() => {
    if (!isAiTurn || aiPaused) return;
    const timer = window.setTimeout(() => {
      try {
        const decision = chooseAiAction(state);
        setLastAiRadio(decision.reasoning);
        dispatch(decision.action);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [state, isAiTurn, aiPaused]);

  const season = getSeason(state.turn);
  const year = getTurnYear(state.turn);
  const airInfo = getAirSuperiority(state);
  const activeHand = state.hands[state.activeSide];
  const displayedHandSide: Side = aiSide !== null ? humanSide : state.activeSide;
  const displayedHand = state.hands[displayedHandSide];
  const canPlayFromDisplayedHand =
    state.phase === 'ORDERS' && state.activeSide === displayedHandSide && !isAiTurn;
  const selectedCard: Card | undefined = activeHand.find((c) => c.id === selectedCardId);
  const movingFormation: Formation | undefined = state.formations.find((f) => f.id === movingFormationId);
  const selectedFormation: Formation | undefined = state.formations.find((f) => f.id === selectedFormationId);

  const myFormations = state.formations.filter((f) => f.side === state.activeSide);
  const myDestroyed = state.destroyedFormations.filter((f) => f.side === state.activeSide);
  const nextYear = year + 1;
  const prototypeCards = state.futureDecks[state.activeSide][nextYear] ?? [];
  const attackEventsInHand = activeHand.filter(
    (c): c is Extract<Card, { type: 'EVENTO' }> => c.type === 'EVENTO' && c.timing === 'ATTACCO'
  );

  const getValidRedeployTargets = (f: Formation | undefined): LocationId[] => {
    if (!f || f.encircled) return [];
    const allLocations: LocationId[] = ['RISERVA', 'NORD', 'CENTRO', 'SUD'];
    if (isFormationMobile(f)) {
      return allLocations.filter((loc) => loc !== f.location);
    }
    if (f.location === 'RISERVA') {
      return ['NORD', 'CENTRO', 'SUD'];
    }
    const targets: LocationId[] = ['RISERVA'];
    for (const sec of SECTORS) {
      if (areSectorsAdjacent(f.location, sec)) {
        targets.push(sec);
      }
    }
    return targets;
  };

  const validMoveDestinations = getValidRedeployTargets(movingFormation);

  // Build dynamic plain-Italian Commander's Guide prompt
  const getTacticalAdvisorPrompt = (): { text: string; highlight: boolean } => {
    if (state.phase === 'GAME_OVER') {
      return {
        text: `🏆 PARTITA CONCLUSA — Vincitore: ${state.winner === 'AXIS' ? 'ASSE' : 'URSS'} (${state.victoryReason})`,
        highlight: true,
      };
    }
    if (isAiTurn) {
      const aiName = aiSide === 'AXIS' ? 'OKW (IA Asse)' : 'STAVKA (IA URSS)';
      return {
        text: `📻 ${aiName} sta trasmettendo gli ordini operativi al fronte... Attendi la mossa del computer.`,
        highlight: true,
      };
    }
    if (state.phase === 'NORMANDY_EVENT') {
      return {
        text: `⚓ EVENTO OBBLIGATORIO E44 (Sbarco in Normandia): scegli qui sotto quale divisione Corazzata tedesca inviare a Ovest.`,
        highlight: true,
      };
    }
    if (movingFormation) {
      return {
        text: `⇄ STAI SPOSTANDO "${movingFormation.name}": clicca su una destinazione illuminata in VERDE sulla mappa (${validMoveDestinations.join(
          ', '
        )}) per completare il movimento (1 Ordine).`,
        highlight: true,
      };
    }
    if (selectedCard) {
      if (selectedCard.type === 'EQUIPAGGIAMENTO_TERRA') {
        return {
          text: `🔧 CARTA SELEZIONATA: "${selectedCard.name}" (${selectedCard.cost} PP). Clicca sul pulsante dorato "Monta" sopra una tua unità compatibile sulla mappa!`,
          highlight: true,
        };
      }
      if (selectedCard.type === 'COMANDANTE') {
        return {
          text: `🎖 COMANDANTE SELEZIONATO: "${selectedCard.name}" (${selectedCard.cost} PP). Clicca su "Assegna Comandante Qui" in uno dei 3 Settori sulla mappa!`,
          highlight: true,
        };
      }
      if (selectedCard.type === 'AEREO') {
        return {
          text: `✈ SQUADRIGLIA SELEZIONATA: "${selectedCard.name}" (${selectedCard.cost} PP). Clicca su "Schiera in Aviazione" sulla carta o nel pannello Aviazione!`,
          highlight: true,
        };
      }
      if (selectedCard.type === 'EVENTO') {
        if (selectedCard.templateId === 'axis_ponte_aereo_42') {
          return {
            text: `📜 PONTE AEREO SELEZIONATO: clicca sul Settore che vuoi rifornire per via aerea (2 PP, 1 Ordine).`,
            highlight: true,
          };
        }
        return {
          text: `📜 EVENTO SELEZIONATO: "${selectedCard.name}" (${selectedCard.timing}). Premi il pulsante sulla carta per attivarlo!`,
          highlight: true,
        };
      }
    }
    if (attackConfirmSector) {
      return {
        text: `⚔ PREPARAZIONE OFFENSIVA NEL SETTORE ${attackConfirmSector}: scegli eventuali carte di supporto d'attacco e conferma l'offensiva!`,
        highlight: true,
      };
    }
    const sideName = state.activeSide === 'AXIS' ? 'ASSE (Wehrmacht)' : 'URSS (Armata Rossa)';
    return {
      text: `Tocca a ${sideName}: hai ${state.ordersRemaining[state.activeSide]} Ordini e ${
        state.pp[state.activeSide]
      } PP. Clicca una tua Pedina per muoverla/ripararla, clicca una Carta in mano per giocarla, oppure premi "⚔ ATTACCA QUI" in un settore!`,
      highlight: false,
    };
  };

  const advisor = getTacticalAdvisorPrompt();

  const renderSidePanel = (side: Side) => {
    const reserveUnits = state.formations.filter((f) => f.side === side && f.location === 'RISERVA');
    const destroyedUnits = state.destroyedFormations.filter((f) => f.side === side);
    const planes = state.airZones[side];
    const isSup = airInfo.superiority === side;
    const isMySide = side === state.activeSide;
    const canMoveToReserve = isMySide && movingFormation && validMoveDestinations.includes('RISERVA');

    return (
      <aside className={`side-panel ${side === 'AXIS' ? 'axis-side-panel' : 'ussr-side-panel'}`}>
        {/* Faction HQ Card */}
        <div className={`hq-banner ${side === 'AXIS' ? 'axis-hq' : 'ussr-hq'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FactionEmblem side={side} size={36} />
            <div>
              <div className="hq-title">{side === 'AXIS' ? 'OKW — ASSE' : 'STAVKA — URSS'}</div>
              <div className="hq-subtitle">
                {state.initiative === side ? '★ DETIENE L’INIZIATIVA' : 'In attesa di iniziativa'}
                {state.passed[side] ? ' • HA PASSATO' : ''}
              </div>
            </div>
          </div>

          <div className="hq-Counters">
            <div className="hq-counter-box" title="Ordini rimanenti in questo turno">
              <span className="hq-counter-label">ORDINI</span>
              <span className="hq-counter-val">{state.ordersRemaining[side]}</span>
            </div>
            <div className="hq-counter-box pp-box" title="Punti Produzione (PP) disponibili">
              <span className="hq-counter-label">PRODUZIONE</span>
              <span className="hq-counter-val">{state.pp[side]} PP</span>
            </div>
          </div>
        </div>

        {/* Airfield Box */}
        <div className="panel-section airfield-box">
          <div className="panel-section-title" title={RULE_TOOLTIPS.SUPERIORITA_AEREA}>
            <span>✈ Aerodromo ({planes.length}/3)</span>
            {state.config.modules.air && (
              <span className={`badge ${isSup ? 'sup-badge' : ''}`}>
                Caccia {side === 'AXIS' ? airInfo.axisFighter : airInfo.ussrFighter} | Supp +
                {side === 'AXIS' ? airInfo.axisSupport : airInfo.ussrSupport}
                {isSup ? ' ★ SUP' : ''}
              </span>
            )}
          </div>

          {isMySide && selectedCard?.type === 'AEREO' && (
            <div style={{ marginBottom: '0.45rem' }}>
              {planes.length < 3 ? (
                <button
                  type="button"
                  className="btn btn-sm btn-gold"
                  style={{ width: '100%' }}
                  onClick={() => dispatch({ type: 'EQUIP', cardId: selectedCard.id })}
                >
                  ✈ Schiera {selectedCard.name} ({selectedCard.cost} PP)
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--gold)' }}>
                    Aerodromo pieno: clicca quale aereo sostituire con {selectedCard.name}:
                  </span>
                  {planes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="btn btn-sm btn-gold"
                      onClick={() =>
                        dispatch({
                          type: 'EQUIP',
                          cardId: selectedCard.id,
                          replaceAirCardId: p.id,
                        })
                      }
                    >
                      Sostituisci {p.name} ({selectedCard.cost} PP)
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {planes.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nessuna squadriglia schierata.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {planes.map((a) => (
                <div key={a.id} className="air-card-mini">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>✈</span>
                    <strong>{a.name}</strong>
                  </div>
                  <div className="air-stats-pill">
                    ⚔ Caccia {a.caccia} • 💥 Supp +{a.supporto}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strategic Reserve Box */}
        <div className={`panel-section ${canMoveToReserve ? 'dropzone-active' : ''}`}>
          <div className="panel-section-title">
            <span>⛺ Riserva Strategica</span>
            <span className="badge">{reserveUnits.length} pedine</span>
          </div>

          {canMoveToReserve && movingFormation && (
            <button
              type="button"
              className="btn btn-sm btn-success"
              style={{ width: '100%', marginBottom: '0.5rem', fontWeight: 800 }}
              onClick={() =>
                dispatch({
                  type: 'REDEPLOY',
                  formationId: movingFormation.id,
                  to: 'RISERVA',
                })
              }
            >
              📥 Sposta &ldquo;{movingFormation.name}&rdquo; in Riserva (1 Ordine)
            </button>
          )}

          {reserveUnits.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Nessuna formazione in Riserva.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {reserveUnits.map((f) => {
                const canEquipHere =
                  isMySide &&
                  selectedCard?.type === 'EQUIPAGGIAMENTO_TERRA' &&
                  !f.encircled &&
                  canEquipCardOnFormation(selectedCard, f);

                return (
                  <FormationCard
                    key={f.id}
                    formation={f}
                    viewerSide={humanSide}
                    fogOfWar={state.config.modules.fogOfWar}
                    experienceEnabled={state.config.modules.experience}
                    selected={selectedFormationId === f.id || movingFormationId === f.id}
                    onSelect={(unit) => {
                      if (unit.side === state.activeSide && !isAiTurn) {
                        setSelectedFormationId(selectedFormationId === unit.id ? null : unit.id);
                      }
                    }}
                    canReconvert={f.side === state.activeSide && state.phase === 'ORDERS' && !isAiTurn}
                    onReconvertEquipment={(id) => dispatch({ type: 'RECONVERT_EQUIPMENT', formationId: id })}
                    equipHighlight={
                      !isAiTurn && canEquipHere && selectedCard?.type === 'EQUIPAGGIAMENTO_TERRA'
                        ? {
                            cardName: selectedCard.name,
                            cost: selectedCard.cost,
                            onEquipHere: () =>
                              dispatch({
                                type: 'EQUIP',
                                cardId: selectedCard.id,
                                targetFormationId: f.id,
                              }),
                          }
                        : undefined
                    }
                    quickActions={
                      f.side === state.activeSide && state.phase === 'ORDERS' && !isAiTurn
                        ? {
                            onStartMove: () => {
                              setMovingFormationId(f.id);
                              setSelectedCardId(null);
                            },
                            canQuickRepair1: state.pp[state.activeSide] >= 1,
                            onQuickRepair1: () =>
                              dispatch({
                                type: 'REORGANIZE',
                                formationId: f.id,
                                points: 1,
                              }),
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Destroyed / Caduti Box */}
        <div className="panel-section">
          <div className="panel-section-title">
            <span>💀 Unità Distrutte</span>
            <span className="badge">{destroyedUnits.length}</span>
          </div>
          {destroyedUnits.length === 0 ? (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nessuna unità annientata.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {destroyedUnits.map((d) => {
                const rebuildCost =
                  side === 'USSR' ? state.config.rebuildCost.ussr : state.config.rebuildCost.axis;
                const canRebuildThis =
                  isMySide &&
                  state.phase === 'ORDERS' &&
                  (side === 'USSR' || state.config.axisCanRebuild) &&
                  !d.keywords.includes('FRAGILE') &&
                  state.pp[side] >= rebuildCost;

                return (
                  <div key={d.id} className="destroyed-unit-row">
                    <div>
                      <strong>💀 {d.name}</strong>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>({d.destroyedTurn})</span>
                    </div>
                    {canRebuildThis && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}
                        onClick={() =>
                          dispatch({
                            type: 'REORGANIZE',
                            rebuildDestroyedId: d.id,
                          })
                        }
                        title="Ricostruisci in Riserva con Forza 2 e livello Recluta (1 Ordine)"
                      >
                        ✚ Ricostruisci ({rebuildCost} PP)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    );
  };

  return (
    <div className="app-shell">
      {/* TOP COMMAND HEADER */}
      <header className="top-bar">
        <div className="top-bar-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <WarRoomCompassSvg size={28} />
            <FactionEmblem side="AXIS" size={26} />
            <h1 className="game-logo-title">FRONTE ORIENTALE 1941–45</h1>
            <FactionEmblem side="USSR" size={26} />
          </div>

          {/* Game Mode Switcher: Single Player vs AI or 2-Player Hotseat */}
          <div className="mode-selector-pill" role="group" aria-label="Modalità di Gioco">
            <button
              type="button"
              className={`mode-btn ${gameMode === 'VS_AI_USSR' ? 'active-mode axis-mode' : ''}`}
              onClick={() => {
                setGameMode('VS_AI_USSR');
                setAiPaused(false);
              }}
              title="Gioca come Comandante dell'Asse contro l'IA Sovietica (STAVKA)"
            >
              🦅 Tu: Asse vs 🤖 IA URSS
            </button>
            <button
              type="button"
              className={`mode-btn ${gameMode === 'VS_AI_AXIS' ? 'active-mode ussr-mode' : ''}`}
              onClick={() => {
                setGameMode('VS_AI_AXIS');
                setAiPaused(false);
              }}
              title="Gioca come Comandante dell'Armata Rossa contro l'IA Tedesca (OKW)"
            >
              ⭐ Tu: URSS vs 🤖 IA Asse
            </button>
            <button
              type="button"
              className={`mode-btn ${gameMode === 'HOTSEAT' ? 'active-mode hotseat-mode' : ''}`}
              onClick={() => setGameMode('HOTSEAT')}
              title="2 Giocatori sullo stesso schermo"
            >
              👥 2 Giocatori
            </button>
          </div>

          {/* Visual Turn Track */}
          <div className="turn-track-strip" title="Tracciato dei 9 Turni della Campagna">
            {TURNS.map((t, idx) => {
              const isCurrent = idx === state.turnIndex;
              const isPast = idx < state.turnIndex;
              const isWinter = t.startsWith('I');
              return (
                <span
                  key={t}
                  className={`turn-step-chip ${isCurrent ? 'active-turn' : ''} ${isPast ? 'past-turn' : ''}`}
                >
                  {isWinter ? '❄' : '☀'} {t}
                </span>
              );
            })}
          </div>

          <span className="stat-pill vp-pill" title="Punti Vittoria Asse (Soglia vittoria a fine E45: 12 PV)">
            🏆 PV Asse:{' '}
            <strong className="val" style={{ color: 'var(--gold)' }}>
              {state.axisVp} / {state.config.victory.axisVpToWin}
            </strong>
          </span>
        </div>

        <div className="top-bar-group">
          <button
            type="button"
            className="btn btn-sm btn-gold"
            onClick={() => setRulesOpen(true)}
            title="Apri la guida rapida illustrata alle regole"
          >
            📖 Come si Gioca
          </button>
          {gameMode === 'HOTSEAT' && (
            <button
              type="button"
              className={`btn btn-sm ${hotseatEnabled ? 'btn-primary' : ''}`}
              onClick={() => setHotseatEnabled((v) => !v)}
              title="Attiva/disattiva la schermata intermedia di cambio giocatore"
            >
              {hotseatEnabled ? '👁 Sipario ON' : '👁 Sipario OFF'}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={handleSaveGame}>
            💾 Salva
          </button>
          <button type="button" className="btn btn-sm" onClick={handleLoadGame}>
            📂 Carica
          </button>
          <button type="button" className="btn btn-sm" onClick={() => handleNewGame()}>
            🔄 Nuova
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setSettingsOpen(true)}>
            ⚙ Regole
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setStatsOpen(true)}>
            📊 Statistiche
          </button>
          <button
            type="button"
            className={`btn btn-sm ${logOpen ? 'btn-primary' : ''}`}
            onClick={() => setLogOpen((v) => !v)}
          >
            📜 Log ({state.logs.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${devOpen ? 'btn-primary' : ''}`}
            onClick={() => setDevOpen((v) => !v)}
          >
            🛠 Dev
          </button>
        </div>
      </header>

      {/* COMMANDER'S TACTICAL ADVISOR BAR + AI RADIO DISPATCH */}
      <div className={`tactical-advisor-bar ${advisor.highlight ? 'advisor-active' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span className="advisor-badge">
            {state.activeSide === 'AXIS' ? '🦅 COMANDO OKW (ASSE)' : '⭐ COMANDO STAVKA (URSS)'}
          </span>
          <span className="advisor-text">{advisor.text}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {aiSide !== null && lastAiRadio && (
            <span className={`ai-radio-pill ${isAiTurn ? 'transmitting' : ''}`} title="Ultimo dispaccio radio dell'IA">
              📻 <strong>IA ({aiSide === 'AXIS' ? 'OKW' : 'STAVKA'}):</strong> {lastAiRadio}
            </span>
          )}
          {aiSide !== null && (
            <button
              type="button"
              className={`btn btn-sm ${aiPaused ? 'btn-gold' : ''}`}
              onClick={() => setAiPaused((p) => !p)}
              title="Metti in pausa o riprendi l'esecuzione automatica delle mosse dell'IA"
            >
              {aiPaused ? '▶ Riprendi IA' : '⏸ Pausa IA'}
            </button>
          )}
          {(movingFormationId || selectedCardId || attackConfirmSector || showSpecialDrawer !== 'NONE') && (
            <button type="button" className="btn btn-sm btn-danger" onClick={clearBoardSelection}>
              ✕ Annulla Selezione
            </button>
          )}
          {history.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={handleUndo} title="Annulla ultima mossa">
              ↩ Undo
            </button>
          )}
        </div>
      </div>

      {/* ERROR / TOAST BANNER */}
      {(errorMsg || toastMsg) && (
        <div className={`alert-banner ${errorMsg ? 'alert-error' : 'alert-toast'}`}>
          <span>
            {errorMsg && <strong>⚠ {errorMsg}</strong>}
            {!errorMsg && toastMsg && <strong>✓ {toastMsg}</strong>}
          </span>
          {errorMsg && (
            <button type="button" className="btn btn-sm" onClick={() => setErrorMsg(null)}>
              Chiudi
            </button>
          )}
        </div>
      )}

      {/* E44 MANDATORY EVENT: SBARCO IN NORMANDIA */}
      {state.phase === 'NORMANDY_EVENT' && (
        <div className="normandy-banner">
          <div>
            <strong style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>
              ⚓ EVENTO STORICO E44 — Sbarco in Normandia (D-Day):
            </strong>{' '}
            L&apos;Asse deve trasferire sul Fronte Occidentale (rimuovere dal gioco) 1 formazione CORAZZATA a scelta
            {state.config.normandyAllowPayInstead
              ? ` oppure pagare ${state.config.normandyPayCost} PP.`
              : '.'}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="select"
              value={normandyFormationId}
              onChange={(e) => setNormandyFormationId(e.target.value)}
            >
              <option value="">-- Seleziona CORAZZATA tedesca --</option>
              {state.formations
                .filter((f) => f.side === 'AXIS' && f.type === 'CORAZZATA')
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.location}, F{f.strength}/{f.maxStrength})
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={!normandyFormationId}
              onClick={() =>
                dispatch({
                  type: 'RESOLVE_NORMANDY',
                  choice: 'REMOVE_ARMOR',
                  formationId: normandyFormationId,
                })
              }
            >
              Invia in Normandia
            </button>
            {state.config.normandyAllowPayInstead && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={state.pp.AXIS < state.config.normandyPayCost}
                onClick={() => dispatch({ type: 'RESOLVE_NORMANDY', choice: 'PAY_PP' })}
              >
                Paga {state.config.normandyPayCost} PP
              </button>
            )}
          </div>
        </div>
      )}

      {/* ATTACK CONFIRMATION OVERLAY BAR (when user clicks ⚔ ATTACCA QUI on a sector) */}
      {attackConfirmSector && (
        <div className="attack-confirm-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>
              ⚔ OFFENSIVA NEL SETTORE {attackConfirmSector}:
            </strong>
            {attackEventsInHand.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem' }}>Vuoi aggiungere carte Evento d&apos;Attacco gratuite?</span>
                {attackEventsInHand.map((ev) => (
                  <label key={ev.id} className="checkbox-label" style={{ fontSize: '0.8rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedAttackEvents.includes(ev.id)}
                      onChange={() =>
                        setSelectedAttackEvents((prev) =>
                          prev.includes(ev.id) ? prev.filter((x) => x !== ev.id) : [...prev, ev.id]
                        )
                      }
                    />
                    <span>
                      <strong>{ev.name}</strong> ({ev.effectText})
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tutte le tue unità non esauste nel settore {attackConfirmSector} parteciperanno all&apos;attacco (1
                Ordine).
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() =>
                dispatch({
                  type: 'ATTACK',
                  sector: attackConfirmSector,
                  eventCardIds: selectedAttackEvents,
                })
              }
            >
              🔥 Lancia Attacco in {attackConfirmSector}!
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setAttackConfirmSector(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* MAIN 3-COLUMN BOARD GAME TABLE */}
      <main className="main-board">
        {renderSidePanel('AXIS')}

        {/* CENTER WAR MAP: 3 SECTORS */}
        <section className="sectors-container" aria-label="Tabellone del Fronte Orientale">
          {SECTORS.map((secId) => {
            const secState = state.sectors[secId];
            const cells = MAP_DATA[secId].cells;
            const axisUnits = state.formations.filter((f) => f.side === 'AXIS' && f.location === secId);
            const ussrUnits = state.formations.filter((f) => f.side === 'USSR' && f.location === secId);

            // Eligible attackers in this sector for active player
            const eligibleAttackers = state.formations.filter(
              (f) => f.side === state.activeSide && f.location === secId && !f.exhausted && !f.encircled
            );
            const canAttackHere =
              !isAiTurn &&
              state.phase === 'ORDERS' &&
              eligibleAttackers.length > 0 &&
              ((state.activeSide === 'AXIS' && secState.marker < 6) ||
                (state.activeSide === 'USSR' && secState.marker > 0));

            const canRetreatHere =
              !isAiTurn &&
              state.phase === 'ORDERS' &&
              !secState.retreatedSidesThisTurn.includes(state.activeSide) &&
              ((state.activeSide === 'AXIS' && secState.marker > 0 && axisUnits.length > 0) ||
                (state.activeSide === 'USSR' && secState.marker < 6 && ussrUnits.length > 0));

            const canMoveToThisSector =
              !isAiTurn && state.phase === 'ORDERS' && movingFormation && validMoveDestinations.includes(secId);

            const canAssignCommanderHere =
              !isAiTurn && state.phase === 'ORDERS' && selectedCard?.type === 'COMANDANTE';

            const canPlayAirliftHere =
              !isAiTurn &&
              state.phase === 'ORDERS' &&
              selectedCard?.type === 'EVENTO' &&
              selectedCard.templateId === 'axis_ponte_aereo_42';

            // Sum preview of Attack vs Defense in sector
            const axisAtkSum = axisUnits
              .filter((u) => !u.exhausted && !u.encircled)
              .reduce((s, u) => s + getFormationBaseAttack(u, state.config.modules.experience), 0);
            const axisDefSum = axisUnits.reduce(
              (s, u) => s + getFormationBaseDefense(u, state.config.modules.experience),
              0
            );
            const ussrAtkSum = ussrUnits
              .filter((u) => !u.exhausted && !u.encircled)
              .reduce((s, u) => s + getFormationBaseAttack(u, state.config.modules.experience), 0);
            const ussrDefSum = ussrUnits.reduce(
              (s, u) => s + getFormationBaseDefense(u, state.config.modules.experience),
              0
            );

            return (
              <article
                key={secId}
                className={`sector-row ${canMoveToThisSector ? 'dropzone-active' : ''}`}
              >
                {/* ILLUSTRATED WAR ROOM BATTLEFIELD DIORAMA BANNER */}
                <SectorBattlefieldBanner
                  sector={secId}
                  season={season}
                  marker={secState.marker}
                  currentCellName={cells[secState.marker].name}
                />

                {/* SECTOR HEADER WITH DIRECT BOARD GAME ACTIONS */}
                <div className="sector-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <h2 className="sector-title">🧭 COMANDO DI SETTORE: {secId}</h2>
                    <span className="front-pill">
                      ⚔ Fronte su Casella <strong>{secState.marker}</strong>:{' '}
                      <strong style={{ color: 'var(--gold)' }}>{cells[secState.marker].name}</strong>
                    </span>

                    {secState.retreatedSidesThisTurn.length > 0 && (
                      <span className="badge" style={{ borderColor: '#38bdf8', color: '#38bdf8' }}>
                        🛡 Linea accorciata (+1 DIF {secState.retreatedSidesThisTurn.join(', ')})
                      </span>
                    )}
                    {secState.airliftProtectedThisTurn && (
                      <span className="badge" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                        ✈ Ponte Aereo attivo
                      </span>
                    )}
                  </div>

                  {/* Direct Board Actions on this Sector */}
                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {canMoveToThisSector && movingFormation && (
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        style={{ fontWeight: 800 }}
                        onClick={() =>
                          dispatch({
                            type: 'REDEPLOY',
                            formationId: movingFormation.id,
                            to: secId,
                          })
                        }
                      >
                        📥 Sposta &ldquo;{movingFormation.name}&rdquo; in {secId} (1 Ord.)
                      </button>
                    )}

                    {canAssignCommanderHere && selectedCard && (
                      <button
                        type="button"
                        className="btn btn-sm btn-gold"
                        onClick={() =>
                          dispatch({
                            type: 'EQUIP',
                            cardId: selectedCard.id,
                            targetSector: secId,
                          })
                        }
                      >
                        🎖 Assegna {selectedCard.name} a {secId} ({selectedCard.cost} PP)
                      </button>
                    )}

                    {canPlayAirliftHere && selectedCard && (
                      <button
                        type="button"
                        className="btn btn-sm btn-gold"
                        onClick={() =>
                          dispatch({
                            type: 'PLAY_EVENT',
                            cardId: selectedCard.id,
                            targetSector: secId,
                          })
                        }
                      >
                        ✈ Attiva Ponte Aereo in {secId} (2 PP)
                      </button>
                    )}

                    {canAttackHere && (
                      <button
                        type="button"
                        className="btn btn-sm btn-attack-sector"
                        onClick={() => {
                          if (attackEventsInHand.length > 0) {
                            setAttackConfirmSector(secId);
                          } else {
                            dispatch({ type: 'ATTACK', sector: secId, eventCardIds: [] });
                          }
                        }}
                        title="Dichiara un'offensiva in questo settore con tutte le unità pronte (1 Ordine)"
                      >
                        ⚔ ATTACCA QUI (Base{' '}
                        {state.activeSide === 'AXIS'
                          ? `${axisAtkSum} vs ${ussrDefSum}`
                          : `${ussrAtkSum} vs ${axisDefSum}`}
                        )
                      </button>
                    )}

                    {canRetreatHere && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => dispatch({ type: 'RETREAT', sector: secId })}
                        title="Ripiega di 1 casella verso il tuo lato per guadagnare +1 Difesa in questo settore fino a fine turno (1 Ordine)"
                      >
                        ↩ Ritirata (+1 DIF)
                      </button>
                    )}
                  </div>
                </div>

                {/* ILLUSTRATED 0..6 MAP TRACK */}
                <div className="track-grid">
                  {cells.map((cell) => {
                    const isAxisControlled = cell.index <= secState.marker;
                    const isFront = cell.index === secState.marker;
                    return (
                      <div
                        key={cell.index}
                        className={`track-cell ${isAxisControlled ? 'axis-controlled' : 'ussr-controlled'} ${
                          isFront ? 'front-marker' : ''
                        } ${cell.isObjectiveCity ? 'objective' : ''}`}
                      >
                        <div className="cell-index">
                          <span>Casella {cell.index}</span>
                          <span className="cell-owner-tag">{isAxisControlled ? 'ASSE' : 'URSS'}</span>
                        </div>
                        <div className="cell-landmark-row">
                          <CityLandmarkIcon
                            isBerlin={cell.isBerlin}
                            isObjective={cell.isObjectiveCity}
                            isOil={cell.isOil}
                          />
                          <div className="cell-name">{cell.name}</div>
                        </div>
                        {isFront && (
                          <div className="front-badge" title="Linea del Fronte attuale">
                            ⚔ LINEA DEL FRONTE
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* FORMATIONS DEPLOYED IN THIS SECTOR */}
                <div className="sector-formations">
                  {/* AXIS LANE */}
                  <div className="formation-lane axis-lane">
                    <div className="lane-label">
                      <span style={{ color: '#93c5fd', fontWeight: 800 }}>
                        🦅 Fronte Asse (ATT {axisAtkSum} / DIF {axisDefSum})
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {secState.axisCommander && (
                          <span
                            className="commander-chip axis-cmd"
                            title={secState.axisCommander.effectText}
                          >
                            🎖 {secState.axisCommander.name}
                          </span>
                        )}
                        {state.config.modules.supply && secState.marker > state.config.supply.axisFreeUntil && (
                          <span title={RULE_TOOLTIPS.RIFORNIMENTO} className="supply-warning">
                            ⚠ Logistica −{secState.marker - state.config.supply.axisFreeUntil} ATT
                          </span>
                        )}
                      </div>
                    </div>

                    {axisUnits.length === 0 ? (
                      <div className="empty-lane-msg">⚠️ Settore sguarnito! Nessuna divisione Asse schierata.</div>
                    ) : (
                      <div className="formations-list">
                        {axisUnits.map((f) => {
                          const canEquipHere =
                            state.activeSide === 'AXIS' &&
                            selectedCard?.type === 'EQUIPAGGIAMENTO_TERRA' &&
                            !f.encircled &&
                            canEquipCardOnFormation(selectedCard, f);

                          return (
                            <FormationCard
                              key={f.id}
                              formation={f}
                              viewerSide={humanSide}
                              fogOfWar={state.config.modules.fogOfWar}
                              experienceEnabled={state.config.modules.experience}
                              selected={selectedFormationId === f.id || movingFormationId === f.id}
                              onSelect={(unit) => {
                                if (unit.side === state.activeSide && !isAiTurn) {
                                  setSelectedFormationId(selectedFormationId === unit.id ? null : unit.id);
                                }
                              }}
                              canReconvert={f.side === state.activeSide && state.phase === 'ORDERS' && !isAiTurn}
                              onReconvertEquipment={(id) =>
                                dispatch({ type: 'RECONVERT_EQUIPMENT', formationId: id })
                              }
                              equipHighlight={
                                !isAiTurn && canEquipHere && selectedCard?.type === 'EQUIPAGGIAMENTO_TERRA'
                                  ? {
                                      cardName: selectedCard.name,
                                      cost: selectedCard.cost,
                                      onEquipHere: () =>
                                        dispatch({
                                          type: 'EQUIP',
                                          cardId: selectedCard.id,
                                          targetFormationId: f.id,
                                        }),
                                    }
                                  : undefined
                              }
                              quickActions={
                                f.side === state.activeSide && state.phase === 'ORDERS' && !isAiTurn
                                  ? {
                                      onStartMove: () => {
                                        setMovingFormationId(f.id);
                                        setSelectedCardId(null);
                                      },
                                      canQuickRepair1: state.pp.AXIS >= 1,
                                      onQuickRepair1: () =>
                                        dispatch({
                                          type: 'REORGANIZE',
                                          formationId: f.id,
                                          points: 1,
                                        }),
                                    }
                                  : undefined
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* USSR LANE */}
                  <div className="formation-lane ussr-lane">
                    <div className="lane-label">
                      <span style={{ color: '#fca5a5', fontWeight: 800 }}>
                        ⭐ Fronte URSS (ATT {ussrAtkSum} / DIF {ussrDefSum})
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {secState.ussrCommander && (
                          <span
                            className="commander-chip ussr-cmd"
                            title={secState.ussrCommander.effectText}
                          >
                            🎖 {secState.ussrCommander.name}
                          </span>
                        )}
                        {state.config.modules.supply &&
                          (state.config.supply.ussrPenalty[secState.marker] ?? 0) > 0 && (
                            <span title={RULE_TOOLTIPS.RIFORNIMENTO} className="supply-warning">
                              ⚠ Logistica −{state.config.supply.ussrPenalty[secState.marker]} ATT
                            </span>
                          )}
                      </div>
                    </div>

                    {ussrUnits.length === 0 ? (
                      <div className="empty-lane-msg">⚠️ Settore sguarnito! Nessuna armata URSS schierata.</div>
                    ) : (
                      <div className="formations-list">
                        {ussrUnits.map((f) => {
                          const canEquipHere =
                            state.activeSide === 'USSR' &&
                            selectedCard?.type === 'EQUIPAGGIAMENTO_TERRA' &&
                            !f.encircled &&
                            canEquipCardOnFormation(selectedCard, f);

                          return (
                            <FormationCard
                              key={f.id}
                              formation={f}
                              viewerSide={humanSide}
                              fogOfWar={state.config.modules.fogOfWar}
                              experienceEnabled={state.config.modules.experience}
                              selected={selectedFormationId === f.id || movingFormationId === f.id}
                              onSelect={(unit) => {
                                if (unit.side === state.activeSide && !isAiTurn) {
                                  setSelectedFormationId(selectedFormationId === unit.id ? null : unit.id);
                                }
                              }}
                              canReconvert={f.side === state.activeSide && state.phase === 'ORDERS' && !isAiTurn}
                              onReconvertEquipment={(id) =>
                                dispatch({ type: 'RECONVERT_EQUIPMENT', formationId: id })
                              }
                              equipHighlight={
                                !isAiTurn && canEquipHere && selectedCard?.type === 'EQUIPAGGIAMENTO_TERRA'
                                  ? {
                                      cardName: selectedCard.name,
                                      cost: selectedCard.cost,
                                      onEquipHere: () =>
                                        dispatch({
                                          type: 'EQUIP',
                                          cardId: selectedCard.id,
                                          targetFormationId: f.id,
                                        }),
                                    }
                                  : undefined
                              }
                              quickActions={
                                f.side === state.activeSide && state.phase === 'ORDERS' && !isAiTurn
                                  ? {
                                      onStartMove: () => {
                                        setMovingFormationId(f.id);
                                        setSelectedCardId(null);
                                      },
                                      canQuickRepair1: state.pp.USSR >= 1,
                                      onQuickRepair1: () =>
                                        dispatch({
                                          type: 'REORGANIZE',
                                          formationId: f.id,
                                          points: 1,
                                        }),
                                    }
                                  : undefined
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {renderSidePanel('USSR')}
      </main>

      {/* BOTTOM TRAY: PHYSICAL PLAYING CARDS IN HAND & COMMAND DECK */}
      <footer className="bottom-bar">
        <div className="hand-area">
          {displayedHand.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center', paddingLeft: '1rem' }}>
              La mano di carte di {displayedHandSide === 'AXIS' ? 'Asse' : 'URSS'} è vuota.
            </div>
          ) : (
            displayedHand.map((card) => {
              const reconvertRefund = Math.max(1, Math.ceil(card.cost / 2));
              const isSelected = selectedCardId === card.id;
              const isImmediateOrderEvent =
                card.type === 'EVENTO' &&
                card.timing === 'ORDINE' &&
                card.templateId !== 'axis_ponte_aereo_42' &&
                !card.templateId.startsWith('axis_rimpiazzi');

              return (
                <div
                  key={card.id}
                  className={`hand-card card-type-${card.type.toLowerCase()} ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (!canPlayFromDisplayedHand) return;
                    setMovingFormationId(null);
                    setSelectedCardId(isSelected ? null : card.id);
                    if (card.type === 'EVENTO' && card.templateId.startsWith('axis_rimpiazzi')) {
                      setShowSpecialDrawer('RIMPIAZZI');
                    }
                  }}
                >
                  {/* Card Top Ribbon */}
                  <div className="hand-card-header">
                    <span className="hand-card-title">{card.name}</span>
                    <span className="hand-card-cost" title="Costo in Punti Produzione (PP)">
                      {card.cost} PP
                    </span>
                  </div>

                  {/* Illustrated WWII Card Art Frame */}
                  <CardIllustrationFrame card={card} />

                  {/* Card Effect Body */}
                  <div className="hand-card-desc">
                    {card.type === 'EQUIPAGGIAMENTO_TERRA' && (
                      <>
                        <div className="card-stat-pills">
                          <span className="mini-stat atk">⚔ +{card.atk} ATT</span>
                          <span className="mini-stat def">🛡 +{card.def} DIF</span>
                        </div>
                        <div style={{ marginTop: '0.2rem', fontSize: '0.68rem' }}>
                          Richiede: <strong>{KEYWORD_TOOLTIPS[card.requires] ?? card.requires}</strong>
                        </div>
                        {card.keywords.length > 0 && (
                          <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.2rem' }}>
                            {card.keywords.map((k) => (
                              <span key={k} className="keyword-tag" title={KEYWORD_TOOLTIPS[k]}>
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {card.type === 'AEREO' && (
                      <div className="card-stat-pills">
                        <span className="mini-stat atk">✈ Caccia {card.caccia}</span>
                        <span className="mini-stat def">💥 Supp +{card.supporto}</span>
                      </div>
                    )}
                    {card.type === 'COMANDANTE' && <>{card.effectText}</>}
                    {card.type === 'EVENTO' && <>{card.effectText}</>}
                  </div>

                  {/* Card Action Buttons */}
                  <div className="hand-card-footer" onClick={(e) => e.stopPropagation()}>
                    {isImmediateOrderEvent && (
                      <button
                        type="button"
                        className="btn btn-sm btn-gold"
                        disabled={!canPlayFromDisplayedHand}
                        onClick={() => dispatch({ type: 'PLAY_EVENT', cardId: card.id })}
                      >
                        ⚡ Gioca Ora
                      </button>
                    )}

                    {card.type === 'AEREO' && state.airZones[displayedHandSide].length < 3 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={!canPlayFromDisplayedHand || state.pp[displayedHandSide] < card.cost}
                        onClick={() => dispatch({ type: 'EQUIP', cardId: card.id })}
                      >
                        ✈ Schiera ({card.cost} PP)
                      </button>
                    )}

                    {(card.type === 'EQUIPAGGIAMENTO_TERRA' || card.type === 'COMANDANTE') && (
                      <button
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-gold' : 'btn-primary'}`}
                        disabled={!canPlayFromDisplayedHand}
                        onClick={() => setSelectedCardId(isSelected ? null : card.id)}
                      >
                        {isSelected ? '👆 Clicca bersaglio' : '🎯 Usa sulla Mappa'}
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ fontSize: '0.64rem', padding: '0.15rem 0.35rem' }}
                      disabled={!canPlayFromDisplayedHand}
                      onClick={() => dispatch({ type: 'RECONVERT_CARD', cardId: card.id })}
                      title="Azione gratuita: scarta questa carta per ottenere PP immediati"
                    >
                      ♻ +{reconvertRefund} PP
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right HQ Action Box: Special Actions & Pass Turn */}
        <div className="actions-toolbar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.8rem', color: 'var(--gold)' }}>
              ⚙️ ORDINI SPECIALI & FINE TURNO
            </strong>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              disabled={!canPlayFromDisplayedHand}
              onClick={() => dispatch({ type: 'PASS' })}
              title="Termina le tue operazioni per questa stagione e passa agli ordini avversari o a fine turno"
            >
              ⏭ Passa il Turno
            </button>
          </div>

          <div className="action-buttons-grid">
            <button
              type="button"
              className={`btn btn-sm ${showSpecialDrawer === 'REORGANIZE' ? 'btn-primary' : ''}`}
              disabled={!canPlayFromDisplayedHand}
              onClick={() =>
                setShowSpecialDrawer(showSpecialDrawer === 'REORGANIZE' ? 'NONE' : 'REORGANIZE')
              }
            >
              ✚ Riorganizza (+1/+2/+3 F)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${showSpecialDrawer === 'PROTOTYPE' ? 'btn-primary' : ''}`}
              disabled={!canPlayFromDisplayedHand}
              onClick={() =>
                setShowSpecialDrawer(showSpecialDrawer === 'PROTOTYPE' ? 'NONE' : 'PROTOTYPE')
              }
            >
              🧪 Sviluppa Prototipo ({state.config.prototypeCost} PP)
            </button>
          </div>

          {showSpecialDrawer === 'REORGANIZE' && (
            <div className="action-subpanel">
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Ripristina Forza a un&apos;unità (se ripari 2+ punti in un solo ordine, scende di 1 livello XP):
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="select"
                  value={selectedFormationId ?? ''}
                  onChange={(e) => setSelectedFormationId(e.target.value || null)}
                >
                  <option value="">-- Scegli Unità danneggiata --</option>
                  {myFormations
                    .filter((f) => !f.encircled && f.strength < f.maxStrength)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} (F{f.strength}/{f.maxStrength}, {f.level})
                      </option>
                    ))}
                </select>
                <select
                  className="select"
                  value={reorgPoints}
                  onChange={(e) => setReorgPoints(Number(e.target.value))}
                >
                  <option value={1}>+1 Forza (1 PP)</option>
                  <option value={2}>+2 Forza (2 PP, −1 liv. XP)</option>
                  <option value={3}>+3 Forza (3 PP, −1 liv. XP)</option>
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-gold"
                  disabled={!selectedFormationId}
                  onClick={() => {
                    if (selectedFormationId) {
                      dispatch({
                        type: 'REORGANIZE',
                        formationId: selectedFormationId,
                        points: reorgPoints,
                      });
                    }
                  }}
                >
                  Ripara Ora
                </button>
              </div>
            </div>
          )}

          {showSpecialDrawer === 'PROTOTYPE' && (
            <div className="action-subpanel">
              {prototypeCards.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Nessun prototipo disponibile per l&apos;anno {nextYear}.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="select"
                    value={selectedCardId ?? ''}
                    onChange={(e) => setSelectedCardId(e.target.value || null)}
                  >
                    <option value="">-- Scegli dal mazzo {nextYear} --</option>
                    {prototypeCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type}, Costo {c.cost} PP)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-gold"
                    disabled={!selectedCardId}
                    onClick={() => {
                      if (selectedCardId) {
                        dispatch({ type: 'PROTOTYPE', chosenCardId: selectedCardId });
                      }
                    }}
                  >
                    Prendi in Mano ({state.config.prototypeCost} PP)
                  </button>
                </div>
              )}
            </div>
          )}

          {showSpecialDrawer === 'RIMPIAZZI' && selectedCard && (
            <div className="action-subpanel">
              <div style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>
                Carta Rimpiazzi: distribuisci fino a 3 punti Forza gratuiti senza perdita di esperienza:
              </div>
              {myFormations
                .filter((f) => !f.encircled && f.strength < f.maxStrength)
                .map((f) => {
                  const cur = rimpiazziAlloc[f.id] ?? 0;
                  const totalAllocated = Object.values(rimpiazziAlloc).reduce((a, b) => a + b, 0);
                  return (
                    <div
                      key={f.id}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}
                    >
                      <span>
                        {f.name} (F{f.strength}/{f.maxStrength})
                      </span>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            setRimpiazziAlloc((p) => ({ ...p, [f.id]: Math.max(0, cur - 1) }))
                          }
                        >
                          −
                        </button>
                        <strong>+{cur}</strong>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={totalAllocated >= 3 || f.strength + cur >= f.maxStrength}
                          onClick={() => setRimpiazziAlloc((p) => ({ ...p, [f.id]: cur + 1 }))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              <button
                type="button"
                className="btn btn-sm btn-gold"
                onClick={() =>
                  dispatch({
                    type: 'PLAY_EVENT',
                    cardId: selectedCard.id,
                    allocations: Object.entries(rimpiazziAlloc).map(([formationId, points]) => ({
                      formationId,
                      points,
                    })),
                  })
                }
              >
                Conferma Rimpiazzi
              </button>
            </div>
          )}

          {selectedFormation && showSpecialDrawer === 'NONE' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Unità selezionata: <strong style={{ color: 'var(--text-main)' }}>{selectedFormation.name}</strong> (
              {selectedFormation.location}) — usa i pulsanti sulla pedina per muoverla o ripararla.
            </div>
          )}
        </div>
      </footer>

      {/* COLLAPSIBLE LOG DRAWER */}
      {logOpen && (
        <aside className="log-drawer" aria-label="Registro dettagliato degli eventi e combattimenti">
          <div className="log-header">
            <strong>📜 Diario di Guerra ({state.logs.length} eventi)</strong>
            <button type="button" className="btn btn-sm" onClick={() => setLogOpen(false)}>
              ✕ Chiudi
            </button>
          </div>
          <div className="log-list">
            {[...state.logs].reverse().map((entry) => (
              <div
                key={entry.id}
                className={`log-item ${entry.type === 'COMBAT' ? 'combat' : ''} ${
                  entry.type === 'VICTORY' ? 'victory' : ''
                }`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                  <span className="badge" style={{ fontFamily: 'var(--font-mono)' }}>
                    {entry.turn} • {entry.type}
                  </span>
                  {entry.breakdown && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}
                      onClick={() => setInspectedBreakdown(entry.breakdown!)}
                    >
                      🔍 Tabella Modificatori
                    </button>
                  )}
                </div>
                <div>{entry.message}</div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* DEVELOPER MODE PANEL */}
      {devOpen && (
        <DevToolsPanel
          state={state}
          canUndo={history.length > 0}
          onUndo={handleUndo}
          onReplaceState={(newState) => {
            setHistory((prev) => [...prev, state]);
            setState(newState);
          }}
          onResetWithSeed={(seed) => {
            const nextCfg = { ...state.config, seed };
            handleNewGame(nextCfg);
          }}
        />
      )}

      {/* HOTSEAT CURTAIN */}
      {curtainSide && (
        <div className="hotseat-curtain">
          <FactionEmblem side={curtainSide} size={64} />
          <h2>Cambio Comandante (Modalità Hotseat)</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '460px' }}>
            Passa il controllo al giocatore{' '}
            <strong style={{ color: curtainSide === 'AXIS' ? '#93c5fd' : '#fca5a5' }}>
              {curtainSide === 'AXIS' ? 'ASSE (Germania)' : 'URSS (Armata Rossa)'}
            </strong>
            .
          </p>
          <button type="button" className="btn btn-gold" onClick={() => setCurtainSide(null)}>
            Tocca a {curtainSide === 'AXIS' ? 'ASSE' : 'URSS'} — Clicca per aprire il tavolo
          </button>
        </div>
      )}

      {/* MODALS */}
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <BattleModal
        state={state}
        onAction={dispatch}
        lastResolvedCombat={inspectedBreakdown}
        onDismissResolvedCombat={() => setInspectedBreakdown(null)}
      />

      <StatsModal state={state} open={statsOpen} onClose={() => setStatsOpen(false)} />

      <SettingsModal
        currentConfig={state.config}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApplyAndRestart={(newCfg: GameConfig) => handleNewGame(newCfg)}
        onUpdateLiveConfig={(newCfg: GameConfig) =>
          setState((prev) => ({
            ...prev,
            config: newCfg,
          }))
        }
      />
    </div>
  );
};
