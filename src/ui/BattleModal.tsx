import React, { useEffect, useRef, useState } from 'react';
import { getEligibleReactingFormations, getMaxReactionsForDefender } from '../engine/engine';
import { CombatBreakdown, EventCard, GameAction, GameState } from '../engine/types';
import { DiceFaceSvg, FactionEmblem } from './WargameArtwork';

interface BattleModalProps {
  state: GameState;
  lastResolvedCombat: CombatBreakdown | null;
  onDismissResolvedCombat: () => void;
  onAction: (action: GameAction) => void;
}

export const BattleModal: React.FC<BattleModalProps> = ({
  state,
  lastResolvedCombat,
  onDismissResolvedCombat,
  onAction,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pc = state.pendingCombat;
  const isOpen = Boolean(pc || lastResolvedCombat);

  const [selectedReactions, setSelectedReactions] = useState<string[]>([]);
  const [selectedDefEvents, setSelectedDefEvents] = useState<string[]>([]);
  const [rollingDice, setRollingDice] = useState(false);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (isOpen && !dlg.open) {
      dlg.showModal();
    } else if (!isOpen && dlg.open) {
      dlg.close();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedReactions([]);
    setSelectedDefEvents([]);
  }, [pc?.phase, pc?.sector]);

  const breakdown = pc?.breakdown ?? lastResolvedCombat;

  useEffect(() => {
    if (breakdown?.diceRoll !== null && breakdown?.diceRoll !== undefined) {
      setRollingDice(true);
      const t = setTimeout(() => setRollingDice(false), 380);
      return () => clearTimeout(t);
    }
  }, [breakdown]);

  if (!isOpen) return null;

  const renderBreakdownTable = (bd: CombatBreakdown) => (
    <div style={{ marginBlock: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <h4 style={{ margin: '0 0 0.35rem 0', color: 'var(--gold)' }}>
            ⚔️ Modificatori Attacco ({bd.attacker})
          </h4>
          <table className="combat-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th style={{ width: '55px', textAlign: 'right' }}>Valore</th>
              </tr>
            </thead>
            <tbody>
              {bd.attackModifiers.map((m, idx) => (
                <tr key={idx}>
                  <td>{m.source}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {m.value >= 0 ? `+${m.value}` : m.value}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(255,255,255,0.06)', fontWeight: 700 }}>
                <td>TOTALE ATTACCO</td>
                <td style={{ textAlign: 'right' }}>{bd.totalAttack}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h4 style={{ margin: '0 0 0.35rem 0', color: 'var(--info)' }}>
            🛡️ Modificatori Difesa ({bd.defender})
          </h4>
          <table className="combat-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th style={{ width: '55px', textAlign: 'right' }}>Valore</th>
              </tr>
            </thead>
            <tbody>
              {bd.defenseModifiers.map((m, idx) => (
                <tr key={idx}>
                  <td>{m.source}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {m.value >= 0 ? `+${m.value}` : m.value}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(255,255,255,0.06)', fontWeight: 700 }}>
                <td>TOTALE DIFESA</td>
                <td style={{ textAlign: 'right' }}>{bd.totalDefense}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Dice & Outcome Box */}
      <div
        style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-panel-elevated)',
          border: '1px solid var(--border-strong)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {bd.diceRoll !== null ? (
            <div
              style={{
                padding: '0.4rem 0.7rem',
                borderRadius: '8px',
                background: '#111822',
                border: '1px solid var(--gold)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                transform: rollingDice ? 'rotate(12deg) scale(1.1)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            >
              <DiceFaceSvg value={bd.diceRoll} size={42} />
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TIRO 1D6</div>
                <div>
                  Modificatore:{' '}
                  <strong style={{ color: 'var(--gold)', fontSize: '1rem' }}>
                    {bd.diceModifier >= 0 ? `+${bd.diceModifier}` : bd.diceModifier}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <span className="badge">Dado disattivato</span>
          )}
          <div>
            <div>
              DIFF senza dado: <strong>{bd.diffWithoutDice}</strong> ({bd.outcomeWithoutDice})
            </div>
            <div style={{ fontSize: '1.05rem' }}>
              DIFF Finale: <strong>{bd.finalDiff}</strong> →{' '}
              <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{bd.outcome}</span>
              {bd.diceChangedOutcome && (
                <span className="badge danger" style={{ marginLeft: '6px' }}>
                  Il dado ha cambiato l’esito!
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
          <div>Avanzata fronte: +{bd.markerShift} caselle</div>
          <div>
            Perdite Attaccante ({bd.attacker}): <strong>{bd.attackerLosses}</strong> | Perdite Difensore (
            {bd.defender}): <strong>{bd.defenderLosses}</strong>
          </div>
          {bd.initiativePassedTo && (
            <div style={{ color: 'var(--gold)', fontWeight: 700 }}>
              ⚡ L’iniziativa passa a {bd.initiativePassedTo}!
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <dialog ref={dialogRef} aria-labelledby="battle-modal-title">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <FactionEmblem side={pc?.attacker ?? lastResolvedCombat?.attacker ?? 'AXIS'} size={28} />
        <h2 id="battle-modal-title" style={{ margin: 0 }}>
          ⚔️ Battaglia nel Settore {pc?.sector ?? lastResolvedCombat?.sector}
        </h2>
        <FactionEmblem side={pc?.defender ?? lastResolvedCombat?.defender ?? 'USSR'} size={28} />
      </div>

      {/* Step 2: Defender Reaction */}
      {pc && pc.phase === 'REACTION' && (
        <div>
          <p style={{ margin: '0.3rem 0' }}>
            <strong>{pc.attacker}</strong> attacca in <strong>{pc.sector}</strong>! Tocca al difensore (
            <strong>{pc.defender}</strong>) scegliere eventuali reazioni dalla Riserva e carte evento di
            DIFESA.
          </p>

          {pc.maskirovkaPlayed ? (
            <div className="stat-pill danger" style={{ marginBlock: '0.5rem' }}>
              🚫 <strong>Maskirovka attiva</strong>: il difensore non può far reagire formazioni dalla Riserva!
            </div>
          ) : (
            <div style={{ marginBlock: '0.6rem' }}>
              <h4 style={{ margin: '0 0 0.35rem 0' }}>
                Formazioni mobili in Riserva idonee a reagire (max{' '}
                {getMaxReactionsForDefender(state, pc.defender)}):
              </h4>
              {getEligibleReactingFormations(state, pc.defender).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Nessuna formazione CORAZZATA/MOTORIZZATA (senza equip. PESANTE) disponibile in Riserva.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {getEligibleReactingFormations(state, pc.defender).map((f) => {
                    const checked = selectedReactions.includes(f.id);
                    const maxR = getMaxReactionsForDefender(state, pc.defender);
                    return (
                      <label
                        key={f.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.35rem 0.6rem',
                          background: checked ? 'var(--bg-panel-elevated)' : 'transparent',
                          border: '1px solid var(--border-strong)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setSelectedReactions(selectedReactions.filter((id) => id !== f.id));
                            } else if (selectedReactions.length < maxR) {
                              setSelectedReactions([...selectedReactions, f.id]);
                            }
                          }}
                        />
                        <span>
                          <strong>{f.name}</strong> ({f.type}, F{f.strength}, {f.level})
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Defense events in hand */}
          <div style={{ marginBlock: '0.6rem' }}>
            <h4 style={{ margin: '0 0 0.35rem 0' }}>Carte Evento di DIFESA in mano ({pc.defender}):</h4>
            {state.hands[pc.defender].filter((c) => c.type === 'EVENTO' && c.timing === 'DIFESA')
              .length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nessuna carta evento di DIFESA in mano.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {(
                  state.hands[pc.defender].filter(
                    (c) => c.type === 'EVENTO' && c.timing === 'DIFESA'
                  ) as EventCard[]
                ).map((ev) => {
                  const checked = selectedDefEvents.includes(ev.id);
                  return (
                    <label
                      key={ev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.35rem 0.6rem',
                        border: '1px solid var(--gold)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            setSelectedDefEvents(selectedDefEvents.filter((id) => id !== ev.id));
                          } else {
                            setSelectedDefEvents([...selectedDefEvents, ev.id]);
                          }
                        }}
                      />
                      <span>
                        <strong>{ev.name}</strong> — {ev.effectText}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              style={{ borderColor: 'var(--gold)', fontWeight: 700 }}
              onClick={() =>
                onAction({
                  type: 'DEFENSE_REACTION',
                  reactingFormationIds: selectedReactions,
                  eventCardIds: selectedDefEvents,
                })
              }
            >
              Conferma Reazione e Calcola Combattimento →
            </button>
          </div>
        </div>
      )}

      {/* Breakdown display when calculated */}
      {breakdown && renderBreakdownTable(breakdown)}

      {/* Step 6: Loss Assignment */}
      {pc && (pc.phase === 'ATTACKER_LOSSES' || pc.phase === 'DEFENDER_LOSSES') && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            border: '1px solid var(--danger)',
            borderRadius: '6px',
          }}
        >
          <h4 style={{ margin: '0 0 0.4rem 0', color: '#ff948d' }}>
            💥 Assegnazione Perdite — Tocca a{' '}
            {pc.phase === 'ATTACKER_LOSSES' ? pc.attacker : pc.defender} (Perdite rimaste da assegnare:{' '}
            <strong>
              {pc.phase === 'ATTACKER_LOSSES'
                ? pc.remainingAttackerLosses
                : pc.remainingDefenderLosses}
            </strong>
            )
          </h4>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Clicca su una formazione nel settore {pc.sector} per assegnare 1 punto di perdita:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {state.formations
              .filter((f) => {
                if (f.location !== pc.sector) return false;
                if (pc.phase === 'ATTACKER_LOSSES') {
                  return f.side === pc.attacker && pc.attackerIds.includes(f.id);
                }
                return f.side === pc.defender;
              })
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    onAction({
                      type: 'ASSIGN_LOSSES',
                      side: f.side,
                      formationId: f.id,
                      amount: 1,
                    })
                  }
                >
                  −1 Forza a <strong>{f.name}</strong> (F{f.strength}/{f.maxStrength})
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Step 7: Encirclement Decision (Ritirata vs Resistere) */}
      {pc && pc.phase === 'ENCIRCLEMENT_CHOICE' && pc.threatenedSectors.length > 0 && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            border: '2px solid var(--gold)',
            borderRadius: '6px',
          }}
        >
          <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--gold)' }}>
            ⚠️ Minaccia di Accerchiamento nel Settore {pc.threatenedSectors[0]} ({pc.defender})
          </h4>
          <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem' }}>
            Lo sfondamento in <strong>{pc.sector}</strong> ha creato un divario di fronte ≥ 2 rispetto a{' '}
            <strong>{pc.threatenedSectors[0]}</strong>. Come difensore ({pc.defender}), scegli subito
            gratuitamente:
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() =>
                onAction({
                  type: 'ENCIRCLEMENT_DECISION',
                  sector: pc.threatenedSectors[0],
                  choice: 'RITIRATA',
                })
              }
            >
              🏃 Ritirata (Marker di {pc.threatenedSectors[0]} arretra di 1, nessuna sacca)
            </button>
            <button
              type="button"
              style={{ borderColor: 'var(--danger)' }}
              onClick={() =>
                onAction({
                  type: 'ENCIRCLEMENT_DECISION',
                  sector: pc.threatenedSectors[0],
                  choice: 'RESISTERE',
                })
              }
            >
              ⛓️ Resistere sul posto (Tutte le tue formazioni in {pc.threatenedSectors[0]} diventano
              ACCERCHIATE)
            </button>
          </div>
        </div>
      )}

      {/* Close button when combat is fully resolved */}
      {!pc && lastResolvedCombat && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <button
            type="button"
            style={{ borderColor: 'var(--gold)', fontWeight: 700 }}
            onClick={onDismissResolvedCombat}
          >
            Chiudi Riepilogo Battaglia
          </button>
        </div>
      )}
    </dialog>
  );
};
