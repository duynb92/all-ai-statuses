import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  atlassianOperational,
  proxyOperational,
} from './fixtures';

export const handlers = [
  http.post('https://api.telegram.org/bot:token/sendMessage', () =>
    HttpResponse.json({ ok: true, result: { message_id: 1 } }),
  ),
  // Wildcard to match any bot token
  http.post(/https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/, () =>
    HttpResponse.json({ ok: true, result: { message_id: 1 } }),
  ),

  http.get('https://status.claude.com/api/v2/summary.json', () =>
    HttpResponse.json(atlassianOperational),
  ),
  http.get('https://status.openai.com/api/v2/summary.json', () =>
    HttpResponse.json(atlassianOperational),
  ),
  http.get('https://groqstatus.com/api/v2/summary.json', () =>
    HttpResponse.json(atlassianOperational),
  ),
  http.get('https://status.cohere.com/api/v2/summary.json', () =>
    HttpResponse.json(atlassianOperational),
  ),
  http.get('https://status.deepseek.com/api/v2/summary.json', () =>
    HttpResponse.json(atlassianOperational),
  ),

  http.get('http://localhost:3000/api/status/gemini', () =>
    HttpResponse.json(proxyOperational),
  ),
  http.get('http://localhost:3000/api/status/mistral', () =>
    HttpResponse.json(proxyOperational),
  ),
  http.get('http://localhost:3000/api/status/perplexity', () =>
    HttpResponse.json(proxyOperational),
  ),
];

export const server = setupServer(...handlers);
