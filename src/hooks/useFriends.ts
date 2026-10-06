import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService, FRIEND_PRESENCE_CHANGED, type FriendSummary } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSignalR } from './useSignalR';

/**
 * How often an open Social page re-reads the list. Not a substitute for the push — it is the **belt to the push's
 * braces**: a hint that never arrives (a dropped socket, a presence the server never heard about) would otherwise leave
 * a wrong dot on screen until the player left the page and came back, which is exactly what one of them reported
 * (`plans/PLAN-023-social-friends-list/plan.md` §11). One read a minute is cheaper than being wrong.
 */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Whether two answers say the same thing, in the same order (the server's, which is ordinal and therefore stable). The
 * point is the heartbeat: a read every minute must not re-render the list when the answer is the one already on screen,
 * so an unchanged answer keeps the state object it had and React bails out.
 */
const sameFriends = (current: FriendSummary[], incoming: FriendSummary[]) =>
  current.length === incoming.length &&
  current.every((friend, index) => {
    const other = incoming[index];
    return (
      friend.login === other.login &&
      friend.avatarUrl === other.avatarUrl &&
      friend.online === other.online
    );
  });

/**
 * The friends list, and the only place it is fetched or changed
 * (`plans/PLAN-023-social-friends-list/plan.md` §3.4). Same shape as `usePackInventory`: the hook owns the data and the
 * page draws it.
 *
 * The discipline is PLAN-022's, applied to presence: **the list read is the truth, the push is a hint**. Mounting reads
 * the list; `FriendPresenceChanged` updates the one row it names; a reconnect re-subscribes and re-reads, because a
 * reconnected socket is a new connection whose groups did not follow it (PLAN-018).
 */
export const useFriends = () => {
  const { isAuthenticated } = useAuth();
  const { on, off, reconnectCount } = useSignalR();

  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read-only from the effect below, so the listener it installs is not re-created on every list change.
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const answer = await apiService.getFriends();
      if (isMounted.current) {
        // Nothing said the same thing twice: the heartbeat's read is a no-op unless the answer moved.
        setFriends(current => (sameFriends(current, answer.friends) ? current : answer.friends));
        setError(null);
      }
    } catch (failure) {
      if (isMounted.current) {
        setError(failure instanceof Error ? failure.message : 'Could not load your friends.');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Removes a friend: the server deletes the pair, and the row leaves the list here and on the re-read that follows. A
   * refusal (an unknown login, or a row somebody else already deleted) surfaces as the thrown sentence, which the
   * confirm dialog shows.
   */
  const remove = useCallback(
    async (login: string) => {
      await apiService.removeFriend(login);
      await refresh();
    },
    [refresh]
  );

  // The list, once per visit — and again whenever the socket comes back, since both the group membership and whatever
  // was pushed while it was away are lost with the old connection.
  useEffect(() => {
    if (!isAuthenticated) {
      setFriends([]);
      setIsLoading(false);
      return;
    }

    void refresh();
  }, [isAuthenticated, refresh, reconnectCount]);

  // The minute heartbeat, for as long as the page is open — and only while somebody is signed in. It covers what a
  // hint cannot: a push the server never sent, a socket that died quietly, a friend whose session ended without the
  // server noticing. The read on mount covers the rest (a refresh asks the server, and the server knows).
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isAuthenticated, refresh]);

  // The hint. It names one friend, so one row moves between the sections — no list read, and no chance of the sections
  // and the badge-style counts disagreeing.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const handlePresence = (...args: unknown[]) => {
      const payload = args[0] as { login?: string; online?: boolean } | undefined;
      if (typeof payload?.login !== 'string' || typeof payload.online !== 'boolean') {
        // A hint we cannot read is not a reason to guess: the list is re-read when the page is opened again.
        return;
      }

      const { login, online } = payload;
      setFriends(rows => {
        // A hint naming somebody who is not in this list — a player who is no longer a friend, or a stranger — changes
        // nothing here, so the rows keep their identity and the page does not re-render for it.
        if (!rows.some(row => row.login === login)) {
          return rows;
        }

        return rows.map(row => (row.login === login ? { ...row, online } : row));
      });
    };

    on(FRIEND_PRESENCE_CHANGED, handlePresence);

    return () => {
      off(FRIEND_PRESENCE_CHANGED, handlePresence);
    };
  }, [isAuthenticated, on, off, reconnectCount]);

  return { friends, isLoading, error, refresh, remove };
};
