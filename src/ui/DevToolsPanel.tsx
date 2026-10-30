import React, { useState } from 'react';
import { SECTORS } from '../data/map';
import { promoteFormationIfNeeded } from '../engine/engine';
import { GameState, SectorId } from '../engine/types';

interface DevToolsPanelProps {
  state: GameState;
  canUndo: boolean;
  onUndo: () => void;
  onReplaceState: (newState: GameState) => void;
  onResetWithSeed: (seed: number) => void;
}

export const DevToolsPanel: React.FC<DevToolsPanelProps> = ({
  state,
  canUndo,
  onUndo,
  onReplaceState,
  onResetWithSeed,
}) => {
  const [newSeed, setNewSeed] = useState<number>(state.config.seed + 1);
  const [jsonText, setJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const clone = (): GameState => JSON.parse(JSON.stringify(state));

  const adjustMarker = (sec: SectorId, delta: number) => {
    const s = clone();
    s.sectors[sec].marker = Math.max(0, Math.min(6, s.sectors[sec].marker + delta));
    onReplaceState(s);
  };

  const adjustPp = (side: 'AXIS' | 'USSR', delta: number) => {
    const s = clone();
    s.pp[side] = Math.max(0, s.pp[side] + delta);
    onReplaceState(s);
  };

  const adjustVp = (delta: number) => {
    const s = clone();
    s.axisVp += delta;
    onReplaceState(s);
  };

  const adjustFormationStrength = (id: string, delta: number) => {
    const s = clone();
    const f = s.formations.find((u) => u.id === id);
    if (!f) return;
    f.strength = Math.max(1, Math.min(f.maxStrength, f.strength + delta));
    onReplaceState(s);
  };

  const adjustFormationXp = (id: string, delta: number) => {
    const s = clone();
    const f = s.formations.find((u) => u.id === id);
    if (!f) return;
    f.xp = Math.max(0, f.xp + delta);
    promoteFormationIfNeeded(s, f);
    onReplaceState(s);
  };

  const drawExtraCard = (side: 'AXIS' | 'USSR') => {
    const s = clone();
    const card = s.drawPiles[side].shift();
    if (card) {
      s.hands[side].push(card);
      onReplaceState(s);
    }
  };

  const handleExportJson = () => {
    setJsonText(JSON.stringify(state, null, 2));
    setJsonError(null);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as GameState;
      if (!parsed.sectors || !parsed.formations || !parsed.turn) {
        throw new Error('Formato GameState JSON non valido.');
      }
      onReplaceState(parsed);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message || 'Errore nel parsing JSON.');
    }
  };

  return (
    <div
      style={{
        margin: '0 0.75rem 0.75rem 0.75rem',
        padding: '0.75rem',
        background: '#191d24',
        border: '1px dashed var(--gold)',
        borderRadius: '6px',
        fontSize: '0.8rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.6rem',
        }}
      >
        <strong style={{ color: 'var(--gold)' }}>
          🛠️ MODALITÀ SVILUPPATORE (Sezione 13 — Sandbox & Ispezione Stato)
        </strong>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" disabled={!canUndo} onClick={onUndo}>
            ⏪ Annulla Ultima Azione (Undo)
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Nuovo Seed:
            <input
              type="number"
              style={{ width: '90px' }}
              value={newSeed}
              onChange={(e) => setNewSeed(Number(e.target.value) || 1)}
            />
            <button type="button" onClick={() => onResetWithSeed(newSeed)}>
              🔄 Reset con Seed
            </button>
          </span>
        </div>
      </div>

      {/* Quick state mutators */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div>
          <strong>Marker Fronte & PV Asse:</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            {SECTORS.map((sec) => (
              <div key={sec} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {sec}: <strong>{state.sectors[sec].marker}</strong>
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="button" onClick={() => adjustMarker(sec, -1)}>
                    −1 (URSS)
                  </button>
                  <button type="button" onClick={() => adjustMarker(sec, 1)}>
                    +1 (Asse)
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                PV Asse: <strong>{state.axisVp}</strong>
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" onClick={() => adjustVp(-1)}>
                  −1 PV
                </button>
                <button type="button" onClick={() => adjustVp(1)}>
                  +1 PV
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <strong>Risorse PP & Mano Carte:</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PP Asse ({state.pp.AXIS}):</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" onClick={() => adjustPp('AXIS', -1)}>
                  −1
                </button>
                <button type="button" onClick={() => adjustPp('AXIS', 5)}>
                  +5 PP
                </button>
                <button type="button" onClick={() => drawExtraCard('AXIS')}>
                  +1 Carta
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PP URSS ({state.pp.USSR}):</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" onClick={() => adjustPp('USSR', -1)}>
                  −1
                </button>
                <button type="button" onClick={() => adjustPp('USSR', 5)}>
                  +5 PP
                </button>
                <button type="button" onClick={() => drawExtraCard('USSR')}>
                  +1 Carta
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <strong>Modifica Rapida Formazioni (Forza / XP):</strong>
          <div
            style={{
              maxHeight: '110px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              marginTop: '4px',
            }}
          >
            {state.formations.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.74rem',
                }}
              >
                <span>
                  [{f.side}] {f.name} (F{f.strength}/{f.maxStrength}, {f.xp}XP)
                </span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    type="button"
                    style={{ padding: '1px 4px', minBlockSize: 'auto' }}
                    onClick={() => adjustFormationStrength(f.id, -1)}
                  >
                    −F
                  </button>
                  <button
                    type="button"
                    style={{ padding: '1px 4px', minBlockSize: 'auto' }}
                    onClick={() => adjustFormationStrength(f.id, 1)}
                  >
                    +F
                  </button>
                  <button
                    type="button"
                    style={{ padding: '1px 4px', minBlockSize: 'auto' }}
                    onClick={() => adjustFormationXp(f.id, 1)}
                  >
                    +XP
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* JSON Export / Import */}
      <details style={{ marginTop: '0.6rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
          📄 Esporta / Importa Stato Completo (JSON)
        </summary>
        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={handleExportJson}>
              Carica Stato Attuale nel Box JSON
            </button>
            <button type="button" onClick={handleImportJson}>
              Importa e Sovrascrivi Stato dal Box JSON
            </button>
          </div>
          {jsonError && <div style={{ color: 'var(--danger)' }}>{jsonError}</div>}
          <textarea
            rows={5}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Clicca 'Carica Stato Attuale' o incolla qui un JSON di GameState..."
            style={{
              width: '100%',
              background: '#0d1014',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
            }}
          />
        </div>
      </details>
    </div>
  );
};
