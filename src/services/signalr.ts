import * as signalR from '@microsoft/signalr';
import { getAccessToken } from './auth';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  'https://actual-alexine-triple-triad-downgraded-870df4c3.koyeb.app';

/**
 * What the connection is doing, as far as the rest of the app is concerned. `reconnected` is the one that matters and
 * the one that is easy to miss: the socket is back, but it is a **new** connection — SignalR keeps this client's event
 * handlers across a reconnect, while the server's connection id (and with it every group that connection had joined)
 * does not follow it, and anything sent while it was away is never replayed. A board that only watches "connected or
 * not" therefore sits on a stale view while looking perfectly healthy.
 */
export type SignalRConnectionState = 'connected' | 'reconnecting' | 'reconnected' | 'disconnected';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private listeners = new Set<(state: SignalRConnectionState) => void>();

  /** Subscribe to the connection's own state. Returns the unsubscribe function. */
  onStateChange(listener: (state: SignalRConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Where the connection stands right now (a stopped or still-starting one reads as `disconnected`). */
  getState(): SignalRConnectionState {
    const state = this.connection?.state;
    if (state === signalR.HubConnectionState.Connected) {
      return 'connected';
    }
    if (state === signalR.HubConnectionState.Reconnecting) {
      return 'reconnecting';
    }
    return 'disconnected';
  }

  private notify(state: SignalRConnectionState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('SignalR state listener failed:', error);
      }
    });
  }

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/gamehub`, {
        withCredentials: false,
        accessTokenFactory: () => getAccessToken() ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // The three hooks a board needs to survive a blip. `onreconnected` is not "the same connection again": the server
    // has a new connection id, so the match group has to be joined again and the board re-read (nothing is replayed).
    this.connection.onreconnecting(error => {
      console.warn('⚠️ SignalR reconnecting:', error);
      this.notify('reconnecting');
    });
    this.connection.onreconnected(connectionId => {
      console.log('🔁 SignalR reconnected as connection', connectionId);
      this.notify('reconnected');
    });
    this.connection.onclose(error => {
      console.error('🔌 SignalR closed:', error);
      this.notify('disconnected');
    });

    try {
      await this.connection.start();
      console.log('✅ SignalR Connected');
      this.notify('connected');
    } catch (err) {
      console.error('❌ SignalR Connection Error:', err);
      this.notify('disconnected');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      console.log('🔌 SignalR Disconnected');
    }
  }

  // Join a match room
  async joinMatch(matchId: number): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.invoke('JoinMatch', matchId);
  }

  // Leave a match room
  async leaveMatch(matchId: number): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.invoke('LeaveMatch', matchId);
  }

  // Play a card (the hub validates the JWT passed as the 5th argument)
  async playCard(matchId: number, cardId: number, x: number, y: number): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.invoke('PlayCard', matchId, cardId, x, y, getAccessToken() ?? '');
  }

  // Ask what the caller may play this turn, and what each move would do. The answer arrives as a `LegalMoves` event
  // rather than as this call's result, so nothing here waits on it — the board keeps working while it is in flight.
  // The hub validates the JWT the same way PlayCard does, and answers the caller only: the list is built from the
  // player's own hand.
  async requestLegalMoves(matchId: number): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.invoke('RequestLegalMoves', matchId, getAccessToken() ?? '');
  }

  // Request match status
  async requestMatchStatus(matchId: number): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.invoke('RequestMatchStatus', matchId);
  }
  // Event listeners
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.connection) throw new Error('Not connected');
    this.connection.on(event, callback);
  }

  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (!this.connection) throw new Error('Not connected');
    if (callback) {
      this.connection.off(event, callback);
    } else {
      this.connection.off(event);
    }
  }

  getConnectionState(): signalR.HubConnectionState | null {
    return this.connection?.state || null;
  }
}

export const signalRService = new SignalRService();
