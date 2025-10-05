import { useEffect, useState, useCallback } from 'react';
import { signalRService } from '../services/signalr';
import { HubConnectionState } from '@microsoft/signalr';

export const useSignalR = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connect = async () => {
      try {
        await signalRService.connect();
        setIsConnected(signalRService.getConnectionState() === HubConnectionState.Connected);
      } catch (error) {
        console.error('Failed to connect to SignalR:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      signalRService.disconnect();
    };
  }, []);
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

  const playCard = useCallback(
    async (matchId: number, cardId: number, x: number, y: number, playerId: string) => {
      await signalRService.playCard(matchId, cardId, x, y, playerId);
    },
    []
  );

  const requestMatchStatus = useCallback(async (matchId: number) => {
    await signalRService.requestMatchStatus(matchId);
  }, []);

  return {
    isConnected,
    on,
    off,
    joinMatch,
    leaveMatch,
    playCard,
    requestMatchStatus,
  };
};
