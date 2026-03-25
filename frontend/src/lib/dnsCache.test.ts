import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCachedDnsResult, setCachedDnsResult, clearDnsCache, CachedDnsResult } from './dnsCache';

const CACHE_KEY = "dns_cache";
const TTL_MS = 5 * 60 * 1000;

describe('dnsCache', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      length: 0,
      key: vi.fn()
    } as any;

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCachedDnsResult', () => {
    it('returns null if no cache exists', () => {
      const result = getCachedDnsResult('example.com', 'cloudflare');
      expect(result).toBeNull();
    });

    it('returns null if domain:provider key does not exist', () => {
      mockStorage[CACHE_KEY] = JSON.stringify({
        'other.com:google': { latency: 10, success: true, method: 'server-udp', error: null, timestamp: Date.now() }
      });
      const result = getCachedDnsResult('example.com', 'cloudflare');
      expect(result).toBeNull();
    });

    it('returns the cached result if it exists and is not expired', () => {
      const now = Date.now();
      const mockResult: CachedDnsResult = {
        latency: 15,
        success: true,
        method: 'server-udp',
        error: null,
        timestamp: now
      };

      mockStorage[CACHE_KEY] = JSON.stringify({
        'example.com:cloudflare': mockResult
      });

      const result = getCachedDnsResult('example.com', 'cloudflare');
      expect(result).toEqual(mockResult);
    });

    it('returns null and removes the entry if the cached result is expired', () => {
      const now = Date.now();
      const expiredTimestamp = now - TTL_MS - 1000; // 1 second past TTL

      const mockResult: CachedDnsResult = {
        latency: 15,
        success: true,
        method: 'server-udp',
        error: null,
        timestamp: expiredTimestamp
      };

      mockStorage[CACHE_KEY] = JSON.stringify({
        'example.com:cloudflare': mockResult,
        'other.com:google': { ...mockResult, timestamp: now } // Still valid
      });

      const result = getCachedDnsResult('example.com', 'cloudflare');
      expect(result).toBeNull();

      // Ensure it was removed from localStorage but other valid entry is kept
      const cacheStr = mockStorage[CACHE_KEY];
      expect(cacheStr).not.toBeNull();
      const cache = JSON.parse(cacheStr!);
      expect(cache['example.com:cloudflare']).toBeUndefined();
      expect(cache['other.com:google']).toBeDefined();
    });

    it('returns null if JSON.parse fails', () => {
      mockStorage[CACHE_KEY] = 'invalid json';
      const result = getCachedDnsResult('example.com', 'cloudflare');
      expect(result).toBeNull();
    });
  });

  describe('setCachedDnsResult', () => {
    it('saves a new result to the cache with the current timestamp', () => {
      const mockResult: Omit<CachedDnsResult, 'timestamp'> = {
        latency: 20,
        success: true,
        method: 'server-doh',
        error: null
      };

      const now = Date.now();
      setCachedDnsResult('example.com', 'cloudflare', mockResult);

      const cacheStr = mockStorage[CACHE_KEY];
      expect(cacheStr).not.toBeUndefined();
      const cache = JSON.parse(cacheStr!);

      expect(cache['example.com:cloudflare']).toBeDefined();
      expect(cache['example.com:cloudflare'].latency).toBe(20);
      expect(cache['example.com:cloudflare'].timestamp).toBe(now);
    });

    it('cleans up expired entries when saving a new result', () => {
      const now = Date.now();
      const expiredTimestamp = now - TTL_MS - 1000;

      // Setup cache with one valid and one expired entry
      mockStorage[CACHE_KEY] = JSON.stringify({
        'expired.com:google': { latency: 10, success: true, method: 'server-udp', error: null, timestamp: expiredTimestamp },
        'valid.com:google': { latency: 10, success: true, method: 'server-udp', error: null, timestamp: now }
      });

      // Set a new result
      const newResult: Omit<CachedDnsResult, 'timestamp'> = {
        latency: 15,
        success: true,
        method: 'server-doh',
        error: null
      };

      // Advance time slightly to ensure 'now' is distinct for the new entry
      vi.setSystemTime(now + 100);

      setCachedDnsResult('new.com', 'cloudflare', newResult);

      const cacheStr = mockStorage[CACHE_KEY];
      expect(cacheStr).not.toBeUndefined();
      const cache = JSON.parse(cacheStr!);

      // The expired entry should be removed
      expect(cache['expired.com:google']).toBeUndefined();

      // The old valid entry should still exist
      expect(cache['valid.com:google']).toBeDefined();

      // The new entry should exist
      expect(cache['new.com:cloudflare']).toBeDefined();
      expect(cache['new.com:cloudflare'].timestamp).toBe(now + 100);
    });

    it('handles localStorage quota exceeded errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock setItem to throw
      global.localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const mockResult: Omit<CachedDnsResult, 'timestamp'> = {
        latency: 20,
        success: true,
        method: 'server-doh',
        error: null
      };

      // Should not throw
      expect(() => {
        setCachedDnsResult('example.com', 'cloudflare', mockResult);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to write to DNS cache', expect.any(Error));
    });
  });

  describe('clearDnsCache', () => {
    it('removes the cache key from localStorage', () => {
      mockStorage[CACHE_KEY] = JSON.stringify({
        'example.com:cloudflare': { latency: 10, success: true, method: 'server-udp', error: null, timestamp: Date.now() }
      });

      clearDnsCache();

      expect(mockStorage[CACHE_KEY]).toBeUndefined();
      expect(global.localStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });
  });
});
