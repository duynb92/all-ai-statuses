import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/handlers';

process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.TELEGRAM_CHAT_ID = '-1001234567890';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_TELEGRAM_GROUP_LINK = 'https://t.me/+testInviteCode';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
