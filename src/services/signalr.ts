import * as signalR from '@microsoft/signalr';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://following-patricia-triple-triad-2a9e3baa.koyeb.app';

class SignalRService {
  private connection: signalR.HubConnection | null = null;

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/gamehub`, {
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    try {
      await this.connection.start();
      console.log('✅ SignalR Connected');
    } catch (err) {
      console.error('❌ SignalR Connection Error:', err);
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

  // Play a card
  async playCard(
    matchId: number,
    cardId: number,
    x: number,
    y: number,
    playerId: string
  ): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.invoke('PlayCard', matchId, cardId, x, y, playerId);
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
