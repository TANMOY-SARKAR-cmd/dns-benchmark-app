import { describe, it, expect } from 'vitest';
import { GET } from './health';

describe('GET /api/health', () => {
  it('should return a 200 status code', async () => {
    const request = new Request('https://example.com/api/health');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('should return status ok in JSON body', async () => {
    const request = new Request('https://example.com/api/health');
    const response = await GET(request);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('should have correct headers', async () => {
    const request = new Request('https://example.com/api/health');
    const response = await GET(request);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
