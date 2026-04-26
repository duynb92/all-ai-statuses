export const atlassianOperational = {
  status: { indicator: 'none', description: 'All Systems Operational' },
  incidents: [],
};

export const atlassianMajorOutage = {
  status: { indicator: 'critical', description: 'Major System Outage' },
  incidents: [{ name: 'API errors', started_at: '2026-04-25T10:00:00Z' }],
};

export const atlassianDegraded = {
  status: { indicator: 'minor', description: 'Partially Degraded Service' },
  incidents: [{ name: 'Elevated latency', started_at: '2026-04-25T12:00:00Z' }],
};

export const proxyOperational = {
  indicator: 'operational',
  description: 'All systems operational',
  incidents: [],
};

export const proxyMajorOutage = {
  indicator: 'major_outage',
  description: 'Service disruption',
  incidents: [{ title: 'Outage', began: '2026-04-25T10:00:00Z' }],
};

export const providerStateOperational = (id: string) => ({
  id,
  indicator: 'operational',
  updatedAt: new Date('2026-04-25T09:00:00Z'),
});

export const providerStateMajorOutage = (id: string) => ({
  id,
  indicator: 'major_outage',
  updatedAt: new Date('2026-04-25T09:00:00Z'),
});
