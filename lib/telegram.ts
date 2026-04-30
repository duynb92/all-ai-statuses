import { escapeMd } from './telegram-escape';

const EMOJI: Record<string, string> = {
  operational: '✅',
  degraded: '🟡',
  partial_outage: '🟠',
  major_outage: '🔴',
  unknown: '⚪',
};

function emojiFor(indicator: string): string {
  return EMOJI[indicator] ?? '⚪';
}

function buildMessage(payload: {
  provider: string;
  from: string;
  to: string;
  description: string;
  type: 'incident' | 'recovery';
}): string {
  const { provider, from, to, description, type } = payload;
  const emoji = type === 'recovery' ? '✅' : emojiFor(to);
  const verb = type === 'recovery' ? 'recovered' : 'went down';
  return [
    `${emoji} *${provider}* ${verb}`,
    `\`${from}\` → \`${to}\``,
    '',
    escapeMd(description) + '\\.',
  ].join('\n');
}

export async function sendTelegramNotification(payload: {
  provider: string;
  from: string;
  to: string;
  description: string;
  type: 'incident' | 'recovery';
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not set');

  const text = buildMessage(payload);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 429) {
      throw new Error(`Telegram rate limit exceeded. retry_after: ${(body as { parameters?: { retry_after?: number } })?.parameters?.retry_after}`);
    }
    throw new Error(`Telegram API error ${res.status}: ${(body as { description?: string })?.description ?? res.statusText}`);
  }
}
