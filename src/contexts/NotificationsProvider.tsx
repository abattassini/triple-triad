import { useCallback, useEffect, useState } from 'react';
import { apiService, type GameNotification } from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { useAuth } from './AuthContext';
import { NotificationsContext, type NotificationsContextValue } from './NotificationsContext';

/**
 * The single owner of the notification state (`plans/PLAN-022-notifications-and-friends/plan.md` §3.5): the badge's
 * number, the list, the SignalR subscription and the reads that keep them honest. One owner is what stops the bell and
 * the panel from disagreeing — the panel never fetches for itself, it asks this for a fresh page.
 *
 * The discipline the whole feature rests on (§5 D6): **the row is the truth, a push is a hint, a re-read is the
 * reconciliation**. The push carries one number and nothing else; the list is read when the panel opens, and again
 * after an action. A hint that never arrives costs a delay, not a notification — the next open or reconnect reads it.
 */
export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  // The same hook the board uses. The socket underneath is ref-counted, so the bell holding it open and the board
  // holding it open are two holders of one connection rather than a fight over it (`signalr.ts`, §5 D10).
  const { isConnected, on, off, subscribeToNotifications, reconnectCount } = useSignalR();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The badge's number alone — `limit=0` costs no rows. Deliberately quiet on failure: a number that cannot refresh
  // is not worth an error on screen, and the next push or panel-open reconciles it.
  const refreshCount = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      const page = await apiService.getNotifications(0);
      setUnreadCount(page.unreadCount);
    } catch {
      // Nothing to do: the badge keeps the number it has.
    }
  }, [isAuthenticated]);

  const refresh = useCallback(
    async ({ markVisibleRead = false }: { markVisibleRead?: boolean } = {}) => {
      if (!isAuthenticated) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const page = await apiService.getNotifications();
        setNotifications(page.notifications);
        setUnreadCount(page.unreadCount);

        if (!markVisibleRead) {
          return;
        }

        // The rows the player is now looking at are seen: one request per unread row rather than a bulk *mark
        // everything read*, which would silently clear rows that are not on screen. Every answer carries the count as
        // it stands, and each is smaller than the last, so the final one is the badge's number.
        const unread = page.notifications.filter(row => row.readAt === null);
        if (unread.length === 0) {
          return;
        }

        let count = page.unreadCount;
        for (const row of unread) {
          count = (await apiService.markNotificationRead(row.id)).unreadCount;
        }

        const seenAt = new Date().toISOString();
        setNotifications(rows =>
          rows.map(row => (row.readAt === null ? { ...row, readAt: seenAt } : row))
        );
        setUnreadCount(count);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not load your notifications.');
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated]
  );

  const markAllRead = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    const result = await apiService.markAllNotificationsRead();
    const seenAt = new Date().toISOString();
    // The rows stay listed — what is left after an answer is news, and news is worth reading — but none of them counts
    // now. (An answered request is not among them: the server stops listing it, §3.4.)
    setNotifications(rows =>
      rows.map(row => (row.readAt === null ? { ...row, readAt: seenAt } : row))
    );
    setUnreadCount(result.unreadCount);
  }, [isAuthenticated]);

  // The number is read once per session, so the bell is right on the first paint of any page — not only after the
  // panel has been opened. Signing out clears it: on a shared screen the badge must not outlive the session.
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      setError(null);
      return;
    }

    void refreshCount();
  }, [isAuthenticated, refreshCount]);

  // The push. Two things are needed for it to work, and both belong to the connection rather than to the app: joining
  // the player's group, and listening. `reconnectCount` is in the deps because a reconnect is a *new* connection whose
  // server-side groups did not follow it — without re-subscribing, the bell would go quiet after the first blip and
  // never say so (the lesson `PLAN-018` recorded for the board).
  useEffect(() => {
    if (!isAuthenticated || !isConnected) {
      return;
    }

    void subscribeToNotifications().catch((failure: unknown) => {
      console.error('Could not subscribe to notifications:', failure);
    });

    const handleChange = (...args: unknown[]) => {
      // The hint says how many are unread, and that is all it is trusted for: the row is the notification, and the list
      // is read when the panel opens rather than rendered from a push.
      const payload = args[0] as { unreadCount?: number } | undefined;
      if (typeof payload?.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
      } else {
        void refreshCount();
      }
    };

    on('NotificationsChanged', handleChange);

    return () => {
      off('NotificationsChanged', handleChange);
    };
  }, [
    isAuthenticated,
    isConnected,
    reconnectCount,
    on,
    off,
    subscribeToNotifications,
    refreshCount,
  ]);

  const value: NotificationsContextValue = {
    unreadCount,
    notifications,
    isLoading,
    error,
    refresh,
    markAllRead,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};
