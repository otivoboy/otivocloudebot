import { useEffect, useRef, useState } from 'react';
import { MARKETS, MT5_SYMBOLS, TickPoint } from '../types';

export const DERIV_DATA_APP_ID = '34SRQBBtI5nwEFQqmc3se';
const PUBLIC_DERIV_WS_URL = `wss://api.derivws.com/trading/v1/options/ws/public?app_id=${DERIV_DATA_APP_ID}`;

const DECIMALS_MAP: Record<string, number> = {
  ...Object.fromEntries(MT5_SYMBOLS.map((m) => [m.symbol, m.decimals])),
  ...Object.fromEntries(MARKETS.map((m) => [m.symbol, m.decimals])),
};

function getLastDigit(quote: number, symbol: string): number {
  const decimals = DECIMALS_MAP[symbol] ?? 2;
  const fixed = quote.toFixed(decimals);
  return Number(fixed.charAt(fixed.length - 1));
}

export function useDerivPublicTicks(symbols: string[], enabled: boolean) {
  const [clientTicks, setClientTicks] = useState<Record<string, TickPoint[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const activeSymbolsRef = useRef<string[]>([]);

  const uniqueKey = Array.from(
    new Set(symbols.map((s) => s.trim()).filter(Boolean))
  )
    .slice(0, 20)
    .sort()
    .join(',');

  useEffect(() => {
    const targetSymbols = uniqueKey ? uniqueKey.split(',') : [];
    activeSymbolsRef.current = targetSymbols;

    if (!enabled || targetSymbols.length === 0) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      subscribedRef.current.clear();
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;

    const sendSubscriptions = (ws: WebSocket, syms: string[]) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      for (const sym of syms) {
        if (subscribedRef.current.has(sym)) continue;
        subscribedRef.current.add(sym);
        ws.send(
          JSON.stringify({
            ticks_history: sym,
            adjust_start_time: 1,
            count: 150,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
          })
        );
      }
    };

    const connect = () => {
      if (cancelled) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendSubscriptions(wsRef.current, targetSymbols);
        return;
      }

      subscribedRef.current.clear();
      const ws = new WebSocket(PUBLIC_DERIV_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled || wsRef.current !== ws) {
          ws.close();
          return;
        }
        sendSubscriptions(ws, activeSymbolsRef.current);
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
          }
        }, 25_000);
      };

      ws.onmessage = (event) => {
        if (cancelled || wsRef.current !== ws) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.msg_type === 'history' && msg.history && msg.echo_req?.ticks_history) {
            const sym = String(msg.echo_req.ticks_history);
            const prices: number[] = msg.history.prices ?? [];
            const times: number[] = msg.history.times ?? [];
            const pts: TickPoint[] = prices.map((p, i) => ({
              epoch: times[i] ?? Math.floor(Date.now() / 1000),
              quote: Number(p),
              lastDigit: getLastDigit(Number(p), sym),
            }));
            setClientTicks((prev) => ({ ...prev, [sym]: pts.slice(-200) }));
          } else if (msg.msg_type === 'tick' && msg.tick) {
            const sym = String(msg.tick.symbol);
            const q = Number(msg.tick.quote);
            const pt: TickPoint = {
              epoch: Number(msg.tick.epoch),
              quote: q,
              lastDigit: getLastDigit(q, sym),
            };
            setClientTicks((prev) => {
              const existing = prev[sym] ?? [];
              if (
                existing.length > 0 &&
                existing[existing.length - 1].epoch === pt.epoch &&
                existing[existing.length - 1].quote === pt.quote
              ) {
                return prev;
              }
              return { ...prev, [sym]: [...existing, pt].slice(-200) };
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        subscribedRef.current.clear();
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        // handled on close
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
    };
  }, [uniqueKey, enabled]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return clientTicks;
}
