'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Indicator =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'unknown'
  | 'loading';

interface ProviderStatus {
  id: string;
  name: string;
  indicator: Indicator;
  description: string;
  url: string;
  fetchedAt: string | null;
  incidents: { title: string; began?: string }[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const REFRESH_MS = 30_000;

const PROVIDERS = [
  {
    id: 'claude',
    name: 'CLAUDE',
    label: 'Anthropic',
    url: 'https://status.claude.com/',
    endpoint: 'https://status.claude.com/api/v2/summary.json',
    type: 'atlassian',
    icon: '/icons/claude.svg',
  },
  {
    id: 'openai',
    name: 'OPENAI',
    label: 'OpenAI',
    url: 'https://status.openai.com/',
    endpoint: 'https://status.openai.com/api/v2/summary.json',
    type: 'atlassian',
    icon: '/icons/openai.svg',
  },
  {
    id: 'gemini',
    name: 'GEMINI',
    label: 'Google AI',
    url: 'https://aistudio.google.com/status',
    endpoint: '/api/status/gemini',
    type: 'gemini',
    icon: '/icons/gemini.svg',
  },
  {
    id: 'mistral',
    name: 'MISTRAL',
    label: 'Mistral AI',
    url: 'https://status.mistral.ai/',
    endpoint: '/api/status/mistral',
    type: 'gemini', // proxy route — same response shape as our gemini proxy
    icon: '/icons/mistral.svg',
  },
  {
    id: 'groq',
    name: 'GROQ',
    label: 'Groq',
    url: 'https://groqstatus.com/',
    endpoint: 'https://groqstatus.com/api/v2/summary.json',
    type: 'atlassian',
    icon: '/icons/groq.svg',
  },
  {
    id: 'cohere',
    name: 'COHERE',
    label: 'Cohere',
    url: 'https://status.cohere.com/',
    endpoint: 'https://status.cohere.com/api/v2/summary.json',
    type: 'atlassian',
    icon: '/icons/cohere.svg',
  },
] as const;

// ─── Fetch helpers ────────────────────────────────────────────────────────────

function mapAtlassian(raw: string): Indicator {
  if (raw === 'none') return 'operational';
  if (raw === 'minor') return 'degraded';
  if (raw === 'major') return 'partial_outage';
  if (raw === 'critical') return 'major_outage';
  return 'unknown';
}

async function fetchProvider(
  p: (typeof PROVIDERS)[number],
): Promise<Omit<ProviderStatus, 'url'>> {
  const res = await fetch(p.endpoint, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (p.type === 'atlassian') {
    return {
      id: p.id,
      name: p.name,
      indicator: mapAtlassian(data.status?.indicator ?? 'unknown'),
      description: data.status?.description ?? 'Unknown',
      fetchedAt: new Date().toISOString(),
      incidents: (data.incidents ?? []).map(
        (i: { name: string; created_at?: string }) => ({
          title: i.name,
          began: i.created_at,
        }),
      ),
    };
  }

  // gemini proxy
  return {
    id: p.id,
    name: p.name,
    indicator: mapAtlassian(data.indicator ?? 'unknown'),
    description: data.description ?? 'Unknown',
    fetchedAt: new Date().toISOString(),
    incidents: (data.incidents ?? []).map(
      (i: { title: string; began?: string }) => ({
        title: i.title,
        began: i.began,
      }),
    ),
  };
}

// ─── UI metadata ─────────────────────────────────────────────────────────────

const META: Record<Indicator, { symbol: string; cssVar: string; label: string }> = {
  operational:    { symbol: '●', cssVar: '--c-green',  label: 'OPERATIONAL' },
  degraded:       { symbol: '▲', cssVar: '--c-yellow', label: 'DEGRADED' },
  partial_outage: { symbol: '■', cssVar: '--c-orange', label: 'PARTIAL OUTAGE' },
  major_outage:   { symbol: '✕', cssVar: '--c-red',    label: 'MAJOR OUTAGE' },
  unknown:        { symbol: '?', cssVar: '--c-dim',    label: 'UNKNOWN' },
  loading:        { symbol: '○', cssVar: '--c-dim',    label: 'LOADING...' },
};

function fmtAge(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatusCard({ status }: { status: ProviderStatus }) {
  const meta = META[status.indicator];
  const provider = PROVIDERS.find((p) => p.id === status.id)!;

  return (
    <div className="status-card" data-indicator={status.indicator}>
      <div className="card-header">
        <span className="provider-name-row">
          {provider.icon ? (
            <img
              src={provider.icon}
              alt=""
              width={16}
              height={16}
              className="provider-icon"
            />
          ) : (
            <span className="provider-icon-fallback">{status.name[0]}</span>
          )}
          <span className="provider-label">{status.name}</span>
        </span>
        <span className="provider-sublabel">{provider.label}</span>
      </div>

      <div className="indicator-row">
        <span className="indicator-symbol" style={{ color: `var(${meta.cssVar})` }}>
          {meta.symbol}
        </span>
        <span className="indicator-label" style={{ color: `var(${meta.cssVar})` }}>
          {meta.label}
        </span>
      </div>

      <div className="description-row">{status.description}</div>

      {status.incidents.length > 0 && (
        <div className="incidents-section">
          {status.incidents.slice(0, 2).map((inc, i) => (
            <div key={i} className="incident-row">
              <span className="incident-bullet">›</span>
              <span className="incident-title">{inc.title}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card-footer">
        <span className="fetched-at">updated {fmtAge(status.fetchedAt)}</span>
        <a
          href={status.url}
          target="_blank"
          rel="noopener noreferrer"
          className="status-link"
        >
          status ↗
        </a>
      </div>
    </div>
  );
}

function OverallBanner({ statuses }: { statuses: ProviderStatus[] }) {
  const loaded = statuses.filter((s) => s.indicator !== 'loading');
  if (loaded.length === 0) return null;

  const order: Indicator[] = [
    'major_outage',
    'partial_outage',
    'degraded',
    'unknown',
    'operational',
    'loading',
  ];
  const worst = order.find((lvl) => loaded.some((s) => s.indicator === lvl)) ?? 'unknown';
  const meta = META[worst];

  return (
    <div className="overall-banner" data-indicator={worst}>
      <span className="overall-symbol" style={{ color: `var(${meta.cssVar})` }}>
        {meta.symbol}
      </span>
      <span className="overall-text" style={{ color: `var(${meta.cssVar})` }}>
        {worst === 'operational' ? 'ALL SYSTEMS OPERATIONAL' : `SYSTEM ${meta.label}`}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Page() {
  const now = useNow();

  const [statuses, setStatuses] = useState<ProviderStatus[]>(
    PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      indicator: 'loading' as Indicator,
      description: 'Fetching...',
      url: p.url,
      fetchedAt: null,
      incidents: [],
    })),
  );

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled(PROVIDERS.map(fetchProvider));
    setStatuses((prev) =>
      prev.map((existing, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') return { ...existing, ...r.value };
        return {
          ...existing,
          indicator: 'unknown' as Indicator,
          description: 'Fetch failed',
          fetchedAt: new Date().toISOString(),
        };
      }),
    );
    setLastRefresh(new Date());
  }, []);

  // Initial fetch + interval
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const secSinceRefresh =
    lastRefresh && now ? Math.floor((now.getTime() - lastRefresh.getTime()) / 1000) : null;
  const nextIn =
    secSinceRefresh !== null ? Math.max(0, REFRESH_MS / 1000 - secSinceRefresh) : null;

  return (
    <main className="page">
      <header className="page-header">
        <div className="header-line">
          <span className="header-tag">[ AI STATUS MONITOR ]</span>
          <span className="header-date" suppressHydrationWarning>
            {now ? now.toUTCString().replace(' GMT', ' UTC') : ''}
          </span>
        </div>

        <OverallBanner statuses={statuses} />

        <div className="header-line">
          <span className="header-sub">
            {PROVIDERS.length} providers · refresh in {nextIn !== null ? `${nextIn}s` : '…'}
          </span>
          {lastRefresh && (
            <span className="header-sub">
              last refresh {fmtAge(lastRefresh.toISOString())}
            </span>
          )}
        </div>
      </header>

      <div className="cards-grid">
        {statuses.map((s) => (
          <StatusCard key={s.id} status={s} />
        ))}
      </div>

      <footer className="page-footer">
        <span className="footer-rule">
          {'─'.repeat(46)}
        </span>
        <span className="footer-note">
          data sourced from official provider status APIs
        </span>
      </footer>
    </main>
  );
}
