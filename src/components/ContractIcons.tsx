import React from 'react';
import { cn } from '../lib/utils';

export const CONTRACT_ICONS: Record<string, React.ReactNode> = {
  CALL: <ContractIcon type="rise" />,
  PUT: <ContractIcon type="fall" />,
  CALLE: <ContractIcon type="rise" />,
  PUTE: <ContractIcon type="fall" />,
  RISE: <ContractIcon type="rise" />,
  FALL: <ContractIcon type="fall" />,
  HIGHER: <ContractIcon type="rise" />,
  LOWER: <ContractIcon type="fall" />,
  MATCH: <ContractIcon type="matches" />,
  DIFF: <ContractIcon type="differs" />,
  DIFFERS: <ContractIcon type="differs" />,
  DIGITMATCH: <ContractIcon type="matches" />,
  DIGITDIFF: <ContractIcon type="differs" />,
  DIGITEVEN: <ContractIcon type="even" />,
  DIGITODD: <ContractIcon type="odd" />,
  DIGITOVER: <ContractIcon type="over" />,
  DIGITUNDER: <ContractIcon type="under" />,
  ACCU: <ContractIcon type="accu" />,
  ACCUMULATOR: <ContractIcon type="accu" />,
  UNDER: <ContractIcon type="under" />,
  OVER: <ContractIcon type="over" />,
  EVEN: <ContractIcon type="even" />,
  ODD: <ContractIcon type="odd" />,
  ONETOUCH: <ContractIcon type="onetouch" />,
  NOTOUCH: <ContractIcon type="notouch" />,
  EXPIRYRANGE: <ContractIcon type="expiryrange" />,
  EXPIRYMISS: <ContractIcon type="expirymiss" />,
  RANGE: <ContractIcon type="range" />,
  UPORDOWN: <ContractIcon type="upordown" />,
  ASIANU: <ContractIcon type="asianu" />,
  ASIAND: <ContractIcon type="asiand" />,
  RESETCALL: <ContractIcon type="rise" />,
  RESETPUT: <ContractIcon type="fall" />,
  TICKHIGH: <ContractIcon type="rise" />,
  TICKLOW: <ContractIcon type="fall" />,
  RUNHIGH: <ContractIcon type="runhigh" />,
  RUNLOW: <ContractIcon type="runlow" />,
  RUN_HIGH: <ContractIcon type="runhigh" />,
  RUN_LOW: <ContractIcon type="runlow" />,
  'ONLY UPS': <ContractIcon type="onlyups" />,
  'ONLY DOWNS': <ContractIcon type="onlydowns" />,
  ONLYUPS: <ContractIcon type="onlyups" />,
  ONLYDOWNS: <ContractIcon type="onlydowns" />,
};

interface ContractIconProps {
  type: string;
  className?: string;
}

