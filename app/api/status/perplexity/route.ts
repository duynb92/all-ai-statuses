export const runtime = 'edge';

function mapInstatus(status: string): string {
  if (status === 'UP') return 'none';
  if (status === 'HASISSUES') return 'minor';
  if (status === 'UNDERMAINTENANCE') return 'minor';
  return 'unknown';
}

export async function GET() {
  try {
    const res = await fetch('https://status.perplexity.com/v3/summary.json', {
      next: { revalidate: 60 },
    } as RequestInit);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const pageStatus: string = data.page?.status ?? 'unknown';

    return Response.json({
      indicator: mapInstatus(pageStatus),
      description:
        pageStatus === 'UP'
          ? 'All Systems Operational'
          : pageStatus === 'UNDERMAINTENANCE'
            ? 'Under Maintenance'
            : 'Service Issues Detected',
      incidents: [],
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
