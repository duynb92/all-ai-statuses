import { describe, it, expect } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../mocks/handlers';
import { fetchAllProviders } from '@/lib/status-fetcher';
import {
  atlassianOperational,
  atlassianMajorOutage,
  proxyOperational,
} from '../mocks/fixtures';

describe('fetchAllProviders', () => {
  it('TC-SF-01: fetches and normalizes Atlassian provider (Claude)', async () => {
    const results = await fetchAllProviders();
    expect(results.claude.indicator).toBe('operational');
    expect(results.claude.description).toBe(atlassianOperational.status.description);
    expect(results.claude.incidents).toEqual([]);
  });

  it('TC-SF-02: maps Atlassian indicator values correctly', async () => {
    const cases: [string, string][] = [
      ['none', 'operational'],
      ['minor', 'degraded'],
      ['major', 'partial_outage'],
      ['critical', 'major_outage'],
    ];

    for (const [raw, expected] of cases) {
      server.use(
        http.get('https://status.claude.com/api/v2/summary.json', () =>
          HttpResponse.json({ status: { indicator: raw, description: 'Test' }, incidents: [] }),
        ),
      );
      const results = await fetchAllProviders();
      expect(results.claude.indicator, `raw=${raw}`).toBe(expected);
    }
  });

  it('TC-SF-03: fetches and normalizes proxy provider (Gemini)', async () => {
    const results = await fetchAllProviders();
    expect(results.gemini.indicator).toBe(proxyOperational.indicator);
    expect(results.gemini.description).toBe(proxyOperational.description);
    expect(results.gemini.incidents).toEqual([]);
  });

  it('TC-SF-04: returns unknown when a provider fetch fails (500)', async () => {
    server.use(
      http.get('https://status.claude.com/api/v2/summary.json', () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );
    const results = await fetchAllProviders();
    expect(results.claude.indicator).toBe('unknown');
    expect(results.claude.description).toBe('Fetch failed');
    // Other providers unaffected
    expect(results.openai.indicator).toBe('operational');
  });

  it('TC-SF-05: returns unknown when a provider fetch times out', async () => {
    server.use(
      http.get('https://status.claude.com/api/v2/summary.json', async () => {
        await delay(6000);
        return HttpResponse.json(atlassianOperational);
      }),
    );
    const results = await fetchAllProviders();
    expect(results.claude.indicator).toBe('unknown');
    expect(results.openai.indicator).toBe('operational');
  }, 10000);

  it('TC-SF-06: includes active incidents in the response', async () => {
    server.use(
      http.get('https://status.claude.com/api/v2/summary.json', () =>
        HttpResponse.json(atlassianMajorOutage),
      ),
    );
    const results = await fetchAllProviders();
    expect(results.claude.incidents).toHaveLength(1);
    expect(results.claude.incidents[0].title).toBe('API errors');
    expect(results.claude.incidents[0].began).toBe('2026-04-25T10:00:00Z');
  });

  it('TC-SF-07: returns results for all 8 providers', async () => {
    const results = await fetchAllProviders();
    const ids = Object.keys(results);
    expect(ids).toHaveLength(8);
    expect(ids).toEqual(
      expect.arrayContaining(['claude', 'openai', 'gemini', 'mistral', 'groq', 'cohere', 'deepseek', 'perplexity']),
    );
  });
});
