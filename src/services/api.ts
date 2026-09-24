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
// SAME WALL / PLUS WALL make the board's outer wall count as an A (10) card for SAME / PLUS respectively.
export type MatchRule = 'Same' | 'Plus' | 'SameWall' | 'PlusWall';

// Rules the UI enables by default when it creates a match (Quick Match).
// 👉 To revert to basic-rules-only matches, set this to [] — nothing else needs to change.
export const DEFAULT_MATCH_RULES: MatchRule[] = ['Same', 'Plus'];

// What the Lobby's "Match with Rules" option enables: every rule the backend implements. Kept as data so the
// option's caption is rendered from it and a new rule needs no UI change (see plans/bare-modal-and-match-choice-plan.md).
// `DEFAULT_MATCH_RULES` above is the legacy implicit default — Quick Match now asks instead of assuming it.
export const ALL_MATCH_RULES: MatchRule[] = ['Same', 'Plus', 'SameWall', 'PlusWall'];

// How many cards a hand holds — mirrors GameLogicService.HandSize on the server, which is what validates a
// client-picked hand, so the picker offers Continue at exactly this many cards.
export const HAND_SIZE = 5;

// The login the server seats as the second player when the opponent is the CPU: the sentinel the game tables hold,
// and an identity rather than a name. The label a player reads (the board's "CPU") is presentation on top of it.
export const CPU_OPPONENT_ID = 'AI';

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
  // True once both players have their five cards filed — what the SelectHand step waits on.
  handsReady?: boolean;
  // True when a match deadline has passed; the server settles it on its next sweep.
  timedOut?: boolean;
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
  // How many distinct cards the player owns and how many unopened packs they hold — the two counts the
  // PlayerStats pills show. Optional because a profile cached in localStorage before these fields existed
  // is still valid; the UI falls back to 0.
  cardsOwned?: number;
  packsOwned?: number;
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

// ---------------------------------------------------------------------------
// Card shop
// ---------------------------------------------------------------------------

// One row of the pack's odds table: the level, its draw weight (600 - 20x) and that weight as a percentage.
export interface PackLevelOdds {
  level: number;
  weight: number;
  chancePercent: number;
}

// The pack on offer, served by the backend so the page cannot drift from the server (price 1500, 5 cards).
export interface PackOffer {
  price: number;
  cardCount: number;
  // How many of this pack the player already holds unopened (the shop shows it after a purchase).
  packsOwned: number;
  levelOdds: PackLevelOdds[];
}

// A card the pack handed out, with what it did to the collection.
export interface PackCard extends Card {
  // How many copies the player holds after this pack (a card drawn twice reads 1 then 2).
  quantityOwned: number;
  // True when the player owned no copy of the card before this pack.
  isNew: boolean;
}

// Buying hands out a pack, not cards: the coins are charged and the pack goes to the inventory.
export interface PackPurchaseResponse {
  success: boolean;
  price: number;
  coinsAfter: number;
  packsOwned: number;
}

// Opening consumes one pack and returns the five cards it held — they are already filed in the collection by
// the time this arrives, so the reveal is presentation only.
export interface PackOpenResponse {
  success: boolean;
  packCode: string;
  packsOwned: number;
  cards: PackCard[];
}

// One stack of unopened packs (api/shop/packs).
export interface PackStack {
  code: string;
  name: string;
  cardCount: number;
  quantity: number;
}

// One entry of the player's collection (api/player/cards).
export interface OwnedCard {
  card: Card;
  quantity: number;
  firstAcquiredAt: string;
  lastAcquiredAt: string;
}

// One level of a player's collection: how many distinct cards they hold there and how many the catalogue has.
export interface OwnedCardLevel {
  level: number;
  ownedCount: number;
  totalCount: number;
}

// The collection at a glance — the page header totals plus the levels that have a card in them (this is what
// fills the level picker, so the page never has to load the whole collection).
export interface CollectionSummary {
  distinctCards: number;
  copiesOwned: number;
  levels: OwnedCardLevel[];
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
  async createMatch(
    opponentId?: string,
    rules: MatchRule[] = [],
    options: { cardIds?: number[]; pickHandLater?: boolean } = {}
  ): Promise<CreateMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        opponentId: opponentId || null, // null for PvP waiting, "AI" for AI match
        rules,
        cardIds: options.cardIds,
        pickHandLater: options.pickHandLater,
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

