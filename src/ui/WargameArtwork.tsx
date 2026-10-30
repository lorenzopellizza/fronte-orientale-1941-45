import React, { useState } from 'react';
import { Card, CardType, FormationType, Season, SectorId, Side } from '../engine/types';

export const FactionEmblem: React.FC<{ side: Side; size?: number }> = ({ side, size = 28 }) => {
  if (side === 'AXIS') {
    // Balkenkreuz / Iron Cross style wargame token emblem
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        aria-hidden="true"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}
      >
        <circle cx="20" cy="20" r="18" fill="#2c353d" stroke="#9aa5b1" strokeWidth="2" />
        <path
          d="M16 5 H24 V16 H35 V24 H24 V35 H16 V24 H5 V16 H16 Z"
          fill="#11161b"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        <path d="M18 7 H22 V18 H33 V22 H22 V33 H18 V22 H7 V18 H18 Z" fill="#182026" />
      </svg>
    );
  }

  // USSR Red Star with Gold Border
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}
    >
      <circle cx="20" cy="20" r="18" fill="#5c1515" stroke="#eab308" strokeWidth="2" />
      <polygon
        points="20,4 24.2,14.5 35.5,15.2 26.8,22.4 29.6,33.5 20,27.3 10.4,33.5 13.2,22.4 4.5,15.2 15.8,14.5"
        fill="#dc2626"
        stroke="#fef08a"
        strokeWidth="1.6"
      />
      <circle cx="20" cy="20" r="4" fill="#eab308" opacity="0.85" />
    </svg>
  );
};

export const WarRoomCompassSvg: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="21" fill="#1c1917" stroke="#d97706" strokeWidth="1.8" />
    <circle cx="24" cy="24" r="17" fill="none" stroke="#92400e" strokeWidth="1" strokeDasharray="2 2" />
    <polygon points="24,4 28,20 24,17 20,20" fill="#ef4444" />
    <polygon points="24,44 28,28 24,31 20,28" fill="#fcd34d" />
    <polygon points="4,24 20,20 17,24 20,28" fill="#d97706" />
    <polygon points="44,24 28,20 31,24 28,28" fill="#d97706" />
    <circle cx="24" cy="24" r="3" fill="#fef3c7" stroke="#78350f" strokeWidth="1.2" />
  </svg>
);

export const UnitSilhouette: React.FC<{
  type: FormationType;
  side: Side;
  size?: number;
}> = ({ type, side, size = 44 }) => {
  const fill = side === 'AXIS' ? '#cbd5e1' : '#fca5a5';
  const stroke = side === 'AXIS' ? '#0f172a' : '#450a0a';

  if (type === 'CORAZZATA') {
    return (
      <svg width={size} height={size * 0.65} viewBox="0 0 64 42" aria-hidden="true">
        <rect x="38" y="10" width="24" height="4" rx="1" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <path d="M18 18 L22 7 L40 7 L43 18 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <polygon points="6,26 12,18 52,18 58,26 52,31 10,31" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <rect x="8" y="29" width="46" height="9" rx="4.5" fill="#1e293b" stroke={fill} strokeWidth="1.5" />
        <circle cx="15" cy="33.5" r="2.5" fill={fill} />
        <circle cx="25" cy="33.5" r="2.5" fill={fill} />
        <circle cx="35" cy="33.5" r="2.5" fill={fill} />
        <circle cx="45" cy="33.5" r="2.5" fill={fill} />
      </svg>
    );
  }

  if (type === 'MOTORIZZATA') {
    return (
      <svg width={size} height={size * 0.65} viewBox="0 0 64 42" aria-hidden="true">
        <polygon points="6,28 8,14 34,14 38,19 56,20 58,28" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <polygon points="34,15 38,19 31,19" fill="#0f172a" />
        <rect x="8" y="28" width="26" height="8" rx="4" fill="#1e293b" stroke={fill} strokeWidth="1.5" />
        <circle cx="14" cy="32" r="2" fill={fill} />
        <circle cx="21" cy="32" r="2" fill={fill} />
        <circle cx="28" cy="32" r="2" fill={fill} />
        <circle cx="49" cy="32" r="5" fill="#1e293b" stroke={fill} strokeWidth="2" />
        <circle cx="49" cy="32" r="1.8" fill={fill} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size * 0.65} viewBox="0 0 64 42" aria-hidden="true">
      <line x1="12" y1="36" x2="52" y2="8" stroke={fill} strokeWidth="3" strokeLinecap="round" />
      <line x1="52" y1="36" x2="12" y2="8" stroke={fill} strokeWidth="3" strokeLinecap="round" />
      <path d="M18 26 C18 13, 46 13, 46 26 L51 29 L13 29 Z" fill={fill} stroke={stroke} strokeWidth="1.8" />
    </svg>
  );
};

