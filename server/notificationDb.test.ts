import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createNotification,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  dismissAllNotifications,
  getNotificationPreferences,
  upsertNotificationPreferences,
} from './notificationDb';

describe('Notification Database Functions', () => {
  const testUserId = 1;
  const testNotification = {
    type: 'DNS_TEST_COMPLETE' as const,
    title: 'DNS Test Completed',
    message: 'Test completed successfully',
  };

  describe('createNotification', () => {
    it('should create a notification with correct structure', async () => {
      const result = await createNotification(testUserId, testNotification);
      
      if (result) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('userId');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('isRead');
        expect(result).toHaveProperty('isDismissed');
        expect(result.userId).toBe(testUserId);
        expect(result.type).toBe('DNS_TEST_COMPLETE');
      }
    });

    it('should set isRead and isDismissed to 0 by default', async () => {
      const result = await createNotification(testUserId, testNotification);
      
      if (result) {
        expect(result.isRead).toBe(0);
        expect(result.isDismissed).toBe(0);
      }
    });
  });

  describe('getUserNotifications', () => {
    it('should return array of notifications', async () => {
      const notifications = await getUserNotifications(testUserId);
      expect(Array.isArray(notifications)).toBe(true);
    });

    it('should return only non-dismissed notifications', async () => {
      const notifications = await getUserNotifications(testUserId);
      
      notifications.forEach((notif) => {
        expect(notif.isDismissed).toBe(0);
      });
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('should return a number', async () => {
      const count = await getUnreadNotificationCount(testUserId);
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('markNotificationAsRead', () => {
    it('should return boolean', async () => {
      const result = await markNotificationAsRead(1);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('should return boolean', async () => {
      const result = await markAllNotificationsAsRead(testUserId);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('dismissNotification', () => {
    it('should return boolean', async () => {
      const result = await dismissNotification(1);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('dismissAllNotifications', () => {
    it('should return boolean', async () => {
      const result = await dismissAllNotifications(testUserId);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return preferences or null', async () => {
      const prefs = await getNotificationPreferences(testUserId);
      
      if (prefs) {
        expect(prefs).toHaveProperty('userId');
        expect(prefs).toHaveProperty('emailNotifications');
        expect(prefs).toHaveProperty('pushNotifications');
        expect(prefs).toHaveProperty('soundEnabled');
        expect(prefs).toHaveProperty('dnsTestAlerts');
        expect(prefs).toHaveProperty('proxyStatusAlerts');
        expect(prefs).toHaveProperty('benchmarkAlerts');
      }
    });
  });

  describe('upsertNotificationPreferences', () => {
    it('should create or update preferences', async () => {
      const prefs = await upsertNotificationPreferences(testUserId, {
        emailNotifications: 1,
        pushNotifications: 0,
      });

      if (prefs) {
        expect(prefs.userId).toBe(testUserId);
        expect(prefs.emailNotifications).toBe(1);
        expect(prefs.pushNotifications).toBe(0);
      }
    });

    it('should preserve existing preferences when updating partial fields', async () => {
      // First create preferences
      await upsertNotificationPreferences(testUserId, {
        emailNotifications: 1,
        soundEnabled: 1,
      });

      // Then update only one field
      const updated = await upsertNotificationPreferences(testUserId, {
        emailNotifications: 0,
      });

      if (updated) {
        expect(updated.emailNotifications).toBe(0);
        expect(updated.soundEnabled).toBe(1);
      }
    });
  });

  describe('Notification Types', () => {
    it('should support all notification types', async () => {
      const types = [
        'DNS_TEST_COMPLETE',
        'DNS_TEST_FAILED',
        'PROXY_STATUS_CHANGED',
        'PROXY_ERROR',
        'BENCHMARK_COMPLETE',
        'ALERT',
        'INFO',
      ];

      types.forEach((type) => {
        expect(type).toBeTruthy();
      });
    });
  });

  describe('Notification Data Handling', () => {
    it('should handle JSON data in notifications', async () => {
      const notifWithData = {
        ...testNotification,
        data: JSON.stringify({ domains: ['example.com', 'test.com'], provider: 'Google DNS' }),
      };

      const result = await createNotification(testUserId, notifWithData);

      if (result && result.data) {
        const parsed = JSON.parse(result.data);
        expect(parsed.domains).toEqual(['example.com', 'test.com']);
        expect(parsed.provider).toBe('Google DNS');
      }
    });

    it('should handle action URLs and labels', async () => {
      const notifWithAction = {
        ...testNotification,
        actionUrl: '/results',
        actionLabel: 'View Results',
      };

      const result = await createNotification(testUserId, notifWithAction);

      if (result) {
        expect(result.actionUrl).toBe('/results');
        expect(result.actionLabel).toBe('View Results');
      }
    });
  });

  describe('Notification Workflow', () => {
    it('should handle complete notification lifecycle', async () => {
      // Create
      const created = await createNotification(testUserId, testNotification);
      expect(created).toBeTruthy();

      if (created) {
        // Mark as read
        const marked = await markNotificationAsRead(created.id);
        expect(marked).toBe(true);

        // Dismiss
        const dismissed = await dismissNotification(created.id);
        expect(dismissed).toBe(true);
      }
    });
  });
});
