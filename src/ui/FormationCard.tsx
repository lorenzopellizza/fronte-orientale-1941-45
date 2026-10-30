import React from 'react';
import { getFormationBaseAttack, getFormationBaseDefense } from '../engine/combat';
import { Formation, Side } from '../engine/types';
import { KEYWORD_TOOLTIPS } from './tooltips';
import { FactionEmblem, UnitSilhouette } from './WargameArtwork';

interface FormationCardProps {
  formation: Formation;
  viewerSide: Side;
  fogOfWar: boolean;
  experienceEnabled: boolean;
  onSelect?: (formation: Formation) => void;
  selected?: boolean;
  onReconvertEquipment?: (formationId: string) => void;
  canReconvert?: boolean;
  /** When the player selected an equipment card in hand, highlight eligible units */
  equipHighlight?: {
    cardName: string;
    cost: number;
    onEquipHere: () => void;
  };
  /** Inline quick actions when unit is selected */
  quickActions?: {
    onStartMove?: () => void;
    onQuickRepair1?: () => void;
    canQuickRepair1?: boolean;
  };
}

export const FormationCard: React.FC<FormationCardProps> = ({
  formation,
  viewerSide,
  fogOfWar,
  experienceEnabled,
  onSelect,
  selected,
  onReconvertEquipment,
  canReconvert,
  equipHighlight,
  quickActions,
}) => {
  const isHidden = fogOfWar && formation.side !== viewerSide;
  const isGuards = formation.keywords.includes('GUARDIA');
  const sideClass = formation.side === 'AXIS' ? 'axis' : 'ussr';

  const typeLabel =
    formation.type === 'CORAZZATA'
      ? 'CORAZZATA'
      : formation.type === 'MOTORIZZATA'
      ? 'MOTORIZZATA'
      : 'FANTERIA';

  if (isHidden) {
    return (
      <div
        className={`formation-card ${sideClass}`}
        title="Nebbia di guerra: i dettagli di questa formazione avversaria sono nascosti"
      >
        <div className="formation-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FactionEmblem side={formation.side} size={20} />
            <span className="formation-name">Unità Coperta</span>
          </div>
          <span className="formation-type-badge">{typeLabel}</span>
        </div>
        <div className="unit-art-banner">
          <UnitSilhouette type={formation.type} side={formation.side} size={46} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Forza & Equip. Ignoti</span>
        </div>
      </div>
    );
  }

  const atkVal = getFormationBaseAttack(formation, experienceEnabled);
  const defVal = getFormationBaseDefense(formation, experienceEnabled);

  const pips = Array.from({ length: formation.maxStrength }, (_, i) => i < formation.strength);
  const refundPp = formation.equipment ? Math.max(1, Math.ceil(formation.equipment.cost / 2)) : 0;

  const levelStars =
    formation.level === 'ELITE' ? '★★ ELITE' : formation.level === 'VETERANA' ? '★ VETERANA' : 'RECLUTA';

  return (
    <div
      className={`formation-card ${sideClass} ${isGuards ? 'guards' : ''} ${
        formation.exhausted ? 'exhausted' : ''
      } ${formation.encircled ? 'encircled' : ''} ${selected ? 'selected-unit' : ''} ${
        equipHighlight ? 'equip-target-glow' : ''
      }`}
      onClick={() => onSelect?.(formation)}
    >
      {/* Top Header: Emblem + Historical Name */}
      <div className="formation-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
          <FactionEmblem side={formation.side} size={20} />
          <span className="formation-name" title={formation.name}>
            {isGuards ? '★ ' : ''}
            {formation.name}
          </span>
        </div>
      </div>

      {/* Illustrated Unit Silhouette + Big Tabletop Combat Values */}
      <div className="unit-art-banner">
        <div className="combat-stat-shield atk-shield" title="Valore totale di Attacco della formazione">
          <span className="shield-label">⚔ ATT</span>
          <span className="shield-num">{atkVal}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
          <UnitSilhouette type={formation.type} side={formation.side} size={46} />
          <span className="formation-type-badge">{typeLabel}</span>
        </div>

        <div className="combat-stat-shield def-shield" title="Valore totale di Difesa della formazione">
          <span className="shield-label">🛡 DIF</span>
          <span className="shield-num">{defVal}</span>
        </div>
      </div>

      {/* Strength Bar (Visual Blocks) & Experience */}
      <div className="formation-stats-row">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: '2px' }}>
            <span>
              Forza: <strong>{formation.strength}</strong>/{formation.maxStrength}
            </span>
            {experienceEnabled && (
              <span
                title={KEYWORD_TOOLTIPS[formation.level]}
                style={{
                  color: formation.level !== 'RECLUTA' ? 'var(--gold)' : 'var(--text-muted)',
                  fontWeight: formation.level !== 'RECLUTA' ? 700 : 400,
                }}
              >
                {levelStars} ({formation.xp} XP)
              </span>
            )}
          </div>
          <div className="strength-bar" aria-label={`Forza ${formation.strength} su ${formation.maxStrength}`}>
            {pips.map((filled, idx) => (
              <div
                key={idx}
                className={`strength-pip ${
                  filled ? (formation.strength === 1 ? 'critical' : 'filled') : ''
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Keywords & Status stamps */}
      {(formation.keywords.length > 0 ||
        formation.encircled ||
        formation.exhausted ||
        formation.reactedThisTurn) && (
        <div className="keyword-row">
          {formation.encircled && (
            <span
              className="keyword-tag"
              style={{ background: '#7f1d1d', color: '#fecaca', borderColor: '#ef4444', fontWeight: 800 }}
              title="Unità chiusa in una SACCA: non può attaccare, muoversi né ricevere rinforzi; perde 1 Forza a fine turno."
            >
              ⭕ IN SACCA
            </span>
          )}
          {formation.exhausted && (
            <span
              className="keyword-tag"
              style={{ background: '#334155', color: '#cbd5e1' }}
              title="Ha già partecipato a un attacco in questo turno."
            >
              💤 ESAUSTA
            </span>
          )}
          {formation.reactedThisTurn && (
            <span className="keyword-tag" title="Ha già effettuato una reazione dalla Riserva in questo turno.">
              ⚡ REAGITO
            </span>
          )}
          {formation.keywords.map((kw) => (
            <span
              key={kw}
              className={`keyword-tag ${kw === 'GUARDIA' ? 'guardia' : ''} ${
                kw === 'FRAGILE' ? 'fragile' : ''
              } ${kw === 'INVERNO' ? 'inverno' : ''}`}
              title={KEYWORD_TOOLTIPS[kw] ?? kw}
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Attached Equipment */}
      {formation.equipment ? (
        <div className="equipment-strip">
          <div>
            🔧 <strong>{formation.equipment.name}</strong> (+{formation.equipment.atk}/+{formation.equipment.def})
            {formation.equipment.keywords.map((k) => (
              <span
                key={k}
                className="keyword-tag"
                style={{ marginLeft: '0.25rem' }}
                title={KEYWORD_TOOLTIPS[k] ?? k}
              >
                {k}
              </span>
            ))}
          </div>
          {canReconvert && onReconvertEquipment && (
            <button
              type="button"
              className="btn btn-sm"
              style={{ padding: '0.1rem 0.35rem', fontSize: '0.62rem' }}
              title={`Smonta e riconverti equipaggiamento in +${refundPp} PP (azione gratuita)`}
              onClick={(e) => {
                e.stopPropagation();
                onReconvertEquipment(formation.id);
              }}
            >
              ♻ +{refundPp}PP
            </button>
          )}
        </div>
      ) : (
        <div className="equipment-strip empty-slot">Slot Equipaggiamento libero</div>
      )}

      {/* Direct 1-click Equip button when an equipment card is selected in hand */}
      {equipHighlight && (
        <button
          type="button"
          className="btn btn-sm btn-gold"
          style={{ width: '100%', marginTop: '0.25rem', fontWeight: 800 }}
          onClick={(e) => {
            e.stopPropagation();
            equipHighlight.onEquipHere();
          }}
        >
          🔧 Monta {equipHighlight.cardName} ({equipHighlight.cost} PP)
        </button>
      )}

      {/* Direct Quick Actions when this unit is selected */}
      {selected && quickActions && !equipHighlight && (
        <div className="unit-quick-actions" onClick={(e) => e.stopPropagation()}>
          {quickActions.onStartMove && !formation.encircled && (
            <button type="button" className="btn btn-sm btn-primary" onClick={quickActions.onStartMove}>
              ⇄ Muovi Unità
            </button>
          )}
          {quickActions.onQuickRepair1 && !formation.encircled && formation.strength < formation.maxStrength && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={!quickActions.canQuickRepair1}
              onClick={quickActions.onQuickRepair1}
              title="Ripristina +1 Forza (1 Ordine, 1 PP, nessuna perdita di esperienza)"
            >
              ✚ Ripara +1 (1 PP)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
