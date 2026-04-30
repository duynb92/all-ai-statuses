export interface ProviderResult {
  indicator: string;
  description: string;
  incidents: { title: string; began?: string }[];
}

interface ProviderConfig {
  id: string;
  type: 'atlassian' | 'proxy';
  endpoint: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const PROVIDERS: ProviderConfig[] = [
  { id: 'claude',     type: 'atlassian', endpoint: 'https://status.claude.com/api/v2/summary.json' },
  { id: 'openai',    type: 'atlassian', endpoint: 'https://status.openai.com/api/v2/summary.json' },
  { id: 'gemini',    type: 'proxy',     endpoint: `${BASE_URL}/api/status/gemini` },
  { id: 'mistral',   type: 'proxy',     endpoint: `${BASE_URL}/api/status/mistral` },
  { id: 'groq',      type: 'atlassian', endpoint: 'https://groqstatus.com/api/v2/summary.json' },
  { id: 'cohere',    type: 'atlassian', endpoint: 'https://status.cohere.com/api/v2/summary.json' },
  { id: 'deepseek',  type: 'atlassian', endpoint: 'https://status.deepseek.com/api/v2/summary.json' },
  { id: 'perplexity', type: 'proxy',   endpoint: `${BASE_URL}/api/status/perplexity` },
];

const INDICATOR_MAP: Record<string, string> = {
  none:     'operational',
  minor:    'degraded',
  major:    'partial_outage',
  critical: 'major_outage',
};

async function fetchProvider(p: ProviderConfig): Promise<ProviderResult> {
  const res = await fetch(p.endpoint, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (p.type === 'atlassian') {
    return {
      indicator: INDICATOR_MAP[data.status?.indicator] ?? 'unknown',
      description: data.status?.description ?? '',
      incidents: (data.incidents ?? []).map((i: { name: string; started_at?: string }) => ({
        title: i.name,
        began: i.started_at,
      })),
    };
  }

  // proxy — already normalized to our shape
  return {
    indicator: data.indicator ?? 'unknown',
    description: data.description ?? '',
    incidents: data.incidents ?? [],
  };
}

export async function fetchAllProviders(): Promise<Record<string, ProviderResult>> {
  const results = await Promise.allSettled(PROVIDERS.map(p => fetchProvider(p)));
  const out: Record<string, ProviderResult> = {};
  for (let i = 0; i < PROVIDERS.length; i++) {
    const r = results[i];
    out[PROVIDERS[i].id] = r.status === 'fulfilled'
      ? r.value
      : { indicator: 'unknown', description: 'Fetch failed', incidents: [] };
  }
  return out;
}