export function ContractIcon({ type, className }: ContractIconProps) {
  const t = (type || '').toLowerCase().replace(/\s+/g, '');

  // Handle Dual contract types with paired icons
  if (t === 'dualo5/u4') {
    return (
      <div className={cn('flex items-center gap-0.5 shrink-0', className)}>
        <ContractIcon type="over" className="w-4 h-4" />
        <ContractIcon type="under" className="w-4 h-4" />
      </div>
    );
  }
  if (t === 'dualh/l') {
    return (
      <div className={cn('flex items-center gap-0.5 shrink-0', className)}>
        <ContractIcon type="rise" className="w-4 h-4" />
        <ContractIcon type="fall" className="w-4 h-4" />
      </div>
    );
  }

  // Normalize types
  let normalizedType = t;
  if (
    t === 'rise' ||
    t === 'call' ||
    t === 'higher' ||
    t === 'asianu' ||
    t === 'resetcall' ||
    t === 'tickhigh'
  ) {
    normalizedType = 'rise';
  }
  if (
    t === 'fall' ||
    t === 'put' ||
    t === 'lower' ||
    t === 'asiand' ||
    t === 'resetput' ||
    t === 'ticklow'
  ) {
    normalizedType = 'fall';
  }
  if (
    t === 'runhigh' ||
    t === 'onlyups' ||
    t === 'onlyup' ||
    t === 'run_high' ||
    t === 'run_high_low'
  ) {
    normalizedType = 'runhigh';
  }
  if (
    t === 'runlow' ||
    t === 'onlydowns' ||
    t === 'onlydown' ||
    t === 'run_low' ||
    t === 'run_low_high'
  ) {
    normalizedType = 'runlow';
  }
  if (t === 'match' || t === 'digitmatch' || t === 'matches') normalizedType = 'matches';
  if (t === 'diff' || t === 'differs' || t === 'digitdiff' || t === 'digitdiffer') {
    normalizedType = 'differs';
  }
  if (t === 'even' || t === 'digiteven') normalizedType = 'even';
  if (t === 'odd' || t === 'digitodd') normalizedType = 'odd';
  if (t === 'over' || t === 'digitover') normalizedType = 'over';
  if (t === 'under' || t === 'digitunder') normalizedType = 'under';
  if (t === 'accu' || t === 'accumulator') normalizedType = 'accu';

  return (
    <div className={cn('contract-icon-box flex items-center justify-center', className)}>
      {normalizedType === 'runhigh' && (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect x="2" y="17" width="3" height="3" fill="#94b9be" />
          <rect x="7" y="14" width="3" height="6" fill="#94b9be" />
          <rect x="12" y="10" width="3" height="10" fill="#94b9be" />
          <rect x="17" y="4" width="3" height="16" fill="#94b9be" />
          <path d="M5,13 L13,5 L10,5 L10,3 L16,3 L16,9 L14,9 L14,6 L6,14 Z" fill="#ff4d4d" />
        </svg>
      )}
      {normalizedType === 'runlow' && (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect x="2" y="4" width="3" height="3" fill="#94b9be" />
          <rect x="7" y="4" width="3" height="7" fill="#94b9be" />
          <rect x="12" y="4" width="3" height="11" fill="#94b9be" />
          <rect x="17" y="4" width="3" height="17" fill="#94b9be" />
          <path d="M5,11 L13,19 L10,19 L10,21 L16,21 L16,15 L14,15 L14,18 L6,10 Z" fill="#ff4d4d" />
        </svg>
      )}
      {normalizedType === 'fall' && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path className="stroke-broken" d="M12 12 L16 16" />
          <path className="stroke-red" d="M17 17 L36 36 H26" />
          <path className="stroke-red" d="M36 36 V26" />
        </svg>
      )}
      {normalizedType === 'accu' && <div className="accu" />}
      {normalizedType === 'under' && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path className="stroke-red" d="M12 12 L36 36 L26 36" />
          <path className="stroke-red" d="M36 36 L36 26" />
          <path className="stroke-barrier" d="M8 24 H40" />
        </svg>
      )}
      {normalizedType === 'even' && (
        <div className="even">
          <div className="sq r" />
          <div className="sq t" />
          <div className="sq t" />
          <div className="sq r" />
        </div>
      )}
      {normalizedType === 'odd' && (
        <div className="odd">
          <div className="tri top" />
          <div className="tri bot-l" />
          <div className="tri bot-r" />
        </div>
      )}
      {normalizedType === 'matches' && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path className="stroke-red-thick" d="M24 8 V16" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-red-thick" d="M24 32 V40" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-red-thick" d="M8 24 H22" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-red-thick" d="M15 17 L22 24 L15 31" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-grey-thick" d="M31 17 L38 10" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-grey-thick" d="M30 24 H40" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-grey-thick" d="M31 31 L38 38" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {normalizedType === 'differs' && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path className="stroke-red-thick" d="M24 8 V14" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-red-thick" d="M24 34 V40" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-red-thick" d="M8 24 H20" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-red-thick" d="M13 17 L20 24 L13 31" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-grey-thick" d="M40 24 H30" strokeLinecap="round" strokeLinejoin="round" />
          <path className="stroke-grey-thick" d="M35 17 L28 24 L35 31" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {normalizedType === 'over' && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path className="stroke-red" d="M12 36 L36 12 L26 12" />
          <path className="stroke-red" d="M36 12 L36 22" />
          <path className="stroke-barrier" d="M8 24 H40" />
        </svg>
      )}
      {normalizedType === 'rise' && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path className="stroke-broken" d="M12 36 L16 32" />
          <path className="stroke-red" d="M17 31 L36 12 H26" />
          <path className="stroke-red" d="M36 12 V22" />
        </svg>
      )}
      {normalizedType === 'onetouch' && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <circle cx="24" cy="24" r="4" fill="#ff444f" />
          <path className="stroke-barrier" d="M8 12 H40" />
          <path className="stroke-red" d="M12 36 L24 24" />
        </svg>
      )}
      {normalizedType === 'notouch' && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <circle cx="36" cy="36" r="4" fill="#aaaaaa" />
          <path className="stroke-barrier" d="M8 12 H40" />
          <path className="stroke-red" d="M12 36 L32 36" />
        </svg>
      )}
      {(normalizedType === 'range' || normalizedType === 'upordown') && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path className="stroke-barrier" d="M8 12 H40" />
          <path className="stroke-barrier" d="M8 36 H40" />
          <path className="stroke-red" d="M12 24 L36 24" />
        </svg>
      )}
      {(normalizedType === 'expiryrange' || normalizedType === 'expirymiss') && (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path className="stroke-barrier" d="M8 12 H40" />
          <path className="stroke-barrier" d="M8 36 H40" />
          <circle cx="36" cy="24" r="3" fill="#ff444f" />
        </svg>
      )}
    </div>
  );
}

