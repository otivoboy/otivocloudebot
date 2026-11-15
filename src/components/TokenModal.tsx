import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  FlaskConical,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { AccountInfo, AuthMode } from '../types';

interface TokenModalProps {
  open: boolean;
  onClose: () => void;
  account: AccountInfo | null;
  onConnected: (account: AccountInfo) => void;
  onDisconnected: () => void;
  onRefreshBalance: () => Promise<void>;
  sessionRunning: boolean;
}

export const TokenModal: React.FC<TokenModalProps> = ({
  open,
  onClose,
  account,
  onConnected,
  onDisconnected,
  onRefreshBalance,
  sessionRunning,
}) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('api_token');
  const [accountId, setAccountId] = useState('');
  const [appId, setAppId] = useState('');
  const [virtualToken, setVirtualToken] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token.trim().startsWith('pat_')) {
      setAuthMode('pat');
    } else if (token.trim().length > 0 && authMode === 'pat' && !token.trim().startsWith('pat_')) {
      setAuthMode('api_token');
    }
  }, [token]);

  if (!open) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError('Please enter your Deriv API token.');
      return;
    }
    if (authMode === 'pat' && !accountId.trim()) {
      setError('Account ID (e.g. DOT92647098) is required for pat_ tokens.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        token: token.trim(),
        authMode,
        accountId: accountId.trim() || undefined,
        appId: appId.trim() || undefined,
        virtualToken: virtualToken.trim() || undefined,
      };
      const res = await fetch('/api/account/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Connection failed.');
      }
      try {
        localStorage.setItem('otivo_saved_connection', JSON.stringify(payload));
      } catch {
        // ignore storage errors
      }
      onConnected(data.account);
      setToken('');
      setVirtualToken('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate with Deriv.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed.');
      try {
        localStorage.removeItem('otivo_saved_connection');
      } catch {
        // ignore
      }
      onDisconnected();
    } catch (err: any) {
      setError(err?.message || 'Could not disconnect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#1F2937] bg-[#111827] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1F2937] px-6 py-4">
          <h2 id="token-modal-title" className="text-base font-semibold text-white">
            Deriv API Connection
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#1F2937] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {account && account.connected && (
            <div className="rounded-lg border border-[#1F2937] bg-[#0B0F17] p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {account.isVirtual ? (
                    <FlaskConical className="h-4 w-4 text-amber-400" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      account.isVirtual ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {account.accountType} ACCOUNT DETECTED
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-400">{account.loginId}</span>
              </div>

              <div className="flex items-baseline justify-between border-t border-[#1F2937] pt-3">
                <span className="text-xs text-slate-400">Available Balance</span>
                <span className="font-mono text-xl font-semibold text-white tabular-nums">
                  {account.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span className="text-sm text-slate-400">{account.currency}</span>
                </span>
              </div>

              {(account.fullname || account.scopes) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {account.fullname && <span>{account.fullname}</span>}
                  {account.scopes && account.scopes.length > 0 && (
                    <span>Scopes: {account.scopes.join(', ')}</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onRefreshBalance()}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#111827] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-700 hover:bg-[#161E2E]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh Balance</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading || sessionRunning}
                  className="flex items-center gap-1.5 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/60 disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="deriv-api-token" className="text-xs font-medium text-slate-300">
                  {account ? 'Switch Account Token' : 'Deriv API Token'}
                </label>
                <div className="flex items-center gap-1 rounded-md bg-[#0B0F17] p-0.5 border border-[#1F2937]">
                  <button
                    type="button"
                    onClick={() => setAuthMode('api_token')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                      authMode === 'api_token'
                        ? 'bg-[#1F2937] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Standard Token
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('pat')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                      authMode === 'pat'
                        ? 'bg-[#1F2937] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    PAT + Account ID
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  id="deriv-api-token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={
                    authMode === 'pat'
                      ? 'pat_...'
                      : 'Paste Deriv API token (Read + Trade scope)'
                  }
                  autoComplete="off"
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3.5 py-2.5 pr-10 font-mono text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Real vs. Demo status and live balance are automatically detected from Deriv upon authorization.
              </p>
            </div>

            {authMode === 'pat' && (
              <div>
                <label htmlFor="deriv-account-id" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Deriv Account ID
                </label>
                <input
                  id="deriv-account-id"
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g. DOT92647098 or CR123456"
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                {showAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span>Advanced Options (App ID &amp; Optional Virtual Demo Token)</span>
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 rounded-lg border border-[#1F2937] bg-[#0B0F17] p-3.5">
                  <div>
                    <label htmlFor="deriv-app-id" className="block text-xs font-medium text-slate-300 mb-1">
                      Deriv App ID (optional)
                    </label>
                    <input
                      id="deriv-app-id"
                      type="text"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      placeholder={authMode === 'pat' ? '34SRQBBtI5nwEFQqmc3se' : '1089'}
                      className="w-full rounded-lg border border-[#1F2937] bg-[#111827] px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="virtual-demo-token" className="block text-xs font-medium text-slate-300 mb-1">
                      Separate Virtual Demo Token (optional)
                    </label>
                    <input
                      id="virtual-demo-token"
                      type="password"
                      value={virtualToken}
                      onChange={(e) => setVirtualToken(e.target.value)}
                      placeholder="Leave empty to run virtual phase on live Deriv tick feed"
                      className="w-full rounded-lg border border-[#1F2937] bg-[#111827] px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-200/90">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <p className="leading-relaxed">
                Test with a <strong>Demo</strong> account first and use a token with <strong>Read + Trade</strong> scopes only. Martingale and Fast execution can amplify losses rapidly.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3.5 py-2.5 text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#1F2937] px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-[#1F2937]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || sessionRunning}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? 'Authorizing...' : account ? 'Switch Account' : 'Authorize & Connect'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
