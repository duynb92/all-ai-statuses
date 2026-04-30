import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/handlers';
import { atlassianMajorOutage, atlassianDegraded, providerStateOperational, providerStateMajorOutage } from '../mocks/fixtures';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    providerState: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    providerStateHistory: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/cron/check-status/route';
import { prisma } from '@/lib/prisma';

const CRON_URL = 'http://localhost/api/cron/check-status';

function authedRequest() {
  return new Request(CRON_URL, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }) as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.providerState.findMany).mockResolvedValue([]);
  vi.mocked(prisma.providerState.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.providerStateHistory.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.providerStateHistory.deleteMany).mockResolvedValue({ count: 0 });
});

describe('GET /api/cron/check-status', () => {
  it('TC-CRON-01: rejects request without Authorization header', async () => {
    const req = new Request(CRON_URL) as Parameters<typeof GET>[0];
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('TC-CRON-02: rejects request with wrong CRON_SECRET', async () => {
    const req = new Request(CRON_URL, {
      headers: { authorization: 'Bearer wrong-secret' },
    }) as Parameters<typeof GET>[0];
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('TC-CRON-03: cold start — creates ProviderState rows, no Telegram', async () => {
    let telegramCalled = false;
    server.use(
      http.post(/https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/, () => {
        telegramCalled = true;
        return HttpResponse.json({ ok: true, result: { message_id: 1 } });
      }),
    );

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(8);
    expect(body.changed).toEqual([]);
    expect(telegramCalled).toBe(false);
    expect(vi.mocked(prisma.providerState.upsert)).toHaveBeenCalledTimes(8);
  });

  it('TC-CRON-04: detects operational→major_outage and sends Telegram message', async () => {
    vi.mocked(prisma.providerState.findMany).mockResolvedValue([
      providerStateOperational('claude'),
    ] as never);

    server.use(
      http.get('https://status.claude.com/api/v2/summary.json', () =>
        HttpResponse.json(atlassianMajorOutage),
      ),
    );

    let capturedPayload: Record<string, unknown> = {};
    server.use(
      http.post(/https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/, async ({ request }) => {
        capturedPayload = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ok: true, result: { message_id: 1 } });
      }),
    );

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toContain('claude');

    expect(vi.mocked(prisma.providerState.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'claude' },
        update: { indicator: 'major_outage' },
      }),
    );
    expect(vi.mocked(prisma.providerStateHistory.createMany)).toHaveBeenCalledWith({
      data: expect.arrayContaining([{
        providerId: 'claude',
        fromState: 'operational',
        toState: 'major_outage',
      }]),
    });
    expect(capturedPayload.text).toContain('*CLAUDE*');
    expect(capturedPayload.text).toContain('went down');
  });

  it('TC-CRON-05: no notification when state is unchanged', async () => {
    vi.mocked(prisma.providerState.findMany).mockResolvedValue([
      providerStateOperational('claude'),
    ] as never);

    let telegramCalled = false;
    server.use(
      http.post(/https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/, () => {
        telegramCalled = true;
        return HttpResponse.json({ ok: true, result: { message_id: 1 } });
      }),
    );

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toEqual([]);
    expect(telegramCalled).toBe(false);
    expect(vi.mocked(prisma.providerStateHistory.createMany)).not.toHaveBeenCalled();
  });

  it('TC-CRON-06: no notification for incident-to-incident transition', async () => {
    vi.mocked(prisma.providerState.findMany).mockResolvedValue([
      { id: 'claude', indicator: 'degraded', updatedAt: new Date() },
    ] as never);

    server.use(
      http.get('https://status.claude.com/api/v2/summary.json', () =>
        HttpResponse.json(atlassianMajorOutage),
      ),
    );

    let telegramCalled = false;
    server.use(
      http.post(/https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/, () => {
        telegramCalled = true;
        return HttpResponse.json({ ok: true, result: { message_id: 1 } });
      }),
    );

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toEqual([]);
    expect(telegramCalled).toBe(false);
    expect(vi.mocked(prisma.providerStateHistory.createMany)).toHaveBeenCalledWith({
      data: expect.arrayContaining([{
        providerId: 'claude',
        fromState: 'degraded',
        toState: 'major_outage',
      }]),
    });
  });

  it('TC-CRON-07: handles multiple providers changing simultaneously', async () => {
    vi.mocked(prisma.providerState.findMany).mockResolvedValue([
      providerStateOperational('claude'),
      providerStateMajorOutage('openai'),
    ] as never);

    server.use(
      http.get('https://status.claude.com/api/v2/summary.json', () =>
        HttpResponse.json(atlassianMajorOutage),
      ),
    );

    let telegramCallCount = 0;
    server.use(
      http.post(/https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/, () => {
        telegramCallCount++;
        return HttpResponse.json({ ok: true, result: { message_id: telegramCallCount } });
      }),
    );

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toHaveLength(2);
    expect(body.changed).toContain('claude');
    expect(body.changed).toContain('openai');
    expect(telegramCallCount).toBe(2);
    expect(vi.mocked(prisma.providerStateHistory.createMany)).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { providerId: 'claude', fromState: 'operational', toState: 'major_outage' },
        { providerId: 'openai', fromState: 'major_outage', toState: 'operational' },
      ]),
    });
  });

  it('TC-CRON-08: Telegram failure does not crash the cron', async () => {
    vi.mocked(prisma.providerState.findMany).mockResolvedValue([
      providerStateOperational('claude'),
    ] as never);

    server.use(
      http.get('https://status.claude.com/api/v2/summary.json', () =>
        HttpResponse.json(atlassianMajorOutage),
      ),
      http.post(/https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/, () =>
        HttpResponse.json(
          { ok: false, description: 'Forbidden: bot was kicked from the group chat' },
          { status: 403 },
        ),
      ),
    );

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeDefined();
    expect(body.errors[0]).toContain('CLAUDE');
    // State was still updated
    expect(vi.mocked(prisma.providerState.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'claude' },
        update: { indicator: 'major_outage' },
      }),
    );
  });

  it('TC-CRON-09: purges ProviderStateHistory records older than 7 days', async () => {
    vi.mocked(prisma.providerStateHistory.deleteMany).mockResolvedValue({ count: 2 });

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purged).toBe(2);

    const deleteCall = vi.mocked(prisma.providerStateHistory.deleteMany).mock.calls[0][0];
    const cutoff = (deleteCall as { where: { createdAt: { lt: Date } } }).where.createdAt.lt;
    const expectedMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedMs)).toBeLessThan(2000);
  });

  it('TC-CRON-10: does not purge rows exactly 7 days old', async () => {
    vi.mocked(prisma.providerStateHistory.deleteMany).mockResolvedValue({ count: 0 });

    const FIXED_NOW = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purged).toBe(0);

    const deleteCall = vi.mocked(prisma.providerStateHistory.deleteMany).mock.calls[0][0];
    const cutoff = (deleteCall as { where: { createdAt: { lt: Date } } }).where.createdAt.lt;
    const exactlySevenDaysAgo = new Date(FIXED_NOW - 7 * 24 * 60 * 60 * 1000);
    // Row exactly 7 days old has createdAt === cutoff, which is NOT lt cutoff → not purged
    expect(cutoff.getTime()).toBe(exactlySevenDaysAgo.getTime());

    vi.restoreAllMocks();
  });

  it('TC-CRON-11: cold start with mixed statuses — no Telegram, no history rows', async () => {
    server.use(
      http.get('https://status.claude.com/api/v2/summary.json', () =>
        HttpResponse.json(atlassianMajorOutage),
      ),
      http.get('https://status.openai.com/api/v2/summary.json', () =>
        HttpResponse.json(atlassianDegraded),
      ),
    );

    let telegramCalled = false;
    server.use(
      http.post(/https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/, () => {
        telegramCalled = true;
        return HttpResponse.json({ ok: true, result: { message_id: 1 } });
      }),
    );

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(8);
    expect(body.changed).toEqual([]);
    expect(telegramCalled).toBe(false);
    expect(vi.mocked(prisma.providerStateHistory.createMany)).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.providerState.upsert)).toHaveBeenCalledTimes(8);
  });
});