export function MarketLogo({ symbol, className }: { symbol: string; className?: string }) {
  const upperSymbol = (symbol || '').toUpperCase();
  const isVol1s = upperSymbol.includes('1HZ') || upperSymbol.includes('1S');
  const isVol = (upperSymbol.startsWith('R_') || upperSymbol.startsWith('VOL')) && !isVol1s;
  const isJump = upperSymbol.startsWith('JD') || upperSymbol.startsWith('JUMP');
  const isBull = upperSymbol.includes('BULL') || upperSymbol === 'R_110';
  const isBear = upperSymbol.includes('BEAR') || upperSymbol === 'R_111';
  const isBoom =
    (upperSymbol.startsWith('BOOM') ||
      (upperSymbol.startsWith('B') && !Number.isNaN(Number(upperSymbol.substring(1, 2))))) &&
    !isBull &&
    !isBear;
  const isCrash =
    upperSymbol.startsWith('CRASH') ||
    (upperSymbol.startsWith('C') && !Number.isNaN(Number(upperSymbol.substring(1, 2))));

  let badgeValue = (symbol || '').replace(/[^0-9]/g, '');
  if (isVol1s) {
    const numericParts = symbol.match(/\d+/g);
    if (numericParts && numericParts.length > 1) {
      const actualIndex = numericParts.find((p) => p !== '1');
      if (actualIndex) {
        badgeValue = actualIndex;
      }
    } else if (badgeValue.startsWith('1') && badgeValue.length > 1) {
      badgeValue = badgeValue.substring(1);
    }
  }

  return (
    <div className={cn('market-logo-box', className)}>
      <div className="badge">{badgeValue}</div>
      {(isVol || isVol1s) && (
        <>
          {isVol1s && <div className="vol-1s-dot">1s</div>}
          <svg viewBox="0 0 100 60">
            <line className="candle-wick" x1="20" y1="10" x2="20" y2="50" />
            <rect className="candle-body" x="16" y="20" width="8" height="20" />
            <line className="candle-wick" x1="40" y1="5" x2="40" y2="55" />
            <rect className="candle-body" x="36" y="15" width="8" height="25" />
            <line className="candle-wick" x1="60" y1="15" x2="60" y2="45" />
            <rect className="candle-body" x="56" y="25" width="8" height="15" />
            <line className="candle-wick" x1="80" y1="0" x2="80" y2="60" />
            <rect className="candle-body" x="76" y="10" width="8" height="35" />
          </svg>
        </>
      )}
      {isJump && (
        <svg viewBox="0 0 100 80">
          <line className="jump-bar jump-red" x1="15" y1="35" x2="15" y2="43" />
          <line className="jump-bar jump-red" x1="25" y1="37" x2="25" y2="50" />
          <line className="jump-bar jump-red" x1="35" y1="37" x2="35" y2="80" />
          <line className="jump-bar jump-red" x1="45" y1="67" x2="45" y2="83" />
          <line className="jump-bar jump-teal" x1="55" y1="57" x2="55" y2="75" />
          <line className="jump-bar jump-teal" x1="65" y1="15" x2="65" y2="70" />
          <line className="jump-bar jump-teal" x1="75" y1="17" x2="75" y2="37" />
          <line className="jump-bar jump-teal" x1="85" y1="25" x2="85" y2="37" />
        </svg>
      )}
      {isBoom && (
        <svg viewBox="0 0 80 80">
          <polyline className="bc-line bc-red" points="10,45 22,53 34,47 46,57 58,49 70,63" />
          <line className="bc-line bc-cyan" x1="70" y1="63" x2="70" y2="20" />
        </svg>
      )}
      {isCrash && (
        <svg viewBox="0 0 80 80">
          <polyline className="bc-line bc-cyan" points="10,40 22,32 34,38 46,28 58,36 70,22" />
          <line className="bc-line bc-red" x1="70" y1="22" x2="70" y2="65" />
        </svg>
      )}
      {isBull && (
        <svg viewBox="0 0 50 50">
          <polyline className="bc-line bc-cyan" points="5,40 15,30 22,35 40,15" />
          <polyline className="bc-line bc-cyan" points="30,15 40,15 40,25" />
        </svg>
      )}
      {isBear && (
        <svg viewBox="0 0 50 50">
          <polyline className="bc-line bc-red" points="5,10 15,20 22,15 40,35" />
          <polyline className="bc-line bc-red" points="30,35 40,35 40,25" />
        </svg>
      )}
      {!isVol && !isVol1s && !isJump && !isBoom && !isCrash && !isBull && !isBear && (
        <span className="text-[8px] font-bold text-[#aaaaaa]">{String(symbol || '').substring(0, 3)}</span>
      )}
    </div>
  );
}
