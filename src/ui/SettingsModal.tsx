import React, { useEffect, useRef, useState } from 'react';
import { cloneConfig, config as defaultConfig } from '../data/config';
import { GameConfig } from '../engine/types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  currentConfig: GameConfig;
  onApplyAndRestart: (newConfig: GameConfig) => void;
  onUpdateLiveConfig: (newConfig: GameConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  currentConfig,
  onApplyAndRestart,
  onUpdateLiveConfig,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<GameConfig>(() => cloneConfig(currentConfig));

  useEffect(() => {
    setDraft(cloneConfig(currentConfig));
  }, [currentConfig, open]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  if (!open) return null;

  const toggleModule = (key: keyof GameConfig['modules']) => {
    setDraft({
      ...draft,
      modules: {
        ...draft.modules,
        [key]: !draft.modules[key],
      },
    });
  };

  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby="settings-modal-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="settings-modal-title" style={{ margin: 0 }}>
          ⚙️ Impostazioni & Toggle Meccaniche (Sezione 12)
        </h2>
        <button type="button" onClick={onClose}>
          ✕ Chiudi
        </button>
      </div>

      <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBlock: '0.5rem' }}>
        Tutti i parametri e i moduli sono configurabili per isolare le meccaniche durante i playtest.
      </p>

      {/* Modules Toggles */}
      <div
        style={{
          padding: '0.75rem',
          background: 'var(--bg-panel-elevated)',
          borderRadius: '6px',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.92rem', color: 'var(--gold)' }}>
          Moduli Meccaniche (Attiva / Disattiva)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
          {(
            [
              ['reserves', 'Reazione Riserve Mobili (6.2)'],
              ['encirclement', 'Accerchiamento e Sacche (6.6)'],
              ['supply', 'Rifornimenti & Punto Culminante (6.5)'],
              ['winter', 'Regole Invernali (6.7)'],
              ['air', 'Aviazione e Superiorità Aerea (6.4)'],
              ['experience', 'Esperienza, Livelli e Guardie (6.9)'],
              ['initiativeBonus', '+1 Ordine per Iniziativa (6.10)'],
              ['surprise', 'Sorpresa Strategica in E41 (6.8)'],
              ['combinedArms', 'Armi Combinate +1 Atk (6.3)'],
              ['fogOfWar', 'Nebbia di Guerra (Forza/Equip nascosti)'],
            ] as [keyof GameConfig['modules'], string][]
          ).map(([k, label]) => (
            <label
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={draft.modules[k]}
                onChange={() => toggleModule(k)}
              />
              <span>{label}</span>
            </label>
          ))}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={draft.dice.enabled}
              onChange={() =>
                setDraft({ ...draft, dice: { ...draft.dice, enabled: !draft.dice.enabled } })
              }
            />
            <span>🎲 Tiro di Dado 1d6 in Combattimento</span>
          </label>
        </div>
      </div>

      {/* Numeric Parameters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '0.65rem',
          fontSize: '0.82rem',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Seed RNG:</span>
          <input
            type="number"
            value={draft.seed}
            onChange={(e) => setDraft({ ...draft, seed: Number(e.target.value) || 1 })}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Ordini base per turno:</span>
          <input
            type="number"
            value={draft.ordersPerTurn}
            onChange={(e) => setDraft({ ...draft, ordersPerTurn: Number(e.target.value) || 1 })}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Bonus ordini iniziativa:</span>
          <input
            type="number"
            value={draft.initiativeBonusOrders}
            onChange={(e) =>
              setDraft({ ...draft, initiativeBonusOrders: Number(e.target.value) || 0 })
            }
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Pesca carte inizio turno (handSize):</span>
          <input
            type="number"
            value={draft.handSize}
            onChange={(e) => setDraft({ ...draft, handSize: Number(e.target.value) || 1 })}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Limite massimo mano (handMax):</span>
          <input
            type="number"
            value={draft.handMax}
            onChange={(e) => setDraft({ ...draft, handMax: Number(e.target.value) || 1 })}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Max PP conservati (ppCarryMax):</span>
          <input
            type="number"
            value={draft.ppCarryMax}
            onChange={(e) => setDraft({ ...draft, ppCarryMax: Number(e.target.value) || 0 })}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Max Reazioni Riserva (maxReactions):</span>
          <input
            type="number"
            value={draft.maxReactions}
            onChange={(e) => setDraft({ ...draft, maxReactions: Number(e.target.value) || 0 })}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>PV Asse per vincere a E45:</span>
          <input
            type="number"
            value={draft.victory.axisVpToWin}
            onChange={(e) =>
              setDraft({
                ...draft,
                victory: { ...draft.victory, axisVpToWin: Number(e.target.value) || 1 },
              })
            }
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Città ★ per Vittoria Immediata Asse:</span>
          <input
            type="number"
            value={draft.victory.axisSuddenDeathCities}
            onChange={(e) =>
              setDraft({
                ...draft,
                victory: { ...draft.victory, axisSuddenDeathCities: Number(e.target.value) || 1 },
              })
            }
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Rifornimento Asse gratuito fino a marker:</span>
          <input
            type="number"
            value={draft.supply.axisFreeUntil}
            onChange={(e) =>
              setDraft({
                ...draft,
                supply: { ...draft.supply, axisFreeUntil: Number(e.target.value) || 0 },
              })
            }
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Costo Ricostituzione URSS / Asse (PP):</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="number"
              style={{ width: '60px' }}
              value={draft.rebuildCost.ussr}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  rebuildCost: { ...draft.rebuildCost, ussr: Number(e.target.value) || 1 },
                })
              }
            />
            <input
              type="number"
              style={{ width: '60px' }}
              value={draft.rebuildCost.axis}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  rebuildCost: { ...draft.rebuildCost, axis: Number(e.target.value) || 1 },
                })
              }
            />
          </div>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
          <input
            type="checkbox"
            checked={draft.experience.replacementsDropLevel}
            onChange={() =>
              setDraft({
                ...draft,
                experience: {
                  ...draft.experience,
                  replacementsDropLevel: !draft.experience.replacementsDropLevel,
                },
              })
            }
          />
          <span>Rimpiazzi ≥2 abbassano livello XP</span>
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginTop: '1.2rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <button type="button" onClick={() => setDraft(cloneConfig(defaultConfig))}>
          ↺ Ripristina Valori Default
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              onUpdateLiveConfig(draft);
              onClose();
            }}
          >
            Applica alla partita in corso
          </button>
          <button
            type="button"
            style={{ borderColor: 'var(--gold)', fontWeight: 700 }}
            onClick={() => {
              onApplyAndRestart(draft);
              onClose();
            }}
          >
            🚀 Nuova Partita con queste Impostazioni
          </button>
        </div>
      </div>
    </dialog>
  );
};