export const SectorBattlefieldBanner: React.FC<{
  sector: SectorId;
  season: Season;
  marker: number;
  currentCellName: string;
}> = ({ sector, season, marker, currentCellName }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const meta: Record<
    SectorId,
    {
      img: string;
      code: string;
      subtitle: string;
      coords: string;
      skyStart: string;
      skyEnd: string;
    }
  > = {
    NORD: {
      img: 'art/sector-nord.png',
      code: 'TEATRO OPERATIVO SETTENTRIONALE',
      subtitle: 'Baltico, Foreste della Carelia & Leningrado',
      coords: '59°56′N 30°18′E • GRUPPO D’ARMATE NORD',
      skyStart: season === 'INVERNO' ? '#1e293b' : '#1e3a4c',
      skyEnd: season === 'INVERNO' ? '#334155' : '#0f172a',
    },
    CENTRO: {
      img: 'art/sector-centro.png',
      code: 'TEATRO OPERATIVO CENTRALE',
      subtitle: 'Bielorussia, Smolensk & Direttrice di Mosca',
      coords: '55°45′N 37°37′E • GRUPPO D’ARMATE CENTRO',
      skyStart: season === 'INVERNO' ? '#1f2937' : '#3b2f26',
      skyEnd: season === 'INVERNO' ? '#374151' : '#1c1917',
    },
    SUD: {
      img: 'art/sector-sud.png',
      code: 'TEATRO OPERATIVO MERIDIONALE',
      subtitle: 'Steppe Ucraine, Stalingrado & Pozzi del Caucaso',
      coords: '48°42′N 44°31′E • GRUPPO D’ARMATE SUD',
      skyStart: season === 'INVERNO' ? '#1e293b' : '#451a03',
      skyEnd: season === 'INVERNO' ? '#334155' : '#1c1917',
    },
  };

  const info = meta[sector];

  return (
    <div className="warroom-sector-banner">
      {!imgFailed && (
        <img
          src={info.img}
          alt=""
          className="warroom-sector-banner-img"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      )}
      {/* Always render atmospheric WWII vector silhouette & topographic overlay */}
      <svg
        className="warroom-sector-banner-svg"
        viewBox="0 0 600 105"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`grad-${sector}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={info.skyStart} stopOpacity={imgFailed ? '0.95' : '0.55'} />
            <stop offset="100%" stopColor={info.skyEnd} stopOpacity={imgFailed ? '0.98' : '0.82'} />
          </linearGradient>
        </defs>
        <rect width="600" height="105" fill={`url(#grad-${sector})`} />
        {/* Topographic map grid lines */}
        <g stroke="rgba(245, 158, 11, 0.14)" strokeWidth="0.8">
          <line x1="0" y1="25" x2="600" y2="25" />
          <line x1="0" y1="55" x2="600" y2="55" />
          <line x1="0" y1="85" x2="600" y2="85" />
          <line x1="120" y1="0" x2="120" y2="105" />
          <line x1="260" y1="0" x2="260" y2="105" />
          <line x1="420" y1="0" x2="420" y2="105" />
        </g>
        {/* Distant horizon silhouettes (searchlights, ruins, pines, tanks) */}
        <line x1="480" y1="95" x2="430" y2="0" stroke="rgba(253, 224, 71, 0.12)" strokeWidth="18" />
        <line x1="520" y1="95" x2="570" y2="0" stroke="rgba(253, 224, 71, 0.10)" strokeWidth="14" />
        <path
          d="M0,105 L0,78 L45,74 L80,82 L130,68 L175,80 L230,72 L290,82 L350,65 L405,78 L465,62 L515,75 L560,64 L600,74 L600,105 Z"
          fill="rgba(10, 14, 20, 0.65)"
        />
      </svg>

      <div className="warroom-sector-banner-overlay">
        <div className="warroom-sector-stamp-row">
          <span className="warroom-coords-tag">{info.coords}</span>
          <span className="warroom-frontline-pill">
            📍 FRONTE ATTUALE: <strong>{currentCellName.toUpperCase()}</strong> (Casella {marker}/6)
          </span>
        </div>
        <div className="warroom-sector-title-row">
          <div>
            <div className="warroom-sector-kicker">{info.code}</div>
            <div className="warroom-sector-subtitle">{info.subtitle}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CardArtwork: React.FC<{
  type: CardType;
  side: Side;
  size?: number;
}> = ({ type, side, size = 38 }) => {
  const accent = side === 'AXIS' ? '#93c5fd' : '#fca5a5';

  if (type === 'EQUIPAGGIAMENTO_TERRA') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="4" y="6" width="40" height="36" rx="6" fill="#1e293b" stroke={accent} strokeWidth="1.5" />
        <line x1="22" y1="20" x2="41" y2="14" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M12 24 L28 20 L31 28 L10 28 Z" fill={accent} />
        <circle cx="19" cy="31" r="6" fill="#0f172a" stroke="#e2e8f0" strokeWidth="2.5" />
        <circle cx="19" cy="31" r="2" fill="#e2e8f0" />
        <line x1="6" y1="34" x2="14" y2="29" stroke="#cbd5e1" strokeWidth="2.5" />
      </svg>
    );
  }

  if (type === 'AEREO') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="4" y="6" width="40" height="36" rx="6" fill="#172554" stroke="#60a5fa" strokeWidth="1.5" />
        <path
          d="M24 9 L27 19 L41 23 L41 26 L27 25 L26 35 L31 38 L31 40 L24 39 L17 40 L17 38 L22 35 L21 25 L7 26 L7 23 L21 19 Z"
          fill="#e0f2fe"
          stroke="#1e3a8a"
          strokeWidth="1"
        />
      </svg>
    );
  }

  if (type === 'COMANDANTE') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="4" y="6" width="40" height="36" rx="6" fill="#2e1065" stroke="#c084fc" strokeWidth="1.5" />
        <path d="M10 22 C10 12, 38 12, 38 22 L34 27 L14 27 Z" fill="#ddd6fe" stroke="#4c1d95" strokeWidth="1.5" />
        <path d="M12 27 Q24 33 36 27 L34 31 Q24 36 14 31 Z" fill="#1e1b4b" stroke="#eab308" strokeWidth="1.5" />
        <polygon points="24,15 25.5,19 29.5,19 26.2,21.2 27.5,25 24,22.8 20.5,25 21.8,21.2 18.5,19 22.5,19" fill="#eab308" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="6" width="40" height="36" rx="6" fill="#451a03" stroke="#fbbf24" strokeWidth="1.5" />
      <rect x="12" y="10" width="24" height="28" rx="2" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
      <line x1="16" y1="16" x2="32" y2="16" stroke="#78350f" strokeWidth="2" />
      <line x1="16" y1="21" x2="30" y2="21" stroke="#78350f" strokeWidth="1.5" />
      <line x1="16" y1="26" x2="28" y2="26" stroke="#78350f" strokeWidth="1.5" />
      <circle cx="29" cy="31" r="4" fill="#dc2626" />
    </svg>
  );
};

