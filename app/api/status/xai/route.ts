export const runtime = 'edge';

export async function GET() {
  try {
    const res = await fetch('https://status.x.ai/api/v2/summary.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; status-monitor/1.0)' },
      next: { revalidate: 60 },
    } as RequestInit);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    return Response.json({
      indicator: data.status?.indicator ?? 'unknown',
      description: data.status?.description ?? 'Unknown',
      incidents: (data.incidents ?? []).map((i: { name: string; created_at?: string }) => ({
        title: i.name,
        began: i.created_at,
      })),
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
