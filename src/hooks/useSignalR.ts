import { useEffect, useState, useCallback } from 'react';
import { signalRService, type SignalRConnectionState } from '../services/signalr';

export const useSignalR = () => {
  // The connection's own state, kept live: a socket that drops and comes back must be visible here, because everything
  // the app addresses to a connection (a match group, this tab's pushes) is lost with the old one.
  const [connectionState, setConnectionState] = useState<SignalRConnectionState>('disconnected');
  // How many times the socket has come back after being away. Each one is a **new** connection, so a board that watches
  // this number knows it has to re-join its match and re-read what it missed (SignalR does not replay).
  const [reconnectCount, setReconnectCount] = useState(0);

  /**
   * The hook's own hold on the socket, made explicit: `connect()` takes it and `disconnect()` gives it back — the same
   * pair the effect below makes for the component's lifetime. They are returned because a **holder can outlive a
   * session**: `NotificationsProvider` is mounted above the routes and never unmounts when a player signs out, so
   * without this the socket stayed open after the sign-out and the server kept reporting that player online to everyone
   * else (`plans/PLAN-023-social-friends-list/plan.md` §11 — the bug a player found).
   */
  const connect = useCallback(async () => {
    try {
      await signalRService.connect();
      setConnectionState(signalRService.getState());
    } catch (error) {
      console.error('Failed to connect to SignalR:', error);
      setConnectionState('disconnected');
    }
  }, []);

  const disconnect = useCallback(async () => {
    await signalRService.disconnect();
  }, []);

  useEffect(() => {
    const unsubscribe = signalRService.onStateChange(state => {
      setConnectionState(state);
      if (state === 'reconnected') {
        setReconnectCount(count => count + 1);
      }
    });

    void connect();

    return () => {
      // The listener goes first: stopping the connection would otherwise report a disconnect to a component that is
      // already gone.
      unsubscribe();
      void disconnect();
    };
  }, [connect, disconnect]);
  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    signalRService.on(event, callback);
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    signalRService.off(event, callback);
  }, []);

  const joinMatch = useCallback(async (matchId: number) => {
    await signalRService.joinMatch(matchId);
  }, []);

  const leaveMatch = useCallback(async (matchId: number) => {
    await signalRService.leaveMatch(matchId);
  }, []);

  const playCard = useCallback(async (matchId: number, cardId: number, x: number, y: number) => {
    await signalRService.playCard(matchId, cardId, x, y);
  }, []);

  const requestLegalMoves = useCallback(async (matchId: number) => {
    await signalRService.requestLegalMoves(matchId);
  }, []);

  const requestMatchStatus = useCallback(async (matchId: number) => {
    await signalRService.requestMatchStatus(matchId);
  }, []);

  // Join this connection to the player's notifications group. The session hook re-subscribes on every connect and
  // reconnect, because the groups belong to the connection and a reconnected socket is a new one.
  const subscribeToNotifications = useCallback(async () => {
    await signalRService.subscribeToNotifications();
  }, []);

  return {
    isConnected: connectionState === 'connected' || connectionState === 'reconnected',
    connectionState,
    reconnectCount,
    connect,
    disconnect,
    on,
    off,
    joinMatch,
    leaveMatch,
    playCard,
    requestLegalMoves,
    requestMatchStatus,
    subscribeToNotifications,
  };
};
