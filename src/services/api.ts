const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://following-patricia-triple-triad-2a9e3baa.koyeb.app';

// API Card type (from backend)
export interface Card {
  id: number;
  name: string;
  image: string;
  topValue: number;
  rightValue: number;
  bottomValue: number;
  leftValue: number;
  element?: string;
  level?: number;
}

// Local Card type (for frontend rendering with blue/red images)
export interface LocalCard {
  id: number;
  name: string;
  blueImagePath: string;
  redImagePath: string;
}

export interface Match {
  id: number;
  player1Id: string;
  player2Id: string | null;
  currentPlayerTurn: string;
  status: string;
  player1Score: number;
  player2Score: number;
  winnerId: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface CardPlacement {
  id: number;
  cardId: number;
  playerId: string;
  owner: string;
  x: number;
  y: number;
  card: Card;
}

export interface PlayCardRequest {
  playerId: string;
  cardId: number;
  x: number;
  y: number;
}

export interface CreateMatchResponse {
  match: Match;
  playerHand: Card[];
}

export interface JoinMatchResponse {
  match: Match;
  playerHand: Card[];
}

export interface GetMatchResponse {
  match: Match;
  placements: CardPlacement[];
}

export interface PlayCardResponse {
  success: boolean;
  capturedCards: Array<{ id: number; x: number; y: number }>;
  player1Score: number;
  player2Score: number;
  currentPlayer: string;
  isGameComplete: boolean;
  winnerId: string | null;
}

class ApiService {
  // Get all cards
  async getAllCards(): Promise<Card[]> {
    const response = await fetch(`${API_BASE_URL}/api/game/cards`);
    if (!response.ok) throw new Error('Failed to fetch cards');
    return response.json();
  }

  // Create a new match (Quick Match) - username IS the playerId
  async createMatch(username: string, opponentId?: string): Promise<CreateMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: username,
        opponentId: opponentId || null, // null for PvP waiting, "AI" for AI match
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create match');
    }
    return response.json();
  }

  // Get waiting matches (for matchmaking)
  async getWaitingMatches(): Promise<{ id: number; player1Id: string; createdAt: string }[]> {
    const response = await fetch(`${API_BASE_URL}/api/game/matches/waiting`);
    if (!response.ok) throw new Error('Failed to fetch waiting matches');
    return response.json();
  }

  // Join an existing match - username IS the playerId
  async joinMatch(matchId: number, username: string): Promise<JoinMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: username }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join match');
    }
    return response.json();
  } // Get match details
  async getMatch(matchId: number): Promise<GetMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}`);
    if (!response.ok) throw new Error('Failed to fetch match');
    const data = await response.json();

    console.log('📥 Raw API response (before normalization):', data);

    // Normalize the casing of the owner field (backend returns "Owner", we need "owner")
    if (data.placements) {
      data.placements = data.placements.map((p: CardPlacement & { Owner?: string }) => ({
        ...p,
        owner: p.owner || p.Owner, // Handle both casings
      }));
      console.log('📥 After normalization, placements:', data.placements);
    }

    return data;
  }

  // Get player's hand - username IS the playerId
  async getPlayerHand(matchId: number, username: string): Promise<Card[]> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/hand/${username}`);
    if (!response.ok) throw new Error('Failed to fetch hand');
    return response.json();
  }
  // Play a card (REST API - fallback if SignalR fails)
  async playCard(matchId: number, request: PlayCardRequest): Promise<PlayCardResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to play card');
    }
    return response.json();
  }
}

export const apiService = new ApiService();
