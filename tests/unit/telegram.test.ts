import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../mocks/handlers';
import { sendTelegramNotification } from '@/lib/telegram';
import { escapeMd } from '@/lib/telegram-escape';

const TELEGRAM_URL = /https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/;

describe('sendTelegramNotification', () => {
  it('TC-TG-01: sends incident message with correct payload', async () => {
    let captured: Record<string, unknown> = {};
    server.use(
      http.post(TELEGRAM_URL, async ({ request }) => {
        captured = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ok: true, result: { message_id: 1 } });
      }),
    );

    await sendTelegramNotification({
      provider: 'CLAUDE',
      from: 'operational',
      to: 'major_outage',
      description: 'API errors affecting completions.',
      type: 'incident',
    });

    expect(captured.chat_id).toBe(process.env.TELEGRAM_CHAT_ID);
    expect(captured.parse_mode).toBe('MarkdownV2');
    expect(captured.text).toMatch(/^🔴/);
    expect(captured.text).toContain('*CLAUDE*');
    expect(captured.text).toContain('went down');
    expect(captured.text).toContain(escapeMd('API errors affecting completions.'));
  });

  it('TC-TG-02: sends recovery message with correct payload', async () => {
    let captured: Record<string, unknown> = {};
    server.use(
      http.post(TELEGRAM_URL, async ({ request }) => {
        captured = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ok: true, result: { message_id: 2 } });
      }),
    );

    await sendTelegramNotification({
      provider: 'CLAUDE',
      from: 'major_outage',
      to: 'operational',
      description: 'All systems operational.',
      type: 'recovery',
    });

    expect(captured.text).toMatch(/^✅/);
    expect(captured.text).toContain('recovered');
  });

  it('TC-TG-03: maps each indicator to correct emoji', async () => {
    const cases: [string, string][] = [
      ['degraded', '🟡'],
      ['partial_outage', '🟠'],
      ['major_outage', '🔴'],
      ['unknown', '⚪'],
      ['operational', '✅'],
    ];

    for (const [indicator, emoji] of cases) {
      let capturedText = '';
      server.use(
        http.post(TELEGRAM_URL, async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          capturedText = body.text as string;
          return HttpResponse.json({ ok: true, result: { message_id: 1 } });
        }),
      );

      await sendTelegramNotification({
        provider: 'TEST',
        from: 'operational',
        to: indicator,
        description: 'test',
        type: 'incident',
      });

      expect(capturedText, `indicator ${indicator}`).toMatch(new RegExp(`^${emoji}`));
    }
  });

  describe('TC-TG-04: throws on missing TELEGRAM_BOT_TOKEN', () => {
    let savedToken: string | undefined;
    beforeEach(() => {
      savedToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;
    });
    afterEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = savedToken;
    });

    it('throws descriptive error', async () => {
      await expect(
        sendTelegramNotification({ provider: 'X', from: 'operational', to: 'major_outage', description: 'test', type: 'incident' }),
      ).rejects.toThrow('TELEGRAM_BOT_TOKEN');
    });
  });

  describe('TC-TG-05: throws on missing TELEGRAM_CHAT_ID', () => {
    let savedChatId: string | undefined;
    beforeEach(() => {
      savedChatId = process.env.TELEGRAM_CHAT_ID;
      delete process.env.TELEGRAM_CHAT_ID;
    });
    afterEach(() => {
      process.env.TELEGRAM_CHAT_ID = savedChatId;
    });

    it('throws descriptive error', async () => {
      await expect(
        sendTelegramNotification({ provider: 'X', from: 'operational', to: 'major_outage', description: 'test', type: 'incident' }),
      ).rejects.toThrow('TELEGRAM_CHAT_ID');
    });
  });

  it('TC-TG-06: throws on 403 Forbidden', async () => {
    server.use(
      http.post(TELEGRAM_URL, () =>
        HttpResponse.json(
          { ok: false, description: 'Forbidden: bot was kicked from the group chat' },
          { status: 403 },
        ),
      ),
    );

    await expect(
      sendTelegramNotification({ provider: 'X', from: 'operational', to: 'major_outage', description: 'test', type: 'incident' }),
    ).rejects.toThrow('Forbidden: bot was kicked from the group chat');
  });

  it('TC-TG-07: throws on 429 rate limit', async () => {
    server.use(
      http.post(TELEGRAM_URL, () =>
        HttpResponse.json(
          { ok: false, parameters: { retry_after: 5 } },
          { status: 429 },
        ),
      ),
    );

    await expect(
      sendTelegramNotification({ provider: 'X', from: 'operational', to: 'major_outage', description: 'test', type: 'incident' }),
    ).rejects.toThrow(/rate limit/i);
  });

  it('TC-TG-08: throws on network timeout', async () => {
    server.use(
      http.post(TELEGRAM_URL, async () => {
        await delay(6000);
        return HttpResponse.json({ ok: true, result: { message_id: 1 } });
      }),
    );

    await expect(
      sendTelegramNotification({ provider: 'X', from: 'operational', to: 'major_outage', description: 'test', type: 'incident' }),
    ).rejects.toThrow();
  }, 10000);
});
