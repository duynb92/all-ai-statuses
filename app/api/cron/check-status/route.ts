import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAllProviders } from '@/lib/status-fetcher';
import { detectTransition } from '@/lib/transition';
import { sendTelegramNotification } from '@/lib/telegram';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const statuses = await fetchAllProviders();
  const providerIds = Object.keys(statuses);

  const existing = await prisma.providerState.findMany();
  const stateMap = new Map(existing.map(r => [r.id, r.indicator]));

  const changed: string[] = [];
  const historyInserts: { providerId: string; fromState: string; toState: string }[] = [];
  const stateUpserts: { id: string; indicator: string }[] = [];
  const notifications: Array<{
    provider: string; from: string; to: string; description: string; type: 'incident' | 'recovery';
  }> = [];

  for (const id of providerIds) {
    const newIndicator = statuses[id].indicator;
    const oldIndicator = stateMap.get(id) ?? null;
    const result = detectTransition(oldIndicator, newIndicator);

    stateUpserts.push({ id, indicator: newIndicator });

    if (oldIndicator !== null && oldIndicator !== newIndicator) {
      historyInserts.push({ providerId: id, fromState: oldIndicator, toState: newIndicator });
    }

    if (result.notify) {
      changed.push(id);
      notifications.push({
        provider: id.toUpperCase(),
        from: oldIndicator!,
        to: newIndicator,
        description: statuses[id].description,
        type: result.type,
      });
    }
  }

  await Promise.all(
    stateUpserts.map(u =>
      prisma.providerState.upsert({
        where: { id: u.id },
        create: { id: u.id, indicator: u.indicator },
        update: { indicator: u.indicator },
      }),
    ),
  );

  if (historyInserts.length > 0) {
    await prisma.providerStateHistory.createMany({ data: historyInserts });
  }

  const errors: string[] = [];
  for (const n of notifications) {
    try {
      await sendTelegramNotification(n);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${n.provider}: ${msg}`);
      console.error(`[cron] Telegram notification failed for ${n.provider}:`, msg);
    }
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const purgeResult = await prisma.providerStateHistory.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return NextResponse.json({
    checked: providerIds.length,
    changed,
    purged: purgeResult.count,
    errors: errors.length > 0 ? errors : undefined,
  });
}