  // Join an existing match - identity comes from the JWT. `pickHandLater` is the SelectHand flow: joining seats the
  // second player and files no hand, so both of them can pick at the same time and send their five through
  // `setMatchHand`. A `cardIds` list files the hand right here instead (an older client), and neither draws a random
  // hand on the server.
  async joinMatch(
    matchId: number,
    options: { cardIds?: number[]; pickHandLater?: boolean } = {}
  ): Promise<JoinMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/join`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        cardIds: options.cardIds,
        pickHandLater: options.pickHandLater,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Failed to join match');
    }
    return response.json();
  }

  // Quick Match: ask to be put into a game. The server looks for an opponent already waiting under exactly these
  // rules and seats us in their match, or starts one for us to be found in — one call, because the decision has to be
  // the server's. A client that reads the waiting list and then writes separately lets two players searching at the
  // same instant both conclude that nobody is waiting and start a match each, leaving them waiting for each other.
  //
  // The answer is the same shape as create/join: `status` is `waiting` when we are the one who will be found, `active`
  // when we were seated in somebody's waiting match and the picker can open straight away.
  async quickMatch(rules: MatchRule[]): Promise<JoinMatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/quick`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rules }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Failed to start the match');
    }
    return response.json();
  }

  // File the five cards a player picked once the match had both players. Both sides of a Quick Match call this, and
  // it is what makes the match ready: the server replaces the caller's unused rows, so a retry can never double the
  // hand.
  async setMatchHand(matchId: number, cardIds: number[]): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/hand`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cardIds }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Failed to file your hand');
    }
  }

  // Give up on a waiting match nobody has joined yet (the Lobby Cancel button).
  async cancelMatch(matchId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/game/match/${matchId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Failed to cancel the search');
    }
  }

  // Get match details
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

  // Start a password recovery. The backend answers identically whether or not the address has an account (that is the
  // point — the endpoint must not become a way to discover who has one), so a resolved promise means "asked", not
  // "sent": the player is told to check their inbox either way.
  async forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/player/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      throw new Error('Could not request a reset code. Please try again.');
    }
  }

  // Finish a recovery with the code from the email and the password to set. Failures here ARE specific ("that code is
  // not valid"), deliberately: the code is the proof of ownership, so telling the holder it is wrong leaks nothing —
  // and a player who mistyped needs to be told.
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/player/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Could not reset the password. Please try again.');
    }
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

  // Card shop: what a pack costs, how many cards it holds and the odds of each level.
  async getPackOffer(): Promise<PackOffer> {
    const response = await fetch(`${API_BASE_URL}/api/shop/pack`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to load the card shop');
    }
    return response.json();
  }

  // Buy a pack. The backend charges the coins and adds a pack to the inventory — no cards are drawn here; they
  // arrive when the pack is opened. A 400 means the player cannot afford it (nothing is written in that case).
  async buyPack(): Promise<PackPurchaseResponse> {
    const response = await fetch(`${API_BASE_URL}/api/shop/pack/purchase`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Failed to buy a pack');
    }
    return response.json();
  }

  // Open one of the packs the player holds. The backend consumes the pack, draws the cards, files them in the
  // collection and returns them — the flip animation in the UI only replays cards the player already owns. A 400
  // (no packs left) writes nothing.
  async openPack(packCode?: string): Promise<PackOpenResponse> {
    const response = await fetch(`${API_BASE_URL}/api/shop/pack/open`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ packCode: packCode ?? null }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'Failed to open the pack');
    }
    return response.json();
  }

  // The packs the player still holds, one entry per stack — what the My Packs page lists.
  async getPackInventory(): Promise<PackStack[]> {
    const response = await fetch(`${API_BASE_URL}/api/shop/packs`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to load your packs');
    }
    return response.json();
  }

  // The signed-in player's collection, optionally narrowed to a single card level — the My Cards page loads
  // one level at a time, on demand.
  async getMyCards(level?: number): Promise<OwnedCard[]> {
    const query = level === undefined ? '' : `?level=${level}`;
    const response = await fetch(`${API_BASE_URL}/api/player/cards${query}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to load your cards');
    }
    return response.json();
  }

  // The collection at a glance: header totals plus one row per level the player owns cards in. Drives the
  // level picker without loading a single card.
  async getCollectionSummary(): Promise<CollectionSummary> {
    const response = await fetch(`${API_BASE_URL}/api/player/cards/summary`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to load your collection');
    }
    return response.json();
  }
}

export const apiService = new ApiService();
