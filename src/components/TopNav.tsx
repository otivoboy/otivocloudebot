import React, { useState } from 'react';
import {
  ChevronDown,
  Terminal,
  Zap,
  BarChart3,
  Blocks,
  CandlestickChart,
} from 'lucide-react';
import { AccountInfo } from '../types';

export type NavTab = 'terminal' | 'autobot' | 'analysis' | 'builder' | 'metatrader';

interface TopNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  account: AccountInfo | null;
  onOpenTokenModal: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
  { id: 'terminal', label: 'Terminal', mobileLabel: 'Terminal', icon: <Terminal className="h-4 w-4" /> },
  { id: 'autobot', label: 'AutoBot', mobileLabel: 'AutoBot', icon: <Zap className="h-4 w-4" /> },
  { id: 'analysis', label: 'Analysis', mobileLabel: 'Analysis', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'builder', label: 'Bot Builder', mobileLabel: 'Builder', icon: <Blocks className="h-4 w-4" /> },
  { id: 'metatrader', label: 'MetaTrader', mobileLabel: 'MT5', icon: <CandlestickChart className="h-4 w-4" /> },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  account,
  onOpenTokenModal,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#1F2937] bg-[#0B0F17]/95 backdrop-blur-sm">
        <div className="flex h-16 w-full items-center justify-between gap-3 sm:gap-6 px-3 sm:px-6 lg:px-8">
          {/* Zone 1: Brand Logo + OTIVO AI CLOUD */}
          <button
            type="button"
            onClick={() => onTabChange('terminal')}
            className="flex items-center gap-2 text-left text-sm sm:text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff444f] rounded"
          >
            {!logoFailed ? (
              <img
                src="/logo.png"
                alt="OTIVO AI CLOUD logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-md object-contain shrink-0"
              />
            ) : (
              <span
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-[#1F2937] bg-[#111827] font-mono text-xs font-bold text-[#ff444f] shrink-0"
                aria-hidden="true"
              >
                OA
              </span>
            )}
            <span>OTIVO AI CLOUD</span>
          </button>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-7" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-[#ff444f]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Navigation Corner — Live Account Balance & Real/Demo Detection OR Single Red Connect Button */}
          <div className="flex items-center gap-2 shrink-0">
            {account && account.connected ? (
              <button
                type="button"
                onClick={onOpenTokenModal}
                className="flex flex-col items-end rounded-lg px-2.5 py-1 text-right transition-colors hover:bg-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title={`Connected ${account.accountType} (${account.loginId}) — Click to manage`}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <span
                    className={`text-xs font-semibold leading-tight ${
                      account.isVirtual ? 'text-[#f59e0b]' : 'text-[#00a79e]'
                    }`}
                  >
                    {account.isVirtual ? 'Demo account' : 'Real account'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white tabular-nums whitespace-nowrap leading-tight mt-0.5">
                  {account.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {account.currency}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenTokenModal}
                className="rounded-lg bg-[#ff444f] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#e63a44] active:scale-[0.99] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff444f]"
              >
                Connect API Token
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-[#1F2937] bg-[#0B0F17]/95 backdrop-blur-md md:hidden"
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 min-h-[58px] text-[11px] font-medium transition-colors ${
                active ? 'text-[#ff444f]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-full px-1">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
