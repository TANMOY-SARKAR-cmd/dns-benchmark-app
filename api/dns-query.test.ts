import { describe, it, expect } from 'vitest';
import { validateCustomUrl } from './dns-query';

describe('validateCustomUrl', () => {
  it('should allow valid HTTPS URLs', () => {
    expect(validateCustomUrl('https://example.com/dns-query')).toBe(true);
    expect(validateCustomUrl('https://1.1.1.1/dns-query')).toBe(true);
    expect(validateCustomUrl('https://dns.google/resolve')).toBe(true);
  });

  it('should block non-HTTPS protocols', () => {
    expect(validateCustomUrl('http://example.com/dns-query')).toBe(false);
    expect(validateCustomUrl('ftp://example.com/dns-query')).toBe(false);
    expect(validateCustomUrl('ws://example.com/dns-query')).toBe(false);
    expect(validateCustomUrl('file:///etc/passwd')).toBe(false);
  });

  it('should handle invalid URLs gracefully', () => {
    expect(validateCustomUrl('not-a-url')).toBe(false);
    expect(validateCustomUrl('')).toBe(false);
    expect(validateCustomUrl('https://')).toBe(false);
  });

  it('should block localhost', () => {
    expect(validateCustomUrl('https://localhost/dns-query')).toBe(false);
    expect(validateCustomUrl('https://localhost:8080/dns-query')).toBe(false);
  });

  describe('blocking private IP ranges', () => {
    it('should block loopback addresses (127.x.x.x)', () => {
      expect(validateCustomUrl('https://127.0.0.1/dns-query')).toBe(false);
      expect(validateCustomUrl('https://127.123.45.67/dns-query')).toBe(false);
    });

    it('should block Class A private addresses (10.x.x.x)', () => {
      expect(validateCustomUrl('https://10.0.0.1/dns-query')).toBe(false);
      expect(validateCustomUrl('https://10.255.255.255/dns-query')).toBe(false);
    });

    it('should block Class B private addresses (172.16.x.x - 172.31.x.x)', () => {
      expect(validateCustomUrl('https://172.16.0.1/dns-query')).toBe(false);
      expect(validateCustomUrl('https://172.20.10.1/dns-query')).toBe(false);
      expect(validateCustomUrl('https://172.31.255.255/dns-query')).toBe(false);

      // Should allow public 172.x addresses outside the private range
      expect(validateCustomUrl('https://172.15.255.255/dns-query')).toBe(true);
      expect(validateCustomUrl('https://172.32.0.1/dns-query')).toBe(true);
    });

    it('should block Class C private addresses (192.168.x.x)', () => {
      expect(validateCustomUrl('https://192.168.0.1/dns-query')).toBe(false);
      expect(validateCustomUrl('https://192.168.1.254/dns-query')).toBe(false);
      expect(validateCustomUrl('https://192.168.255.255/dns-query')).toBe(false);

      // Should allow public 192.x addresses outside the private range
      expect(validateCustomUrl('https://192.167.255.255/dns-query')).toBe(true);
      expect(validateCustomUrl('https://192.169.0.1/dns-query')).toBe(true);
    });
  });
});
