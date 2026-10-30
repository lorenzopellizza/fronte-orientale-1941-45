import React from 'react';
import { MAP_DATA, SECTORS } from '../data/map';
import {
  getFormationBaseAttack,
  getFormationBaseDefense,
} from '../engine/combat';
import { canEquipCardOnFormation } from '../engine/engine';
import {
  Card,
  Formation,
  GameState,
  LocationId,
  Season,
  SectorId,
  Side,
} from '../engine/types';

interface EasternFrontMapProps {
  state: GameState;
  season: Season;
  humanSide: Side;
  isAiTurn: boolean;
  selectedFormationId: string | null;
  movingFormationId: string | null;
  selectedCard: Card | undefined;
  validMoveDestinations: LocationId[];
  onSelectFormation: (f: Formation) => void;
  onStartMoveFormation: (f: Formation) => void;
  onMoveToSector: (sector: SectorId) => void;
  onAttackSector: (sector: SectorId) => void;
  onRetreatSector: (sector: SectorId) => void;
  onEquipFormation: (formationId: string, cardId: string) => void;
  onAssignCommander: (sector: SectorId, cardId: string) => void;
  onPlayAirlift: (sector: SectorId, cardId: string) => void;
  onQuickRepair: (formationId: string, points: 1 | 2) => void;
  onReconvertEquipment: (formationId: string) => void;
}

/**
 * Geographic coordinates on the 1400x760 Eastern Front Strategic Map
 * NORD: Baltic / Leningrad axis (top)
 * CENTRO: Warsaw / Minsk / Smolensk / Moscow axis (middle)
 * SUD: Ukraine / Kiev / Kharkov / Stalingrad / Caucasus axis (bottom)
 */
const NODE_COORDS: Record<SectorId, { x: number; y: number }[]> = {
  NORD: [
    { x: 210, y: 205 }, // 0: Königsberg
    { x: 345, y: 185 }, // 1: Confine baltico
    { x: 485, y: 160 }, // 2: Riga
    { x: 635, y: 145 }, // 3: Pskov
    { x: 780, y: 125 }, // 4: Luga
    { x: 925, y: 105 }, // 5: Leningrado ★
    { x: 1095, y: 110 }, // 6: Tichvin
  ],
  CENTRO: [
    { x: 130, y: 390 }, // 0: Berlino ★
    { x: 315, y: 395 }, // 1: Brest
    { x: 480, y: 380 }, // 2: Minsk
    { x: 650, y: 365 }, // 3: Smolensk
    { x: 815, y: 350 }, // 4: Vjaz'ma
    { x: 985, y: 335 }, // 5: Mosca ★
    { x: 1170, y: 325 }, // 6: Gor'kij
  ],
  SUD: [
    { x: 205, y: 560 }, // 0: Cracovia
    { x: 345, y: 565 }, // 1: Leopoli
    { x: 510, y: 555 }, // 2: Kiev
    { x: 685, y: 545 }, // 3: Charkov
    { x: 855, y: 575 }, // 4: Rostov
    { x: 1045, y: 535 }, // 5: Stalingrado ★
    { x: 1175, y: 650 }, // 6: Caucaso ★ (petrolio)
  ],
};

const SECTOR_META: Record<
  SectorId,
  {
    title: string;
    axisGroup: string;
    ussrFront: string;
    bannerImg: string;
    hudY: number;
  }
> = {
  NORD: {
    title: 'TEATRO NORD — BALTICO & LENINGRADO',
    axisGroup: 'Heeresgruppe Nord',
    ussrFront: 'Fronte di Leningrado',
    bannerImg: 'art/sector-nord.png',
    hudY: 18,
  },
  CENTRO: {
    title: 'TEATRO CENTRO — BIELORUSSIA & MOSCA',
    axisGroup: 'Heeresgruppe Mitte',
    ussrFront: 'Fronte Occidentale',
    bannerImg: 'art/sector-centro.png',
    hudY: 256,
  },
  SUD: {
    title: 'TEATRO SUD — UCRAINA, VOLGA & CAUCASO',
    axisGroup: 'Heeresgruppe Süd',
    ussrFront: 'Fronte Sud-Occidentale',
    bannerImg: 'art/sector-sud.png',
    hudY: 492,
  },
};

