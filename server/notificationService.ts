import { createNotification } from './notificationDb';
import { getNotificationPreferences } from './notificationDb';

/**
 * Notification types and their default configurations
 */
export const NOTIFICATION_TYPES = {
  DNS_TEST_COMPLETE: 'DNS_TEST_COMPLETE',
  DNS_TEST_FAILED: 'DNS_TEST_FAILED',
  PROXY_STATUS_CHANGED: 'PROXY_STATUS_CHANGED',
  PROXY_ERROR: 'PROXY_ERROR',
  BENCHMARK_COMPLETE: 'BENCHMARK_COMPLETE',
  ALERT: 'ALERT',
  INFO: 'INFO',
} as const;

/**
 * Create a DNS test completion notification
 */
export async function notifyDnsTestComplete(
  userId: number,
  domains: string[],
  fastestProvider: string,
  averageTime: number
) {
  const prefs = await getNotificationPreferences(userId);
  if (prefs?.dnsTestAlerts === 0) return;

  return await createNotification(userId, {
    type: 'DNS_TEST_COMPLETE',
    title: 'DNS Test Completed',
    message: `Tested ${domains.length} domain${domains.length !== 1 ? 's' : ''}. Fastest provider: ${fastestProvider} (${averageTime}ms avg)`,
    data: JSON.stringify({
      domains,
      fastestProvider,
      averageTime,
      domainCount: domains.length,
    }),
    actionLabel: 'View Results',
    actionUrl: '/',
  });
}

/**
 * Create a DNS test failure notification
 */
export async function notifyDnsTestFailed(
  userId: number,
  domain: string,
  error: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (prefs?.dnsTestAlerts === 0) return;

  return await createNotification(userId, {
    type: 'DNS_TEST_FAILED',
    title: 'DNS Test Failed',
    message: `Failed to test domain: ${domain}. Error: ${error}`,
    data: JSON.stringify({
      domain,
      error,
    }),
  });
}

/**
 * Create a proxy status change notification
 */
export async function notifyProxyStatusChanged(
  userId: number,
  isEnabled: boolean,
  provider?: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (prefs?.proxyStatusAlerts === 0) return;

  const status = isEnabled ? 'enabled' : 'disabled';
  const message = isEnabled
    ? `DNS Proxy is now ${status}. Using ${provider || 'fastest provider'} for DNS resolution.`
    : `DNS Proxy has been ${status}.`;

  return await createNotification(userId, {
    type: 'PROXY_STATUS_CHANGED',
    title: `DNS Proxy ${isEnabled ? 'Enabled' : 'Disabled'}`,
    message,
    data: JSON.stringify({
      isEnabled,
      provider,
    }),
    actionLabel: 'Configure',
    actionUrl: '/proxy',
  });
}

/**
 * Create a proxy error notification
 */
export async function notifyProxyError(
  userId: number,
  error: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (prefs?.proxyStatusAlerts === 0) return;

  return await createNotification(userId, {
    type: 'PROXY_ERROR',
    title: 'DNS Proxy Error',
    message: `An error occurred with the DNS Proxy: ${error}`,
    data: JSON.stringify({
      error,
    }),
    actionLabel: 'View Proxy Settings',
    actionUrl: '/proxy',
  });
}

/**
 * Create a benchmark completion notification
 */
export async function notifyBenchmarkComplete(
  userId: number,
  domainCount: number,
  providerCount: number,
  fastestProvider: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (prefs?.benchmarkAlerts === 0) return;

  return await createNotification(userId, {
    type: 'BENCHMARK_COMPLETE',
    title: 'Benchmark Complete',
    message: `Benchmark completed for ${domainCount} domain${domainCount !== 1 ? 's' : ''} across ${providerCount} provider${providerCount !== 1 ? 's' : ''}. Fastest: ${fastestProvider}`,
    data: JSON.stringify({
      domainCount,
      providerCount,
      fastestProvider,
    }),
    actionLabel: 'View Results',
    actionUrl: '/',
  });
}

/**
 * Create a generic alert notification
 */
export async function notifyAlert(
  userId: number,
  title: string,
  message: string,
  data?: Record<string, any>,
  actionUrl?: string,
  actionLabel?: string
) {
  return await createNotification(userId, {
    type: 'ALERT',
    title,
    message,
    data: data ? JSON.stringify(data) : undefined,
    actionUrl,
    actionLabel,
  });
}

/**
 * Create an info notification
 */
export async function notifyInfo(
  userId: number,
  title: string,
  message: string,
  data?: Record<string, any>,
  actionUrl?: string,
  actionLabel?: string
) {
  return await createNotification(userId, {
    type: 'INFO',
    title,
    message,
    data: data ? JSON.stringify(data) : undefined,
    actionUrl,
    actionLabel,
  });
}
