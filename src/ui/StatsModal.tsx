import React, { useEffect, useRef } from 'react';
import { SECTORS } from '../data/map';
import { CombatOutcomeType, GameState, Side } from '../engine/types';
import { PLAYTEST_QUESTIONS } from './tooltips';

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
  state: GameState;
}

const OUTCOMES: CombatOutcomeType[] = [
  'DISFATTA',
  'RESPINTO',
  'AVANZATA',
  'VITTORIA_NETTA',
  'SFONDAMENTO',
];

export const StatsModal: React.FC<StatsModalProps> = ({ open, onClose, state }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  if (!open) return null;

  const { stats } = state;
  const diceImpactPct =
    stats.diceTotalBattles > 0
      ? ((stats.diceChangedOutcomeCount / stats.diceTotalBattles) * 100).toFixed(1)
      : '0.0';

  const exportStatsJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      winner: state.winner,
      victoryReason: state.victoryReason,
      finalTurn: state.turn,
      finalAxisVp: state.axisVp,
      config: state.config,
      stats: state.stats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fronte-orientale-stats-${state.turn}-seed${state.config.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby="stats-modal-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="stats-modal-title" style={{ margin: 0 }}>
          📊 Statistiche di Analisi & Playtest (M3)
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={exportStatsJson}>
            💾 Esporta Statistiche JSON
          </button>
          <button type="button" onClick={onClose}>
            ✕ Chiudi
          </button>
        </div>
      </div>

      {state.winner && (
        <div
          style={{
            marginBlock: '0.75rem',
            padding: '0.75rem',
            borderRadius: '6px',
            background: state.winner === 'AXIS' ? 'var(--axis-bg-strong)' : 'var(--ussr-bg-strong)',
            border: '2px solid var(--gold)',
          }}
        >
          <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--gold)' }}>
            🏆 VINCITORE: {state.winner === 'AXIS' ? 'ASSE (Germania)' : 'URSS (Armata Rossa)'}
          </h3>
          <p style={{ margin: 0 }}>{state.victoryReason}</p>
        </div>
      )}

      {/* Key Metric: Dice Impact */}
      <div
        style={{
          marginBlock: '0.75rem',
          padding: '0.75rem',
          background: 'var(--bg-panel-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: '6px',
        }}
      >
        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', color: 'var(--gold)' }}>
          🎲 Impatto del Dado (Metrica chiave Strategia vs Fortuna)
        </h3>
        <p style={{ margin: 0, fontSize: '0.88rem' }}>
          Battaglie con dado giocate: <strong>{stats.diceTotalBattles}</strong> | Battaglie in cui il
          tiro di dado ha <strong>cambiato la categoria di esito</strong> rispetto a DIFF senza dado:{' '}
          <strong style={{ color: 'var(--gold)' }}>
            {stats.diceChangedOutcomeCount} ({diceImpactPct}%)
          </strong>
        </p>
      </div>

      {/* Turn-by-Turn Marker & VP Chart / Table */}
      <div style={{ marginBlock: '0.75rem' }}>
        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem' }}>
          📈 Andamento Fronte (Marker 0–6 per Settore) e PV Asse per Turno
        </h3>
        {stats.turnSnapshots.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
            Completa almeno un turno per visualizzare lo storico turno per turno.
          </p>
        ) : (
          <>
            {/* SVG Line Chart */}
            <svg
              viewBox="0 0 600 180"
              style={{
                width: '100%',
                height: '170px',
                background: '#14181d',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                marginBottom: '0.4rem',
              }}
              role="img"
              aria-label="Grafico andamento marker settori e punti vittoria Asse per turno"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((lvl) => {
                const y = 155 - lvl * 22;
                return (
                  <g key={lvl}>
                    <line x1={40} y1={y} x2={580} y2={y} stroke="#2a313a" strokeDasharray="3,3" />
                    <text x={15} y={y + 4} fill="#768394" fontSize="10">
                      {lvl}
                    </text>
                  </g>
                );
              })}
              {(['NORD', 'CENTRO', 'SUD'] as const).map((sec, sIdx) => {
                const colors = ['#58a6ff', '#f0b429', '#e5534b'];
                const points = stats.turnSnapshots
                  .map((snap, idx) => {
                    const x = 60 + idx * 60;
                    const y = 155 - snap.markers[sec] * 22;
                    return `${x},${y}`;
                  })
                  .join(' ');
                return (
                  <polyline
                    key={sec}
                    fill="none"
                    stroke={colors[sIdx]}
                    strokeWidth="2.5"
                    points={points}
                  />
                );
              })}
              {stats.turnSnapshots.map((snap, idx) => {
                const x = 60 + idx * 60;
                return (
                  <text key={snap.turn} x={x - 10} y={173} fill="#a7b3c2" fontSize="10">
                    {snap.turn}
                  </text>
                );
              })}
            </svg>
            <div style={{ fontSize: '0.75rem', display: 'flex', gap: '1rem', marginBottom: '0.4rem' }}>
              <span style={{ color: '#58a6ff' }}>● NORD</span>
              <span style={{ color: '#f0b429' }}>● CENTRO</span>
              <span style={{ color: '#e5534b' }}>● SUD</span>
            </div>

            <table className="combat-table">
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Marker NORD</th>
                  <th>Marker CENTRO</th>
                  <th>Marker SUD</th>
                  <th>PV Asse</th>
                </tr>
              </thead>
              <tbody>
                {stats.turnSnapshots.map((snap) => (
                  <tr key={snap.turn}>
                    <td>
                      <strong>{snap.turn}</strong>
                    </td>
                    <td>{snap.markers.NORD}</td>
                    <td>{snap.markers.CENTRO}</td>
                    <td>{snap.markers.SUD}</td>
                    <td>
                      <strong>{snap.axisVp}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Combat Outcomes & Breakthroughs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBlock: '0.75rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem' }}>⚔️ Attacchi ed Esiti per Lato</h3>
          <table className="combat-table">
            <thead>
              <tr>
                <th>Metrica</th>
                <th>Asse</th>
                <th>URSS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Totale Attacchi</td>
                <td>{stats.attacksBySide.AXIS}</td>
                <td>{stats.attacksBySide.USSR}</td>
              </tr>
              {OUTCOMES.map((out) => (
                <tr key={out}>
                  <td>Esito: {out}</td>
                  <td>{stats.outcomesBySide.AXIS[out]}</td>
                  <td>{stats.outcomesBySide.USSR[out]}</td>
                </tr>
              ))}
              <tr>
                <td>Sfondamenti ottenuti</td>
                <td>{stats.breakthroughsBySide.AXIS}</td>
                <td>{stats.breakthroughsBySide.USSR}</td>
              </tr>
              <tr>
                <td>Formazioni nemiche insaccate</td>
                <td>{stats.encirclementsCausedBySide.AXIS}</td>
                <td>{stats.encirclementsCausedBySide.USSR}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem' }}>
            🏭 Ordini e PP Spesi per Categoria
          </h3>
          <table className="combat-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Asse</th>
                <th>URSS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PP → Equipaggiamento / Aerei / Com.</td>
                <td>{stats.ppSpentByCategory.AXIS.equipment}</td>
                <td>{stats.ppSpentByCategory.USSR.equipment}</td>
              </tr>
              <tr>
                <td>PP → Riorganizzazione / Ricostituz.</td>
                <td>{stats.ppSpentByCategory.AXIS.replacements}</td>
                <td>{stats.ppSpentByCategory.USSR.replacements}</td>
              </tr>
              <tr>
                <td>PP → Prototipi</td>
                <td>{stats.ppSpentByCategory.AXIS.prototypes}</td>
                <td>{stats.ppSpentByCategory.USSR.prototypes}</td>
              </tr>
              <tr>
                <td>PP → Eventi</td>
                <td>{stats.ppSpentByCategory.AXIS.events}</td>
                <td>{stats.ppSpentByCategory.USSR.events}</td>
              </tr>
              {['ATTACCARE', 'RIDISLOCARE', 'EQUIPAGGIARE', 'RIORGANIZZARE', 'RITIRATA', 'PROTOTIPO', 'EVENTO'].map(
                (ord) => (
                  <tr key={ord}>
                    <td>Ordini: {ord}</td>
                    <td>{stats.ordersSpentByType.AXIS[ord] ?? 0}</td>
                    <td>{stats.ordersSpentByType.USSR[ord] ?? 0}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Destroyed Formations */}
      <div style={{ marginBlock: '0.75rem' }}>
        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem' }}>
          💀 Formazioni Distrutte ({stats.destroyedLog.length})
        </h3>
        {stats.destroyedLog.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
            Nessuna formazione distrutta finora.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {stats.destroyedLog.map((d, i) => (
              <span key={i} className="badge danger">
                [{d.turn}] {d.name} ({d.side})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Section 14: Playtest Questions */}
      <details style={{ marginTop: '0.75rem', background: 'var(--bg-panel-elevated)', padding: '0.6rem', borderRadius: '6px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--gold)' }}>
          📋 Questionario di Playtest (Sezione 14 della Specifica)
        </summary>
        <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0, fontSize: '0.84rem', lineHeight: 1.6 }}>
          {PLAYTEST_QUESTIONS.map((q, idx) => (
            <li key={idx}>{q.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ol>
      </details>
    </dialog>
  );
};
