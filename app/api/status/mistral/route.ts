/**
 * Mistral AI status proxy.
 *
 * Mistral uses Checkly's status page (not Atlassian Statuspage), so there is
 * no public JSON API. Instead, Checkly SSR-embeds live data in the page HTML
 * inside a <script id="__NUXT_DATA__"> tag as a "devalue" flat array.
 *
 * Devalue format: a JSON array where object/array values that are integers are
 * references (by index) to other items in the array. Primitives (string,
 * number, boolean, null) at any position are actual values.
 *
 * We resolve just enough of the graph to extract:
 *   state["unresolved-incidents-{pageId}"].incidents[]
 */

const STATUS_PAGE_URL = 'https://status.mistral.ai/';

/** Recursively resolve devalue references up to a safe depth. */
function resolve(arr: unknown[], idx: number, depth = 0): unknown {
  if (depth > 8) return null;
  const item = arr[idx];
  if (item === null || typeof item !== 'object') return item;

  if (Array.isArray(item)) {
    return item.map((v) =>
      typeof v === 'number' && Number.isInteger(v) ? resolve(arr, v, depth + 1) : v,
    );
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
    out[k] =
      typeof v === 'number' && Number.isInteger(v) ? resolve(arr, v, depth + 1) : v;
  }
  return out;
}

interface ChecklyIncident {
  id?: string;
  name?: string;
  severity?: string;
  lastUpdateStatus?: string;
  created_at?: string;
}

export async function GET() {
  try {
    const res = await fetch(STATUS_PAGE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; status-monitor/1.0)' },
      next: { revalidate: 60 },
    } as RequestInit);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // Extract the __NUXT_DATA__ payload
    const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) throw new Error('__NUXT_DATA__ not found');

    const arr: unknown[] = JSON.parse(match[1]);

    // The state object is at index 3: { "unresolved-incidents-{pageId}": <ref>, ... }
    const stateRaw = arr[3];
    if (!stateRaw || typeof stateRaw !== 'object' || Array.isArray(stateRaw)) {
      throw new Error('Unexpected state shape');
    }

    const state = stateRaw as Record<string, unknown>;

    // Find the unresolved-incidents key (format: "unresolved-incidents-{uuid}")
    const incidentsKey = Object.keys(state).find((k) =>
      k.startsWith('unresolved-incidents-'),
    );
    if (!incidentsKey) throw new Error('unresolved-incidents key not found');

    const incidentsRefIdx = state[incidentsKey];
    if (typeof incidentsRefIdx !== 'number') throw new Error('incidents ref is not a number');

    // Resolve { incidents: [ref, ref, ...] }
    const incidentsContainer = resolve(arr, incidentsRefIdx) as { incidents?: ChecklyIncident[] };
    const incidents: ChecklyIncident[] = incidentsContainer?.incidents ?? [];

    const hasActive = incidents.length > 0;

    return Response.json({
      indicator: hasActive ? 'minor' : 'none',
      description: hasActive
        ? `${incidents.length} active incident${incidents.length > 1 ? 's' : ''}`
        : 'All Systems Operational',
      incidents: incidents.map((i) => ({
        id: i.id,
        title: i.name ?? 'Incident in progress',
        severity: i.severity,
        began: i.created_at,
      })),
      source: 'checkly_nuxt_ssr',
    });
  } catch (err) {
    return Response.json(
      {
        indicator: 'unknown',
        description: 'Could not fetch status',
        incidents: [],
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
