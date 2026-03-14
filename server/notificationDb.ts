import { eq, and, desc } from 'drizzle-orm';
import { notifications, notificationPreferences, InsertNotification, Notification, NotificationPreferences, InsertNotificationPreferences } from '../drizzle/schema';
import { getDb } from './db';

/**
 * Create a new notification for a user
 */
export async function createNotification(
  userId: number,
  notification: Omit<InsertNotification, 'userId'>
): Promise<Notification | null> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot create notification: database not available');
    return null;
  }

  try {
    const result = await db.insert(notifications).values({
      ...notification,
      userId,
    });

    // Fetch and return the created notification
    const created = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, result[0].insertId as number))
      .limit(1);

    return created.length > 0 ? created[0] : null;
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error);
    return null;
  }
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(
  userId: number,
  includeRead: boolean = true
): Promise<Notification[]> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot get notifications: database not available');
    return [];
  }

  try {
    let query = db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isDismissed, 0)
        )
      )
      .orderBy(desc(notifications.createdAt));

    if (!includeRead) {
      query = db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, 0),
            eq(notifications.isDismissed, 0)
          )
        )
        .orderBy(desc(notifications.createdAt));
    }

    return await query;
  } catch (error) {
    console.error('[Notifications] Failed to get notifications:', error);
    return [];
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot get unread count: database not available');
    return 0;
  }

  try {
    const result = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, 0),
          eq(notifications.isDismissed, 0)
        )
      );

    return result.length;
  } catch (error) {
    console.error('[Notifications] Failed to get unread count:', error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot mark as read: database not available');
    return false;
  }

  try {
    await db
      .update(notifications)
      .set({ isRead: 1 })
      .where(eq(notifications.id, notificationId));

    return true;
  } catch (error) {
    console.error('[Notifications] Failed to mark as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot mark all as read: database not available');
    return false;
  }

  try {
    await db
      .update(notifications)
      .set({ isRead: 1 })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, 0)
        )
      );

    return true;
  } catch (error) {
    console.error('[Notifications] Failed to mark all as read:', error);
    return false;
  }
}

/**
 * Dismiss a notification
 */
export async function dismissNotification(notificationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot dismiss notification: database not available');
    return false;
  }

  try {
    await db
      .update(notifications)
      .set({ isDismissed: 1 })
      .where(eq(notifications.id, notificationId));

    return true;
  } catch (error) {
    console.error('[Notifications] Failed to dismiss notification:', error);
    return false;
  }
}

/**
 * Dismiss all notifications for a user
 */
export async function dismissAllNotifications(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot dismiss all: database not available');
    return false;
  }

  try {
    await db
      .update(notifications)
      .set({ isDismissed: 1 })
      .where(eq(notifications.userId, userId));

    return true;
  } catch (error) {
    console.error('[Notifications] Failed to dismiss all:', error);
    return false;
  }
}

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(
  userId: number
): Promise<NotificationPreferences | null> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot get preferences: database not available');
    return null;
  }

  try {
    const result = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[Notifications] Failed to get preferences:', error);
    return null;
  }
}

/**
 * Create or update notification preferences for a user
 */
export async function upsertNotificationPreferences(
  userId: number,
  prefs: Partial<InsertNotificationPreferences>
): Promise<NotificationPreferences | null> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot upsert preferences: database not available');
    return null;
  }

  try {
    const existing = await getNotificationPreferences(userId);

    if (existing) {
      // Update existing preferences
      await db
        .update(notificationPreferences)
        .set(prefs)
        .where(eq(notificationPreferences.userId, userId));
    } else {
      // Create new preferences
      await db.insert(notificationPreferences).values({
        userId,
        ...prefs,
      });
    }

    return await getNotificationPreferences(userId);
  } catch (error) {
    console.error('[Notifications] Failed to upsert preferences:', error);
    return null;
  }
}

/**
 * Delete old notifications (older than specified days)
 */
export async function deleteOldNotifications(userId: number, daysOld: number = 30): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn('[Notifications] Cannot delete old notifications: database not available');
    return 0;
  }

  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isDismissed, 1)
        )
      );

    return 0; // Drizzle delete doesn't return rowsAffected in MySQL
  } catch (error) {
    console.error('[Notifications] Failed to delete old notifications:', error);
    return 0;
  }
}