export const CardIllustrationFrame: React.FC<{ card: Card }> = ({ card }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const imgByType: Record<CardType, string> = {
    EQUIPAGGIAMENTO_TERRA: 'art/card-armor.png',
    AEREO: 'art/card-air.png',
    COMANDANTE: 'art/card-commander.png',
    EVENTO: 'art/card-directive.png',
  };

  const labelByType: Record<CardType, string> = {
    EQUIPAGGIAMENTO_TERRA: 'ARSENALE CORAZZATO / ARTIGLIERIA',
    AEREO: 'SQUADRIGLIA AVIAZIONE',
    COMANDANTE: 'STATO MAGGIORE',
    EVENTO: 'DIRETTIVA OPERATIVA',
  };

  return (
    <div className={`warroom-card-art-box type-${card.type.toLowerCase()}`}>
      {!imgFailed && (
        <img
          src={imgByType[card.type]}
          alt=""
          className="warroom-card-art-img"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="warroom-card-art-vignette" />
      <div className="warroom-card-art-badges">
        <span className="warroom-card-year-stamp">ANNO {card.year}</span>
        <span className="warroom-card-cat-stamp">{labelByType[card.type]}</span>
      </div>
      <div className="warroom-card-art-icon-corner">
        <CardArtwork type={card.type} side={card.side} size={32} />
      </div>
    </div>
  );
};

export const CityLandmarkIcon: React.FC<{
  isObjective?: boolean;
  isBerlin?: boolean;
  isCaucasus?: boolean;
  isOil?: boolean;
}> = ({ isObjective, isBerlin, isCaucasus, isOil }) => {
  if (isBerlin) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20 H20 V12 L16 12 C16 8, 8 8, 8 12 L4 12 Z" fill="#94a3b8" stroke="#0f172a" strokeWidth="1.5" />
        <line x1="12" y1="4" x2="12" y2="9" stroke="#f8fafc" strokeWidth="2" />
        <polygon points="12,4 17,6 12,8" fill="#ef4444" />
      </svg>
    );
  }

  if (isCaucasus || isOil) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 20 L11 5 H13 L17 20" stroke="#fbbf24" strokeWidth="2" fill="none" />
        <line x1="8.5" y1="14" x2="15.5" y2="14" stroke="#fbbf24" strokeWidth="1.5" />
        <line x1="9.5" y1="9" x2="14.5" y2="9" stroke="#fbbf24" strokeWidth="1.5" />
        <circle cx="12" cy="3.5" r="2" fill="#ef4444" />
      </svg>
    );
  }

  if (isObjective) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <polygon
          points="12,2 15,8.5 22,9.3 17,14 18.4,21 12,17.5 5.6,21 7,14 2,9.3 9,8.5"
          fill="#eab308"
          stroke="#713f12"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" opacity="0.65">
      <rect x="6" y="10" width="12" height="10" fill="#64748b" />
      <polygon points="4,10 12,4 20,10" fill="#94a3b8" />
    </svg>
  );
};

export const DiceFaceSvg: React.FC<{ value: number; size?: number }> = ({ value, size = 44 }) => {
  const pipCoords: Record<number, [number, number][]> = {
    1: [[24, 24]],
    2: [
      [14, 14],
      [34, 34],
    ],
    3: [
      [14, 14],
      [24, 24],
      [34, 34],
    ],
    4: [
      [14, 14],
      [34, 14],
      [14, 34],
      [34, 34],
    ],
    5: [
      [14, 14],
      [34, 14],
      [24, 24],
      [14, 34],
      [34, 34],
    ],
    6: [
      [14, 12],
      [34, 12],
      [14, 24],
      [34, 24],
      [14, 36],
      [34, 36],
    ],
  };

  const pips = pipCoords[value] ?? pipCoords[1];

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="8"
        fill="#fef3c7"
        stroke="#b45309"
        strokeWidth="3"
      />
      {pips.map(([cx, cy], idx) => (
        <circle key={idx} cx={cx} cy={cy} r="4.2" fill="#78350f" />
      ))}
    </svg>
  );
};
