import { describe, it, expect, vi } from 'vitest';
import { measureDoHBatch } from './doh';

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
