import { describe, it, expect, vi, beforeEach } from 'vitest';
import { measureDoHBatch, jsonQuery, DoHProvider } from './doh';

// Mock fetch globally
global.fetch = vi.fn();

describe('measureDoHBatch', () => {
  it('should successfully resolve DNS queries', async () => {
    // Return ok for both API and fallback calls
    (global.fetch as any).mockImplementation((url) => {
      if (url.includes('/api/dns-query')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                domain: 'google.com',
                provider: 'cloudflare',
                latency: 15,
                success: true,
                method: 'server-udp',
                error: null
              }
            ],
            timedOut: false
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ Answer: [{ data: '1.1.1.1' }] })
      });
    });


    const provider = {
      key: 'cloudflare',
      name: 'Cloudflare',
      url: 'https://cloudflare-dns.com/dns-query',
      color: '#f58220',
      format: 'binary' as const
    };

    const results = await measureDoHBatch(['google.com'], provider, 1, 'A');

    expect(results['google.com']).toBeDefined();
    expect(results['google.com'].successRate).toBe(100);
    expect(results['google.com'].method).toBe('server-udp');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('jsonQuery', () => {
  const provider: DoHProvider = {
    key: 'google',
    name: 'Google',
    url: 'https://dns.google/resolve',
    color: '#4285f4',
    format: 'json'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return successful result when fetch succeeds with valid JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ Answer: [{ data: '8.8.8.8' }] })
    });

    const result = await jsonQuery(provider, 'google.com', 'A');

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.latency).toBeGreaterThan(0);
  });

  it('should return failure result when response.ok is false', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404
    });

    const result = await jsonQuery(provider, 'google.com', 'A');

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
  });

  it('should catch error when response.json() throws', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('Invalid JSON'); }
    });

    const result = await jsonQuery(provider, 'google.com', 'A');

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.latency).toBe(0);
  });

  it('should catch error when fetch rejects', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network failure'));

    const result = await jsonQuery(provider, 'google.com', 'A');

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.latency).toBe(0);
  });

  it('should catch error when provider URL is invalid', async () => {
    const invalidProvider: DoHProvider = {
      ...provider,
      url: 'not-a-url'
    };

    const result = await jsonQuery(invalidProvider, 'google.com', 'A');

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.latency).toBe(0);
  });
});
