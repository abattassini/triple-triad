import { createContext, useContext } from 'react';
import type { GameNotification } from '../services/api';

export interface NotificationsContextValue {
  /** What the bell's badge shows. */
  unreadCount: number;
  /** The page the panel lists — empty until it opens. */
  notifications: GameNotification[];
  /** True while the list is being (re)read. */
  isLoading: boolean;
  error: string | null;
  /**
   * Re-reads the inbox: the count, and the list. `markVisibleRead` is what opening the panel asks for — the rows the
   * player is now looking at stop counting against the badge.
   */
  refresh: (options?: { markVisibleRead?: boolean }) => Promise<void>;
  /** Marks every row read — the panel's *Mark all read*. */
  markAllRead: () => Promise<void>;
}

/**
 * The notification state, read through `useNotifications` below. The context and its hook live here and the provider
 * lives in `NotificationsProvider.tsx`, the same split `AuthContext`/`AuthProvider` makes: both halves have to exist,
 * and the `react-refresh` lint rule wants a module to export either components or values, not both
 * (`plans/PLAN-022-notifications-and-friends/plan.md` §3.5).
 */
export const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const useNotifications = (): NotificationsContextValue => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
