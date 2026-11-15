import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Lock,
  Trash2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { AuthMode, VirtualAccountInfo } from '../types';

interface VirtualTokenSettingsProps {
  virtualAccount: VirtualAccountInfo | null;
  hasVirtualToken: boolean;
  onVirtualUpdated: (v: VirtualAccountInfo | null) => void;
  disabled?: boolean;
  variant?: 'terminal' | 'autobot';
}

export const VIRTUAL_CONNECTION_STORAGE_KEY = 'otivo_saved_virtual_connection';

export const VirtualTokenSettings: React.FC<VirtualTokenSettingsProps> = ({
  virtualAccount,
  hasVirtualToken,
  onVirtualUpdated,
  disabled = false,
  variant = 'terminal',
}) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('api_token');
  const [accountId, setAccountId] = useState('');
  const [appId, setAppId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = token.trim();
    if (trimmed.startsWith('pat_')) {
      setAuthMode('pat');
    } else if (trimmed.length > 0 && authMode === 'pat' && !trimmed.startsWith('pat_')) {
      setAuthMode('api_token');
    }
  }, [token]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError('Enter your Virtual API or PAT token.');
      return;
    }
    if (authMode === 'pat' && !accountId.trim()) {
      setError('Account ID (e.g. VRTC... or DOT...) is required for pat_ tokens.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        token: trimmedToken,
        authMode,
        accountId: accountId.trim() || undefined,
        appId: appId.trim() || undefined,
      };
      const res = await fetch('/api/account/virtual-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authorize Virtual token.');
      }
      try {
        localStorage.setItem(VIRTUAL_CONNECTION_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore storage errors
      }
      onVirtualUpdated(data.virtualAccount);
      setToken('');
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to verify Virtual token.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/virtual-token', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove Virtual token.');
      }
      try {
        localStorage.removeItem(VIRTUAL_CONNECTION_STORAGE_KEY);
      } catch {
        // ignore
      }
      onVirtualUpdated(null);
    } catch (err: any) {
      setError(err?.message || 'Could not remove Virtual token.');
    } finally {
      setLoading(false);
    }
  };

  const isAutoBot = variant === 'autobot';

  return (
    <div
      className={
        isAutoBot
          ? 'rounded-xl border border-amber-500/25 bg-[#090D16] p-3.5 space-y-3'
          : 'rounded-lg border border-[#1F2937] bg-[#0B0F17] p-3.5 space-y-3'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasVirtualToken ? (
            <FlaskConical className="h-4 w-4 text-amber-400 shrink-0" />
          ) : (
            <Lock className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-white truncate">
              Virtual Mode API / PAT Token
            </span>
            <span className="block text-[10px] text-slate-400 truncate">
              {hasVirtualToken
                ? 'Virtual strategies unlocked across the app'
                : 'Add token to unlock Virtual strategies'}
            </span>
          </div>
        </div>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold shrink-0 ${
            hasVirtualToken
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {hasVirtualToken ? 'ACTIVE' : 'LOCKED'}
        </span>
      </div>

      {hasVirtualToken && virtualAccount ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/15 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {virtualAccount.isVirtual ? (
                <FlaskConical className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="font-mono text-[11px] font-semibold text-white truncate">
                {virtualAccount.loginId}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  virtualAccount.isVirtual
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {virtualAccount.accountType}
              </span>
            </div>
            <span className="font-mono text-xs font-semibold text-amber-300 tabular-nums shrink-0">
              {virtualAccount.balance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {virtualAccount.currency}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-500/15">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span>{virtualAccount.authMode === 'pat' ? 'PAT Connected' : 'API Token Connected'}</span>
            </span>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={handleRemove}
              className="flex items-center gap-1 rounded border border-red-900/50 bg-red-950/40 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-900/50 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              <span>{loading ? 'Removing...' : 'Remove Virtual Token'}</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <KeyRound className="h-3 w-3 text-amber-400" />
            <span>{hasVirtualToken ? 'Update Virtual Token' : 'Connect Virtual Token'}</span>
          </span>
          <div className="flex items-center gap-1 rounded border border-[#1F2937] bg-[#111827] p-0.5">
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => setAuthMode('api_token')}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                authMode === 'api_token'
                  ? 'bg-[#1F2937] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              API Token
            </button>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => setAuthMode('pat')}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                authMode === 'pat'
                  ? 'bg-[#1F2937] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PAT
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            disabled={disabled || loading}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              authMode === 'pat'
                ? 'Paste pat_... virtual token'
                : 'Paste Deriv Virtual API token'
            }
            autoComplete="off"
            className="w-full rounded-lg border border-[#1F2937] bg-[#111827] px-3 py-2 pr-9 font-mono text-xs text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            aria-label={showToken ? 'Hide virtual token' : 'Show virtual token'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>

        {authMode === 'pat' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={accountId}
              disabled={disabled || loading}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Account ID (e.g. VRTC...)"
              className="w-full rounded-lg border border-[#1F2937] bg-[#111827] px-2.5 py-1.5 font-mono text-[11px] text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none disabled:opacity-60"
            />
            <input
              type="text"
              value={appId}
              disabled={disabled || loading}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="App ID (optional)"
              className="w-full rounded-lg border border-[#1F2937] bg-[#111827] px-2.5 py-1.5 font-mono text-[11px] text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none disabled:opacity-60"
            />
          </div>
        )}

        {authMode === 'api_token' && (
          <input
            type="text"
            value={appId}
            disabled={disabled || loading}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="Custom Deriv App ID (optional, default 1089)"
            className="w-full rounded-lg border border-[#1F2937] bg-[#111827] px-2.5 py-1.5 font-mono text-[11px] text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none disabled:opacity-60"
          />
        )}

        {error && (
          <p className="rounded border border-red-900/50 bg-red-950/30 px-2.5 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={disabled || loading || !token.trim()}
          onClick={() => handleSave()}
          className="w-full rounded-lg bg-amber-600/90 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Authorizing Virtual Token...'
            : hasVirtualToken
            ? 'Update & Re-Authorize Virtual Token'
            : 'Authorize & Enable Virtual Mode'}
        </button>
      </div>
    </div>
  );
};
