import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './daily-job';

describe('daily-job handler authorization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should block access when CRON_SECRET is undefined even with header "Bearer undefined"', async () => {
    process.env.CRON_SECRET = undefined;
    process.env.IS_DEV = "false"; // Ensure IS_DEV is not "true"

    const request = new Request('http://localhost/api/daily-job', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer undefined',
        'Content-Type': 'application/json'
      }
    });

    const response = await handler(request);

    // With the fix, this should now correctly return 401 Unauthorized
    expect(response.status).toBe(401);
  });

  it('should deny access when CRON_SECRET is set but header is wrong', async () => {
    process.env.CRON_SECRET = 'super-secret';
    process.env.IS_DEV = "false";

    const request = new Request('http://localhost/api/daily-job', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrong-secret',
        'Content-Type': 'application/json'
      }
    });

    const response = await handler(request);
    expect(response.status).toBe(401);
  });

  it('should allow access in development mode without a valid secret', async () => {
    process.env.IS_DEV = "true";
    process.env.CRON_SECRET = undefined;

    const request = new Request('http://localhost/api/daily-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await handler(request);

    // Should bypass auth and fail on missing Supabase env (500) or succeed (200)
    // The key is that it's NOT 401.
    expect(response.status).not.toBe(401);
  });

  it('should block access even with x-vercel-cron header (vulnerability fix)', async () => {
    process.env.IS_DEV = "false";
    process.env.CRON_SECRET = "secure-secret";

    const request = new Request('http://localhost/api/daily-job', {
      method: 'POST',
      headers: {
        'x-vercel-cron': '1',
        'Content-Type': 'application/json'
      }
    });

    const response = await handler(request);

    // After fix, this should now return 401 Unauthorized
    expect(response.status).toBe(401);
  });
});