export const EasternFrontMap: React.FC<EasternFrontMapProps> = ({
  state,
  season,
  humanSide,
  isAiTurn,
  selectedFormationId,
  movingFormationId,
  selectedCard,
  validMoveDestinations,
  onSelectFormation,
  onStartMoveFormation,
  onMoveToSector,
  onAttackSector,
  onRetreatSector,
  onEquipFormation,
  onAssignCommander,
  onPlayAirlift,
  onQuickRepair,
  onReconvertEquipment,
}) => {
  const isWinter = season === 'INVERNO';

  // Compute frontline X/Y points between marker and marker+1 for each sector
  const getSectorFrontPoint = (sec: SectorId) => {
    const m = state.sectors[sec].marker;
    const pts = NODE_COORDS[sec];
    if (m >= 6) {
      return { x: pts[6].x + 55, y: pts[6].y };
    }
    const c1 = pts[m];
    const c2 = pts[m + 1];
    return {
      x: (c1.x + c2.x) / 2,
      y: (c1.y + c2.y) / 2,
    };
  };

  const fNord = getSectorFrontPoint('NORD');
  const fCentro = getSectorFrontPoint('CENTRO');
  const fSud = getSectorFrontPoint('SUD');

  // Smooth SVG Cubic Bezier Frontline Curve from Baltic Sea (top) to Black Sea / Caucasus (bottom)
  const frontLineCurve = `M ${fNord.x - 20},0
    L ${fNord.x},${fNord.y}
    C ${fNord.x + 25},${(fNord.y + fCentro.y) / 2} ${fCentro.x - 25},${(fNord.y + fCentro.y) / 2} ${fCentro.x},${fCentro.y}
    C ${fCentro.x + 25},${(fCentro.y + fSud.y) / 2} ${fSud.x - 25},${(fCentro.y + fSud.y) / 2} ${fSud.x},${fSud.y}
    L ${fSud.x + 15},760`;

  const axisTerritoryPath = `${frontLineCurve} L 0,760 L 0,0 Z`;
  const ussrTerritoryPath = `${frontLineCurve} L 1400,760 L 1400,0 Z`;

  const renderUnitSilhouette = (type: Formation['type']) => {
    if (type === 'CORAZZATA') {
      return (
        <svg width="26" height="16" viewBox="0 0 32 20" aria-hidden="true">
          <path
            d="M3,14 L29,14 L26,18 L6,18 Z M7,9 L24,9 L26,14 L5,14 Z M11,5 L20,5 L21,9 L10,9 Z M20,6.5 L31,6.5 L31,8 L20,8 Z"
            fill="currentColor"
          />
        </svg>
      );
    }
    if (type === 'MOTORIZZATA') {
      return (
        <svg width="26" height="16" viewBox="0 0 32 20" aria-hidden="true">
          <path
            d="M3,8 L21,8 L21,14 L28,14 L29,10 L23,10 L23,8 L29,8 L30,15 L2,15 Z"
            fill="currentColor"
          />
          <circle cx="7" cy="16" r="2.8" fill="currentColor" />
          <circle cx="16" cy="16" r="2.8" fill="currentColor" />
          <circle cx="25" cy="16" r="2.8" fill="currentColor" />
        </svg>
      );
    }
    return (
      <svg width="22" height="16" viewBox="0 0 28 20" aria-hidden="true">
        <rect
          x="3"
          y="3"
          width="22"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <line x1="3" y1="3" x2="25" y2="17" stroke="currentColor" strokeWidth="2" />
        <line x1="25" y1="3" x2="3" y2="17" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className={`war-map-stage ${isWinter ? 'winter-stage' : 'summer-stage'}`}>
      {/* LAYER 1: TOPOGRAPHIC & CARTOGRAPHIC SVG MAP OF EASTERN EUROPE */}
      <svg
        className="war-map-svg"
        viewBox="0 0 1400 760"
        preserveAspectRatio="xMidYMid slice"
        aria-label="Mappa Strategica del Fronte Orientale 1941-1945"
      >
        <defs>
          {/* Topographic Parchment / War Table Gradients */}
          <linearGradient id="landGradSummer" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e2420" />
            <stop offset="45%" stopColor="#262c23" />
            <stop offset="100%" stopColor="#2c251e" />
          </linearGradient>
          <linearGradient id="landGradWinter" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e2936" />
            <stop offset="50%" stopColor="#283546" />
            <stop offset="100%" stopColor="#1f2937" />
          </linearGradient>

          {/* Territorial Control Tint Gradients */}
          <linearGradient id="axisTerritoryGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.32" />
            <stop offset="75%" stopColor="#3b82f6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.38" />
          </linearGradient>
          <linearGradient id="ussrTerritoryGrad" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#7f1d1d" stopOpacity="0.36" />
            <stop offset="75%" stopColor="#dc2626" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.38" />
          </linearGradient>

          {/* Diagonal Hatching Pattern for Occupied Territory */}
          <pattern id="axisHatch" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="16" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.12" />
          </pattern>
          <pattern id="ussrHatch" width="16" height="16" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="16" stroke="#f87171" strokeWidth="1" strokeOpacity="0.12" />
          </pattern>

          {/* Map Grid Pattern */}
          <pattern id="cartoGrid" width="70" height="70" patternUnits="userSpaceOnUse">
            <path
              d="M 70 0 L 0 0 0 70"
              fill="none"
              stroke="rgba(212, 185, 130, 0.07)"
              strokeWidth="1"
            />
          </pattern>

          <filter id="frontGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Base Topographic Terrain */}
        <rect
          x="0"
          y="0"
          width="1400"
          height="760"
          fill={isWinter ? 'url(#landGradWinter)' : 'url(#landGradSummer)'}
        />

        {/* Subtle Sector Battlefield Painting Underlays */}
        <image
          href={SECTOR_META.NORD.bannerImg}
          x="0"
          y="0"
          width="1400"
          height="250"
          preserveAspectRatio="xMidYMid slice"
          opacity={isWinter ? '0.18' : '0.22'}
        />
        <image
          href={SECTOR_META.CENTRO.bannerImg}
          x="0"
          y="250"
          width="1400"
          height="255"
          preserveAspectRatio="xMidYMid slice"
          opacity={isWinter ? '0.18' : '0.22'}
        />
        <image
          href={SECTOR_META.SUD.bannerImg}
          x="0"
          y="505"
          width="1400"
          height="255"
          preserveAspectRatio="xMidYMid slice"
          opacity={isWinter ? '0.18' : '0.22'}
        />

        {/* Geographic Seas: Baltic Sea (North-West) & Black Sea / Sea of Azov / Caspian (South) */}
        <path
          d="M 0,0 L 620,0 L 585,48 L 490,65 L 445,115 L 385,120 L 310,145 L 185,165 L 90,145 L 0,155 Z"
          fill={isWinter ? '#162536' : '#0f2133'}
          stroke="rgba(147, 197, 253, 0.25)"
          strokeWidth="1.5"
        />
        <text
          x="255"
          y="78"
          fill="rgba(147, 197, 253, 0.35)"
          fontSize="14"
          fontWeight="800"
          letterSpacing="5"
        >
          MAR BALTICO
        </text>

        {/* Lake Ladoga (North of Leningrad) */}
        <ellipse
          cx="965"
          cy="48"
          rx="55"
          ry="26"
          fill={isWinter ? '#1e3448' : '#0f2133'}
          stroke="rgba(147, 197, 253, 0.22)"
        />
        <text x="935" y="52" fill="rgba(147, 197, 253, 0.4)" fontSize="9" letterSpacing="1">
          LAGO LADOGA
        </text>

        {/* Black Sea & Sea of Azov */}
        <path
          d="M 410,760 L 450,695 L 560,675 L 650,695 L 735,645 L 835,620 L 860,655 L 920,695 L 960,760 Z"
          fill="#0c1d2e"
          stroke="rgba(147, 197, 253, 0.25)"
          strokeWidth="1.5"
        />
        <text
          x="595"
          y="735"
          fill="rgba(147, 197, 253, 0.35)"
          fontSize="14"
          fontWeight="800"
          letterSpacing="5"
        >
          MAR NERO
        </text>

        {/* Major Historical Rivers: Vistula, Dvina, Dnieper, Don, Volga */}
        <g
          fill="none"
          stroke={isWinter ? 'rgba(186, 230, 253, 0.35)' : 'rgba(56, 189, 248, 0.28)'}
          strokeWidth="3"
          strokeLinecap="round"
        >
          {/* Dvina River */}
          <path d="M 465,115 Q 535,175 610,225" />
          {/* Dnieper River (Kiev bend) */}
          <path d="M 620,295 Q 525,435 515,555 Q 585,610 535,680" />
          {/* Don River (Rostov-Stalingrad bend) */}
          <path d="M 855,420 Q 935,505 975,540 Q 915,585 845,620" />
          {/* Volga River (Gorky - Stalingrad - Caspian) */}
          <path d="M 960,210 Q 1085,260 1170,325 Q 1120,445 1045,535 Q 1125,610 1245,675" strokeWidth="4.5" />
        </g>

        {/* River Labels */}
        <g fill="rgba(147, 197, 253, 0.38)" fontSize="9" fontStyle="italic" fontWeight="600">
          <text x="530" y="485">Fiume Dnepr</text>
          <text x="915" y="495">Fiume Don</text>
          <text x="1110" y="435">Fiume Volga</text>
        </g>

        {/* Pripyat Marshes & Caucasus Mountain Ridge */}
        <text
          x="395"
          y="468"
          fill="rgba(163, 177, 138, 0.32)"
          fontSize="10"
          letterSpacing="3"
          fontWeight="700"
        >
          PALUDI DEL PRIPJAT
        </text>
        <text
          x="1015"
          y="715"
          fill="rgba(214, 199, 169, 0.4)"
          fontSize="11"
          letterSpacing="4"
          fontWeight="800"
        >
          ▲ CATENA DEL CAUCASO ▲
        </text>

        {/* Cartographic Grid Overlay */}
        <rect x="0" y="0" width="1400" height="760" fill="url(#cartoGrid)" />

        {/* Dynamic Territorial Control Polygons (Axis West vs USSR East) */}
        <path d={axisTerritoryPath} fill="url(#axisTerritoryGrad)" />
        <path d={axisTerritoryPath} fill="url(#axisHatch)" />
        <path d={ussrTerritoryPath} fill="url(#ussrTerritoryGrad)" />
        <path d={ussrTerritoryPath} fill="url(#ussrHatch)" />

        {/* Sector Theatre Divider Lines */}
        <line
          x1="40"
          y1="252"
          x2="1360"
          y2="252"
          stroke="rgba(212, 185, 130, 0.22)"
          strokeWidth="1.5"
          strokeDasharray="10 8"
        />
        <line
          x1="40"
          y1="495"
          x2="1360"
          y2="495"
          stroke="rgba(212, 185, 130, 0.22)"
          strokeWidth="1.5"
          strokeDasharray="10 8"
        />

        {/* Inter-Sector Adjacent Railway Connections (Nord-Centro, Centro-Sud) */}
        {[1, 2, 3, 4, 5].map((idx) => (
          <g key={`cross_rail_${idx}`} stroke="rgba(212, 185, 130, 0.14)" strokeWidth="1.5" strokeDasharray="4 6">
            <line
              x1={NODE_COORDS.NORD[idx].x}
              y1={NODE_COORDS.NORD[idx].y}
              x2={NODE_COORDS.CENTRO[idx].x}
              y2={NODE_COORDS.CENTRO[idx].y}
            />
            <line
              x1={NODE_COORDS.CENTRO[idx].x}
              y1={NODE_COORDS.CENTRO[idx].y}
              x2={NODE_COORDS.SUD[idx].x}
              y2={NODE_COORDS.SUD[idx].y}
            />
          </g>
        ))}

        {/* DYNAMIC FRONTLINE CURVE ("LINEA DEL FRONTE") */}
        <path
          d={frontLineCurve}
          fill="none"
          stroke="rgba(0, 0, 0, 0.75)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d={frontLineCurve}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="4.5"
          strokeDasharray="14 8"
          filter="url(#frontGlow)"
        />
        <path
          d={frontLineCurve}
          fill="none"
          stroke="#fef3c7"
          strokeWidth="1.5"
        />

        {/* RAILWAY SUPPLY LINES & 21 GEOGRAPHIC CITIES */}
        {SECTORS.map((secId) => {
          const secState = state.sectors[secId];
          const cells = MAP_DATA[secId].cells;
          const coords = NODE_COORDS[secId];
          const fPt = getSectorFrontPoint(secId);

          return (
            <g key={`map_sec_${secId}`}>
              {/* Railway segments between cities 0..6 */}
              {coords.map((pt, i) => {
                if (i === coords.length - 1) return null;
                const nextPt = coords[i + 1];
                const isAxisLine = i < secState.marker;
                const isContestedSegment = i === secState.marker;
                const isOverextended =
                  isAxisLine &&
                  state.config.modules.supply &&
                  i >= state.config.supply.axisFreeUntil;

                return (
                  <g key={`rail_${secId}_${i}`}>
                    {/* Railway bed */}
                    <line
                      x1={pt.x}
                      y1={pt.y}
                      x2={nextPt.x}
                      y2={nextPt.y}
                      stroke="rgba(0,0,0,0.75)"
                      strokeWidth="7"
                    />
                    {/* Active Supply Track */}
                    <line
                      x1={pt.x}
                      y1={pt.y}
                      x2={nextPt.x}
                      y2={nextPt.y}
                      stroke={
                        isContestedSegment
                          ? '#f59e0b'
                          : isOverextended
                          ? '#fb923c'
                          : isAxisLine
                          ? '#60a5fa'
                          : '#f87171'
                      }
                      strokeWidth="3.2"
                      strokeDasharray={isContestedSegment ? '7 5' : '10 4'}
                    />
                  </g>
                );
              })}

              {/* Frontline Clash Burst at the exact combat line */}
              <g transform={`translate(${fPt.x}, ${fPt.y})`}>
                <circle r="16" fill="rgba(245, 158, 11, 0.25)" />
                <circle r="9" fill="#b91c1c" stroke="#fde68a" strokeWidth="2" />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="900"
                  fill="#fef3c7"
                >
                  ⚔
                </text>
              </g>

              {/* City Nodes 0..6 */}
              {cells.map((cell, idx) => {
                const pt = coords[idx];
                const isAxisOwned = idx <= secState.marker;
                const isFrontCity = idx === secState.marker;
                const isNextTarget =
                  state.activeSide === 'AXIS'
                    ? idx === secState.marker + 1
                    : idx === secState.marker;
                const isMajor = cell.isObjectiveCity || cell.isBerlin || cell.isOil;

                return (
                  <g
                    key={`node_${secId}_${idx}`}
                    transform={`translate(${pt.x}, ${pt.y})`}
                  >
                    {/* Outer ring for Objective / Frontline City */}
                    {isMajor && (
                      <circle
                        r="24"
                        fill="rgba(245, 158, 11, 0.14)"
                        stroke="#fbbf24"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                      />
                    )}
                    {isFrontCity && (
                      <circle
                        r="20"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                      />
                    )}
                    {isNextTarget && (
                      <circle
                        r="22"
                        fill="none"
                        stroke="rgba(239, 68, 68, 0.65)"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* City Fortification / Node Disc */}
                    <circle
                      r={isMajor ? 15 : 11}
                      fill={isAxisOwned ? '#1e3a5f' : '#7f1d1d'}
                      stroke={
                        isFrontCity
                          ? '#fde047'
                          : isMajor
                          ? '#f59e0b'
                          : isAxisOwned
                          ? '#93c5fd'
                          : '#fca5a5'
                      }
                      strokeWidth={isFrontCity || isMajor ? 3 : 2}
                    />

                    {/* City Icon / Index */}
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fontSize={isMajor ? '12' : '10'}
                      fontWeight="900"
                      fill={isMajor ? '#fef08a' : '#f8fafc'}
                    >
                      {cell.isBerlin
                        ? '🦅'
                        : cell.isOil
                        ? '🛢'
                        : cell.isObjectiveCity
                        ? '★'
                        : idx}
                    </text>

                    {/* City Nameplate Banner */}
                    <g transform={`translate(0, ${isMajor ? 29 : 24})`}>
                      <rect
                        x={-54}
                        y={-11}
                        width={108}
                        height={18}
                        rx={4}
                        fill="rgba(10, 14, 20, 0.88)"
                        stroke={
                          isFrontCity
                            ? '#eab308'
                            : isMajor
                            ? 'rgba(245, 158, 11, 0.65)'
                            : 'rgba(148, 163, 184, 0.35)'
                        }
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="2"
                        textAnchor="middle"
                        fontSize={isMajor ? '10.5' : '9.5'}
                        fontWeight={isMajor || isFrontCity ? '800' : '600'}
                        fill={
                          isFrontCity
                            ? '#fef08a'
                            : isMajor
                            ? '#fcd34d'
                            : isAxisOwned
                            ? '#bfdbfe'
                            : '#fecaca'
                        }
                      >
                        {cell.name.replace(' (confine)', '').replace(' (petrolio)', '')}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* LAYER 2: INTERACTIVE SECTOR COMMAND BANDS & 3D MILITARY COUNTERS ON THE MAP */}
      <div className="war-map-overlay-lanes">
        {SECTORS.map((secId) => {
          const secState = state.sectors[secId];
          const meta = SECTOR_META[secId];
          const cells = MAP_DATA[secId].cells;
          const axisUnits = state.formations.filter(
            (f) => f.side === 'AXIS' && f.location === secId
          );
          const ussrUnits = state.formations.filter(
            (f) => f.side === 'USSR' && f.location === secId
          );

          const eligibleAttackers = state.formations.filter(
            (f) =>
              f.side === state.activeSide &&
              f.location === secId &&
              !f.exhausted &&
              !f.encircled
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
            ((state.activeSide === 'AXIS' &&
              secState.marker > 0 &&
              axisUnits.length > 0) ||
              (state.activeSide === 'USSR' &&
                secState.marker < 6 &&
                ussrUnits.length > 0));

          const canMoveHere =
            !isAiTurn &&
            state.phase === 'ORDERS' &&
            Boolean(movingFormationId) &&
            validMoveDestinations.includes(secId);

          const canAssignCommanderHere =
            !isAiTurn &&
            state.phase === 'ORDERS' &&
            selectedCard?.type === 'COMANDANTE';

          const canPlayAirliftHere =
            !isAiTurn &&
            state.phase === 'ORDERS' &&
            selectedCard?.type === 'EVENTO' &&
            selectedCard.templateId === 'axis_ponte_aereo_42';

          const axisAtkSum = axisUnits
            .filter((u) => !u.exhausted && !u.encircled)
            .reduce(
              (s, u) =>
                s + getFormationBaseAttack(u, state.config.modules.experience),
              0
            );
          const axisDefSum = axisUnits.reduce(
            (s, u) =>
              s + getFormationBaseDefense(u, state.config.modules.experience),
            0
          );
          const ussrAtkSum = ussrUnits
            .filter((u) => !u.exhausted && !u.encircled)
            .reduce(
              (s, u) =>
                s + getFormationBaseAttack(u, state.config.modules.experience),
              0
            );
          const ussrDefSum = ussrUnits.reduce(
            (s, u) =>
              s + getFormationBaseDefense(u, state.config.modules.experience),
            0
          );

          // Check salient / pocket warning
          const salientThreat = MAP_DATA[secId].adjacent.some(
            (adj) =>
              Math.abs(state.sectors[adj].marker - secState.marker) >=
              state.config.encirclement.threatGap
          );

          const renderMapCounter = (f: Formation) => {
            const isSelected =
              selectedFormationId === f.id || movingFormationId === f.id;
            const atk = getFormationBaseAttack(
              f,
              state.config.modules.experience
            );
            const def = getFormationBaseDefense(
              f,
              state.config.modules.experience
            );
            const canEquip =
              !isAiTurn &&
              state.phase === 'ORDERS' &&
              f.side === state.activeSide &&
              selectedCard?.type === 'EQUIPAGGIAMENTO_TERRA' &&
              !f.encircled &&
              canEquipCardOnFormation(selectedCard, f);

            const isMyUnit =
              !isAiTurn &&
              state.phase === 'ORDERS' &&
              f.side === state.activeSide;

            return (
              <div
                key={f.id}
                style={{ viewTransitionName: `unit-${f.id}` } as React.CSSProperties}
                className={`map-chit ${f.side === 'AXIS' ? 'axis-chit' : 'ussr-chit'} ${
                  isSelected ? 'chit-selected' : ''
                } ${f.exhausted ? 'chit-exhausted' : ''} ${
                  f.encircled ? 'chit-encircled' : ''
                } ${canEquip ? 'chit-equippable' : ''}`}
                onClick={() => {
                  if (canEquip && selectedCard) {
                    onEquipFormation(f.id, selectedCard.id);
                    return;
                  }
                  onSelectFormation(f);
                }}
              >
                {/* Top Strip: Veterancy + NATO / Silhouette + Strength Pips */}
                <div className="chit-top-row">
                  <span className="chit-vet" title={`Esperienza: ${f.level} (${f.xp} XP)`}>
                    {f.level === 'ELITE'
                      ? '★★'
                      : f.level === 'VETERANA'
                      ? '★'
                      : '•'}
                  </span>
                  <span className="chit-silhouette">
                    {renderUnitSilhouette(f.type)}
                  </span>
                  <div className="chit-pips" title={`Forza: ${f.strength}/${f.maxStrength}`}>
                    {Array.from({ length: f.maxStrength }).map((_, i) => (
                      <span
                        key={i}
                        className={`chit-pip ${i < f.strength ? 'filled' : 'empty'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Unit Historical Name */}
                <div className="chit-name" title={f.name}>
                  {f.name}
                </div>

                {/* Equipment & Keywords Strip */}
                {(f.equipment || f.keywords.length > 0 || f.encircled) && (
                  <div className="chit-tags-row">
                    {f.equipment && (
                      <span className="chit-eq-badge" title={`Equipaggiamento: ${f.equipment.name}`}>
                        ⚙ {f.equipment.name}
                      </span>
                    )}
                    {f.encircled && <span className="chit-sacca-badge">⛓ SACCA</span>}
                    {f.keywords.map((kw) => (
                      <span key={kw} className="chit-kw-badge">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bottom Stamped Wargame Numbers: ATT - DEF - STR */}
                <div className="chit-numbers-bar">
                  <span className="chit-num atk" title="Valore di Attacco">
                    ⚔{atk}
                  </span>
                  <span className="chit-num def" title="Valore di Difesa">
                    🛡{def}
                  </span>
                  <span className="chit-num str" title="Forza attuale">
                    ♥{f.strength}
                  </span>
                </div>

                {/* Direct Action Overlay Popover when Selected or Equippable */}
                {canEquip && selectedCard && (
                  <button
                    type="button"
                    className="chit-equip-cta"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEquipFormation(f.id, selectedCard.id);
                    }}
                  >
                    🔧 Monta {selectedCard.name} ({selectedCard.cost} PP)
                  </button>
                )}

                {isSelected && isMyUnit && !canEquip && (
                  <div
                    className="chit-action-popover"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!f.encircled && (
                      <button
                        type="button"
                        className="chit-act-btn move"
                        onClick={() => onStartMoveFormation(f)}
                        title="Muovi questa formazione verso un altro Settore o la Riserva (1 Ordine)"
                      >
                        ⇄ Muovi
                      </button>
                    )}
                    {!f.encircled &&
                      f.strength < f.maxStrength &&
                      state.pp[state.activeSide] >= 1 && (
                        <button
                          type="button"
                          className="chit-act-btn heal"
                          onClick={() => onQuickRepair(f.id, 1)}
                          title="Ripristina +1 Forza senza perdere esperienza (1 PP, 1 Ordine)"
                        >
                          ✚1F (1PP)
                        </button>
                      )}
                    {!f.encircled &&
                      f.maxStrength - f.strength >= 2 &&
                      state.pp[state.activeSide] >= 2 && (
                        <button
                          type="button"
                          className="chit-act-btn heal2"
                          onClick={() => onQuickRepair(f.id, 2)}
                          title="Ripristina +2 Forza (2 PP, 1 Ordine, -1 livello esperienza)"
                        >
                          ✚2F (2PP)
                        </button>
                      )}
                    {f.equipment && (
                      <button
                        type="button"
                        className="chit-act-btn scrap"
                        onClick={() => onReconvertEquipment(f.id)}
                        title="Smonta equipaggiamento per ottenere PP gratuiti"
                      >
                        ♻ +{Math.max(1, Math.ceil(f.equipment.cost / 2))}PP
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          };

          return (
            <section
              key={secId}
              className={`map-sector-band ${canMoveHere ? 'sector-drop-target' : ''}`}
              aria-label={`Settore ${secId}`}
            >
              {/* TOP FLOATING SECTOR PLAQUE (Name, Frontline City, Battle Buttons) */}
              <div className="map-sector-plaque">
                <div className="plaque-left">
                  <span className="plaque-sector-tag">{secId}</span>
                  <span className="plaque-title">{meta.title}</span>
                  <span className="plaque-front-location">
                    📍 Fronte: <strong>{cells[secState.marker].name}</strong> ({secState.marker}/6)
                  </span>
                  {salientThreat && (
                    <span className="plaque-salient-warning" title="Divario ≥ 2 caselle col settore adiacente: rischio di accerchiamento!">
                      ⚠️ SALIENTE ESPOSTO
                    </span>
                  )}
                  {secState.retreatedSidesThisTurn.length > 0 && (
                    <span className="plaque-retreat-badge">
                      🛡 Linea Accorciata (+1 DIF)
                    </span>
                  )}
                </div>

                {/* Direct Map Sector Command Buttons */}
                <div className="plaque-actions">
                  {canMoveHere && (
                    <button
                      type="button"
                      className="map-action-btn move-here"
                      onClick={() => onMoveToSector(secId)}
                    >
                      📥 Sposta Qui (1 Ordine)
                    </button>
                  )}

                  {canAssignCommanderHere && selectedCard && (
                    <button
                      type="button"
                      className="map-action-btn cmd-here"
                      onClick={() => onAssignCommander(secId, selectedCard.id)}
                    >
                      🎖 Assegna {selectedCard.name} ({selectedCard.cost} PP)
                    </button>
                  )}

                  {canPlayAirliftHere && selectedCard && (
                    <button
                      type="button"
                      className="map-action-btn cmd-here"
                      onClick={() => onPlayAirlift(secId, selectedCard.id)}
                    >
                      ✈ Ponte Aereo in {secId} (2 PP)
                    </button>
                  )}

                  {canAttackHere && (
                    <button
                      type="button"
                      className="map-action-btn attack-here"
                      onClick={() => onAttackSector(secId)}
                    >
                      ⚔ OFFENSIVA IN {secId} (
                      {state.activeSide === 'AXIS'
                        ? `ATT ${axisAtkSum} vs DIF ${ussrDefSum}`
                        : `ATT ${ussrAtkSum} vs DIF ${axisDefSum}`}
                      )
                    </button>
                  )}

                  {canRetreatHere && (
                    <button
                      type="button"
                      className="map-action-btn retreat-here"
                      onClick={() => onRetreatSector(secId)}
                      title="Arretra di 1 casella per accorciare il fronte (+1 Difesa in questo turno)"
                    >
                      ↩ Ripiega (+1 DIF)
                    </button>
                  )}
                </div>
              </div>

              {/* TWO OPPOSING ARMYDEPLOYMENTS DIRECTLY ON THE MAP SECTOR */}
              <div className="map-sector-forces">
                {/* WEST / AXIS FORCES */}
                <div className="map-force-group axis-force-group">
                  <div className="force-group-header">
                    <span className="force-group-title">
                      🦅 {meta.axisGroup} • ⚔{axisAtkSum} 🛡{axisDefSum}
                    </span>
                    {secState.axisCommander && (
                      <span
                        className="map-commander-pill axis"
                        title={secState.axisCommander.effectText}
                      >
                        🎖 {secState.axisCommander.name}
                      </span>
                    )}
                    {state.config.modules.supply &&
                      secState.marker > state.config.supply.axisFreeUntil && (
                        <span className="map-supply-pill">
                          ⛽ Logistica −{secState.marker - state.config.supply.axisFreeUntil} ATT
                        </span>
                      )}
                  </div>
                  <div className="map-chits-row">
                    {axisUnits.length === 0 ? (
                      <span className="map-empty-sector">Nessuna divisione schierata</span>
                    ) : (
                      axisUnits.map((f) => renderMapCounter(f))
                    )}
                  </div>
                </div>

                {/* EAST / USSR FORCES */}
                <div className="map-force-group ussr-force-group">
                  <div className="force-group-header">
                    <span className="force-group-title">
                      ⭐ {meta.ussrFront} • ⚔{ussrAtkSum} 🛡{ussrDefSum}
                    </span>
                    {secState.ussrCommander && (
                      <span
                        className="map-commander-pill ussr"
                        title={secState.ussrCommander.effectText}
                      >
                        🎖 {secState.ussrCommander.name}
                      </span>
                    )}
                    {state.config.modules.supply &&
                      (state.config.supply.ussrPenalty[secState.marker] ?? 0) > 0 && (
                        <span className="map-supply-pill">
                          ⛽ Logistica −{state.config.supply.ussrPenalty[secState.marker]} ATT
                        </span>
                      )}
                  </div>
                  <div className="map-chits-row">
                    {ussrUnits.length === 0 ? (
                      <span className="map-empty-sector">Nessuna armata schierata</span>
                    ) : (
                      ussrUnits.map((f) => renderMapCounter(f))
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
