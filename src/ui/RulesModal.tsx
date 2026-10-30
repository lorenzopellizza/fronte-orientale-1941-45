import React, { useEffect, useRef } from 'react';
import { FactionEmblem, UnitSilhouette } from './WargameArtwork';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ open, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="rules-modal-title"
      onClose={onClose}
      style={{ maxWidth: '880px' }}
    >
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FactionEmblem side="AXIS" size={30} />
          <h2 id="rules-modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
            MANUALE DA CAMPO — Come Giocare in 60 Secondi
          </h2>
          <FactionEmblem side="USSR" size={30} />
        </div>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          ✕ Chiudi Manuale
        </button>
      </div>

      <div className="modal-body" style={{ lineHeight: 1.55, fontSize: '0.88rem' }}>
        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid var(--gold)',
            borderRadius: '8px',
          }}
        >
          <strong style={{ color: 'var(--gold)', fontSize: '0.96rem' }}>
            🎯 OBIETTIVO DELLA PARTITA (9 Turni: Estate 1941 – Estate 1945)
          </strong>
          <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
            <li>
              <strong>La mappa è divisa in 3 Settori (NORD, CENTRO, SUD)</strong>, ciascuno con 7 caselle (`0..6`). Il{' '}
              <strong>Segnalino Fronte ⚔</strong> indica fin dove arriva il controllo tedesco: a sinistra c&apos;è
              l&apos;Asse, a destra l&apos;URSS.
            </li>
            <li>
              <strong>Come vince l&apos;ASSE</strong>: Conquistare contemporaneamente <strong>3 Città ★</strong>{' '}
              (Leningrado, Mosca, Stalingrado, Caucaso) a fine turno (<em>vittoria immediata</em>), oppure accumulare{' '}
              <strong>almeno 12 Punti Vittoria (PV)</strong> entro la fine del turno 9 (`E45`). Ogni Città ★ controllata
              a fine turno dà <strong>+1 PV</strong> all&apos;Asse.
            </li>
            <li>
              <strong>Come vince l&apos;URSS</strong>: Entrare a <strong>Berlino</strong> (Casella 0 del Centro ={' '}
              <em>vittoria immediata</em>) oppure impedire all&apos;Asse di arrivare a 12 PV a fine `E45` (dal 1944, ogni
              settore spinto fino a casella `≤ 1` toglie −1 PV all&apos;Asse!).
            </li>
          </ul>
        </div>

        <div className="grid-2">
          <div className="stat-box">
            <h3 style={{ marginTop: 0, color: '#93c5fd' }}>⚡ 1. COME FUNZIONA IL TUO TURNO</h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              I due giocatori alternano <strong>1 Ordine alla volta</strong> (hai <strong>3 Ordini</strong> per turno,{' '}
              <strong>+1 Ordine</strong> se detieni l&apos;<strong>Iniziativa ★</strong>).
            </p>
            <p style={{ margin: 0 }}>
              Non serve usare menu complicati! <strong>Interagisci direttamente col tavolo da gioco:</strong>
            </p>
            <ul style={{ margin: '0.4rem 0 0 1.1rem', padding: 0 }}>
              <li>
                <strong>Clicca una Carta nella tua Mano in basso</strong>: si illumineranno sul tavolo le unità o i
                settori dove puoi assegnarla (Carri, Cannoni, Comandanti, Aerei, Eventi).
              </li>
              <li>
                <strong>Clicca una tua Unità (Pedina)</strong>: compaiono subito i pulsanti per{' '}
                <strong>⇄ Muoverla</strong> in un altro settore/Riserva o <strong>✚ Ripararla</strong>.
              </li>
              <li>
                <strong>Clicca ⚔ ATTACCA QUI su un Settore</strong>: tutte le tue unità pronte in quel settore
                lanciano l&apos;offensiva!
              </li>
            </ul>
          </div>

          <div className="stat-box">
            <h3 style={{ marginTop: 0, color: '#fca5a5' }}>⚔ 2. COMBATTIMENTO, RISERVE & SACCHE</h3>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <UnitSilhouette type="CORAZZATA" side="AXIS" size={42} />
              <UnitSilhouette type="MOTORIZZATA" side="USSR" size={42} />
              <UnitSilhouette type="FANTERIA" side="AXIS" size={42} />
            </div>
            <ul style={{ margin: '0 0 0 1.1rem', padding: 0 }}>
              <li>
                <strong>Armi Combinate (+1 ATT)</strong>: Attaccare insieme con almeno 1 <em>Corazzata</em> + 1{' '}
                <em>Fanteria/Motorizzata</em> dà +1 Attacco.
              </li>
              <li>
                <strong>Riserve Mobili</strong>: Tieni qualche unità <em>Corazzata</em> o <em>Motorizzata</em> (senza
                equipaggiamento <code>PESANTE</code>) nella <strong>Riserva</strong>! Quando il nemico attacca un
                settore, possono correre in difesa all&apos;ultimo istante.
              </li>
              <li>
                <strong>Sfondamento e Accerchiamento (Sacche)</strong>: Se un settore avanza molto più avanti di quello
                adiacente (divario ≥ 2 caselle), minacci di <strong>accerchiare</strong> le armate nemiche rimaste
                indietro! Le unità accerchiate non possono muoversi né attaccare e perdono 1 Forza a fine turno.
              </li>
            </ul>
          </div>
        </div>

        <div className="stat-box">
          <h3 style={{ marginTop: 0, color: 'var(--gold)' }}>
            💰 3. PUNTI PRODUZIONE (PP) E RICONVERSIONE GRATUITA
          </h3>
          <p style={{ margin: 0 }}>
            I <strong>PP</strong> servono per pagare le carte Equipaggiamento, Aerei, Comandanti, Riparazioni e
            Prototipi dell&apos;anno successivo.{' '}
            <strong>Hai bisogno di PP subito?</strong> Su qualsiasi carta in mano (o equipaggiamento già montato) puoi
            premere <strong>♻ Scarta per +PP</strong> gratuitamente senza consumare un Ordine!
          </p>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Ho capito — Torna al Tavolo Operativo
        </button>
      </div>
    </dialog>
  );
};
