import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bell, X, Check, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // Queries
  const notificationsQuery = trpc.notifications.list.useQuery({ includeRead: true });
  const unreadCountQuery = trpc.notifications.unreadCount.useQuery();
  const preferencesQuery = trpc.notifications.getPreferences.useQuery();

  // Mutations
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation();
  const dismissMutation = trpc.notifications.dismiss.useMutation();
  const dismissAllMutation = trpc.notifications.dismissAll.useMutation();
  const updatePreferencesMutation = trpc.notifications.updatePreferences.useMutation();

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await markAsReadMutation.mutateAsync({ notificationId });
      await unreadCountQuery.refetch();
      await notificationsQuery.refetch();
    } catch (error) {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
      await unreadCountQuery.refetch();
      await notificationsQuery.refetch();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDismiss = async (notificationId: number) => {
    try {
      await dismissMutation.mutateAsync({ notificationId });
      await notificationsQuery.refetch();
    } catch (error) {
      toast.error('Failed to dismiss notification');
    }
  };

  const handleDismissAll = async () => {
    try {
      await dismissAllMutation.mutateAsync();
      await notificationsQuery.refetch();
      toast.success('All notifications dismissed');
    } catch (error) {
      toast.error('Failed to dismiss all');
    }
  };

  const handleUpdatePreferences = async (key: string, value: number) => {
    try {
      await updatePreferencesMutation.mutateAsync({ [key]: value });
      await preferencesQuery.refetch();
      toast.success('Preferences updated');
    } catch (error) {
      toast.error('Failed to update preferences');
    }
  };

  const unreadCount = unreadCountQuery.data || 0;
  const notifications = notificationsQuery.data || [];
  const preferences = preferencesQuery.data;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'DNS_TEST_COMPLETE':
        return '✓';
      case 'DNS_TEST_FAILED':
        return '✕';
      case 'PROXY_STATUS_CHANGED':
        return '⚙';
      case 'ALERT':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'DNS_TEST_COMPLETE':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'DNS_TEST_FAILED':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'PROXY_STATUS_CHANGED':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'ALERT':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className={className}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-md max-h-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>
              {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All notifications read'}
            </DialogDescription>
          </DialogHeader>

          {/* Tabs for Notifications and Preferences */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={!showPreferences ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPreferences(false)}
            >
              Notifications
            </Button>
            <Button
              variant={showPreferences ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPreferences(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Preferences
            </Button>
          </div>

          {!showPreferences ? (
            <>
              {/* Notifications List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <Card
                      key={notification.id}
                      className={`${
                        notification.isRead === 0 ? 'border-blue-500' : ''
                      } cursor-pointer hover:shadow-md transition-shadow`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getNotificationColor(
                              notification.type
                            )}`}
                          >
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm">{notification.title}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {notification.isRead === 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                                title="Mark as read"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDismiss(notification.id)}
                              title="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Action Buttons */}
              {notifications.length > 0 && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleMarkAllAsRead}
                  >
                    Mark all as read
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleDismissAll}
                  >
                    Dismiss all
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Notification Preferences */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Notification Channels</h4>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences?.emailNotifications === 1}
                      onChange={(e) =>
                        handleUpdatePreferences('emailNotifications', e.target.checked ? 1 : 0)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Email Notifications</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences?.pushNotifications === 1}
                      onChange={(e) =>
                        handleUpdatePreferences('pushNotifications', e.target.checked ? 1 : 0)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Push Notifications</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences?.soundEnabled === 1}
                      onChange={(e) =>
                        handleUpdatePreferences('soundEnabled', e.target.checked ? 1 : 0)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Sound Alerts</span>
                  </label>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-semibold text-sm">Alert Types</h4>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences?.dnsTestAlerts === 1}
                      onChange={(e) =>
                        handleUpdatePreferences('dnsTestAlerts', e.target.checked ? 1 : 0)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">DNS Test Results</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences?.proxyStatusAlerts === 1}
                      onChange={(e) =>
                        handleUpdatePreferences('proxyStatusAlerts', e.target.checked ? 1 : 0)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Proxy Status Changes</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences?.benchmarkAlerts === 1}
                      onChange={(e) =>
                        handleUpdatePreferences('benchmarkAlerts', e.target.checked ? 1 : 0)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Benchmark Alerts</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
