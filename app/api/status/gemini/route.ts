export const runtime = 'edge';

interface GcpIncident {
  id: string;
  service_name?: string;
  external_desc?: string;
  begin: string;
  end?: string;
  severity?: string;
  status_impact?: string;
  uri?: string;
}

export async function GET() {
  try {
    const gcpRes = await fetch('https://status.cloud.google.com/incidents.json', {
      next: { revalidate: 60 },
    } as RequestInit);

    if (!gcpRes.ok) {
      throw new Error(`GCP feed responded ${gcpRes.status}`);
    }

    const incidents: GcpIncident[] = await gcpRes.json();

    const geminiIncidents = incidents.filter((i) => {
      const name = (i.service_name ?? '').toLowerCase();
      return (
        name.includes('gemini') ||
        name.includes('vertex ai') ||
        name.includes('ai studio') ||
        name.includes('generative')
      );
    });

    const activeIncidents = geminiIncidents.filter((i) => !i.end);
    const hasActive = activeIncidents.length > 0;

    return Response.json({
      indicator: hasActive ? 'minor' : 'none',
      description: hasActive
        ? `${activeIncidents.length} active incident${activeIncidents.length > 1 ? 's' : ''}`
        : 'All Systems Operational',
      incidents: activeIncidents.map((i) => ({
        id: i.id,
        title: i.external_desc ?? 'Incident in progress',
        service: i.service_name,
        began: i.begin,
        uri: i.uri,
      })),
      source: 'google_cloud_incidents',
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
