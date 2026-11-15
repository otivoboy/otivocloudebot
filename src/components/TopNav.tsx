import React from 'react';
import { RefreshCw, ShieldCheck, FlaskConical, KeyRound } from 'lucide-react';
import { AccountInfo } from '../types';

export type NavTab = 'terminal' | 'strategies' | 'ledger';

interface TopNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  account: AccountInfo | null;
  onOpenTokenModal: () => void;
  onRefreshBalance: () => void;
  refreshing: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  account,
  onOpenTokenModal,
  onRefreshBalance,
  refreshing,
}) => {
  const navItems: { id: NavTab; label: string }[] = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'strategies', label: 'Strategies' },
    { id: 'ledger', label: 'Trade Ledger' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#1F2937] bg-[#0B0F17]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onTabChange('terminal')}
          className="text-left text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          DerivBot Studio
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
                  active
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-blue-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Navigation Corner — Live Account Balance & Real/Demo Detection */}
        <div className="flex items-center gap-3 shrink-0">
          {account && account.connected ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenTokenModal}
                className="flex items-center gap-3 rounded-lg border border-[#1F2937] bg-[#111827] px-3.5 py-1.5 text-left transition-colors hover:border-slate-700 hover:bg-[#161E2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Manage API token and account connection"
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  {account.isVirtual ? (
                    <FlaskConical className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  )}
                  <span
                    className={`text-xs font-semibold tracking-wide whitespace-nowrap ${
                      account.isVirtual ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {account.accountType}
                  </span>
                </div>

                <span className="h-4 w-px bg-[#1F2937]" aria-hidden="true" />

                <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
                  <span className="font-mono text-sm font-semibold text-white tabular-nums">
                    {account.balance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="font-mono text-xs font-medium text-slate-400">
                    {account.currency}
                  </span>
                </div>

                <span
                  className="hidden sm:inline text-xs font-mono text-slate-500 whitespace-nowrap"
                  aria-label="Account login ID"
                >
                  {account.loginId}
                </span>
              </button>

              <button
                type="button"
                onClick={onRefreshBalance}
                disabled={refreshing}
                aria-label="Refresh account balance"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1F2937] bg-[#111827] text-slate-400 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenTokenModal}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Connect API Token</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="flex md:hidden border-t border-[#1F2937] px-4">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'border-b-2 border-blue-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
