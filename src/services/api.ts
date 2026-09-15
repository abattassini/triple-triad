import { getAccessToken } from './auth';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  'https://actual-alexine-triple-triad-downgraded-870df4c3.koyeb.app';

// Attaches the stored JWT (when present) to API requests.
const getAuthHeaders = (): HeadersInit => {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// API Card type (from backend)
export interface Card {
  id: number;
  name: string;
  image: string;
  topValue: number;
  rightValue: number;
  bottomValue: number;
  leftValue: number;
  element?: string[];
  level?: number;
}

// Local Card type (for frontend rendering with blue/red images)
export interface LocalCard {
  id: number;
  name: string;
  blueImagePath: string;
  redImagePath: string;
}

// Special rules that can be enabled on a match (mirrors the backend MatchRule enum).
export type MatchRule = 'Same' | 'Plus';

// Rules the UI enables by default when it creates a match (Quick Match).
// 👉 To revert to basic-rules-only matches, set this to [] — nothing else needs to change.
export const DEFAULT_MATCH_RULES: MatchRule[] = ['Same', 'Plus'];

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
  // Rules enabled when the match was created (empty array = no special rules).
  rules: MatchRule[];
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

export interface RegisterAccountRequest {
  login: string;
  email: string;
  password: string;
}

export interface Player {
  id: number;
  login: string;
  email: string;
  createdAt: string;
  coins: number;
  experience: number;
  wins: number;
  losses: number;
  ties: number;
  avatarUrl: string | null;
}

export interface SignInRequest {
  identifier: string;
  password: string;
}

export interface SignInResponse {
  token: string;
  player: Player;
}

export interface GetMatchResponse {
  match: Match;
  placements: CardPlacement[];
}

export interface MatchRewards {
  player1Coins: number;
  player1Experience: number;
  player2Coins: number;
  player2Experience: number;
}

export interface PlayCardResponse {
  success: boolean;
  capturedCards: Array<{ id: number; x: number; y: number }>;
  // Rules that fired on this move (e.g. ["Same"]); empty when none did.
  triggeredRules: MatchRule[];
  player1Score: number;
  player2Score: number;
  currentPlayer: string;
  isGameComplete: boolean;
  winnerId: string | null;
  // Present only on the move that completes the match.
  rewards?: MatchRewards | null;
}

class ApiService {
  // Get all cards
  async getAllCards(): Promise<Card[]> {
    const response = await fetch(`${API_BASE_URL}/api/game/cards`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch cards');
    return response.json();
  }

  // Create a new match (Quick Match) - identity comes from the JWT
  // `rules` are the special rules to enable for the match (e.g. ['Same']).
  async createMatch(opponentId?: string, rules: MatchRule[] = []): Promise<CreateMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        opponentId: opponentId || null, // null for PvP waiting, "AI" for AI match
        rules,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create match');
    }
    return response.json();
  }

  // Get waiting matches (for matchmaking)
  async getWaitingMatches(): Promise<
    { id: number; player1Id: string; createdAt: string; rules: MatchRule[] }[]
  > {
    const response = await fetch(`${API_BASE_URL}/api/game/matches/waiting`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch waiting matches');
    return response.json();
  }

  // Join an existing match - identity comes from the JWT
  async joinMatch(matchId: number): Promise<JoinMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/join`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join match');
    }
    return response.json();
  } // Get match details
  async getMatch(matchId: number): Promise<GetMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}`, {
      headers: getAuthHeaders(),
    });
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

  // Get the authenticated player's hand
  async getPlayerHand(matchId: number): Promise<Card[]> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/hand`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch hand');
    return response.json();
  }
  // Play a card (REST API - fallback if SignalR fails)
  async playCard(matchId: number, request: PlayCardRequest): Promise<PlayCardResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/play`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to play card');
    }
    return response.json();
  }

  // Register a new account
  async registerAccount(request: RegisterAccountRequest): Promise<Player> {
    const response = await fetch(`${API_BASE_URL}/api/player/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Failed to create account');
    }
    return response.json();
  }

  // Sign in and receive a JWT + player profile
  async signIn(identifier: string, password: string): Promise<SignInResponse> {
    const response = await fetch(`${API_BASE_URL}/api/player/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Invalid login or password.');
    }
    return response.json();
  }

  // Get the authenticated player's profile
  async getMe(): Promise<Player> {
    const response = await fetch(`${API_BASE_URL}/api/player/me`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch current player');
    }
    return response.json();
  }
}

export const apiService = new ApiService();
