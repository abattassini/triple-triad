import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  TouchSensor,
  MouseSensor,
  KeyboardSensor,
  PointerSensor,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  Box,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { Hand } from './Hand';
import { PlayerProfileModal } from './PlayerProfileModal';
import { Board } from './Board';
import {
  apiService,
  CPU_OPPONENT_ID,
  HAND_SIZE,
  type Card as ApiCard,
  type CardPlacement,
  type Match as MatchData,
  type LegalMovesResponse,
  type LocalCard,
  type MatchRewards,
  type MatchRule,
} from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { useAuth } from '../contexts/AuthContext';
import './Match.scss';

// Helper function to convert API card to local card format
const convertApiCardToLocalCard = (
  apiCard: ApiCard,
  owner?: string
): LocalCard & { owner?: string } => {
  const result = {
    id: apiCard.id,
    name: apiCard.name,
    blueImagePath: apiCard.image,
    // Red variant lives next to the blue one, so only the file name gets the
    // 'r' prefix (image may include a deck folder, e.g. "ff8-deck/squall.jpg").
    redImagePath: apiCard.image.replace(/([^/]+)$/, 'r$1'),
    owner, // Track who owns this card
  };

  console.log(`🔄 Converting API card:`, {
    name: apiCard.name,
    apiImage: apiCard.image,
    blueImagePath: result.blueImagePath,
    redImagePath: result.redImagePath,
    owner,
  });

  return result;
};

// Read-only labels for the special rules a match can enable (backend MatchRule names).
const RULE_LABELS: Partial<Record<MatchRule, string>> = {
  Same: 'SAME',
  Plus: 'PLUS',
  SameWall: 'SAME WALL',
  PlusWall: 'PLUS WALL',
};

// Unknown rule names fall back to their upper-cased name so new backend rules still show up.
const ruleLabel = (rule: string): string => RULE_LABELS[rule as MatchRule] ?? rule.toUpperCase();

/**
 * How often the board reads the match while the **opponent** is on turn, when no push has arrived (see
 * `lookForTheirMove`). Delivery is not guaranteed to the tab that needs it, so the board does not wait on it forever:
 * a few seconds is well under a player's patience and costs one small read per tick.
 */
const OPPONENT_WATCH_MS = 4000;

/**
 * The board the server's placements describe. The one mapping from placements to the 3×3 grid, because three places
 * need exactly the same board: the initial load, the refetch a `CardPlayed` push triggers, and the catch-up after a
 * reconnect.
 */
const buildBoard = (placements: CardPlacement[]): ((LocalCard & { owner?: string }) | null)[] => {
  const board: ((LocalCard & { owner?: string }) | null)[] = Array(9).fill(null);

  placements.forEach(placement => {
    const boardIndex = placement.y * 3 + placement.x;
    board[boardIndex] = convertApiCardToLocalCard(placement.card, placement.owner);
  });

  return board;
};

/**
 * The opponent's hand as card backs: they were dealt five, and every placement of theirs is one of them spent. Derived
 * from the placements rather than tracked, so a board that had to re-read the match (a reconnect, say) still counts
 * them right.
 */
const buildOpponentHand = (placements: CardPlacement[], playerId: string): LocalCard[] => {
  const played = placements.filter(placement => placement.playerId !== playerId).length;

  return Array(Math.max(0, HAND_SIZE - played))
    .fill(null)
    .map((_, index) => ({
      id: -1 - index, // Negative IDs for card backs
      name: 'Card back',
      blueImagePath: 'ff8-deck/back.png',
      redImagePath: 'ff8-deck/back.png',
    }));
};

/**
 * Who won, seen from this player's side. `WinnerId` decides it, and it is the *only* thing that can: a match settled
 * by a timeout (a forfeit) is completed with the scores still at their opening 5-5 — nobody played a card — so
 * comparing the score line there would call a decided match a draw. The scores are only the fallback for a row with
 * no winner recorded at all.
 */
const resolveResult = (match: MatchData, userId: string): 'won' | 'lost' | 'draw' => {
  if (match.winnerId) {
    return match.winnerId === userId ? 'won' : 'lost';
  }

  const playerScore = match.player1Id === userId ? match.player1Score : match.player2Score;
  const opponentScore = match.player1Id === userId ? match.player2Score : match.player1Score;

  if (playerScore > opponentScore) {
    return 'won';
  }
  if (playerScore < opponentScore) {
    return 'lost';
  }
  return 'draw';
};

export const Match: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.login;
  const {
    isConnected,
    connectionState,
    reconnectCount,
    on,
    off,
    joinMatch: joinSignalRMatch,
    playCard: playCardSignalR,
    requestLegalMoves: requestLegalMovesSignalR,
  } = useSignalR();

  // Game state from backend
  const [match, setMatch] = useState<MatchData | null>(null);
  const [playerHand, setPlayerHand] = useState<LocalCard[]>([]);
  const [opponentHand, setOpponentHand] = useState<LocalCard[]>([]);
  const [board, setBoard] = useState<((LocalCard & { owner?: string }) | null)[]>(
    Array(9).fill(null)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<LocalCard | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);

  // Game completion dialog state
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<'won' | 'lost' | 'draw' | null>(null);
  // Rewards granted when the match completed (coins/XP for both sides).
  const [lastRewards, setLastRewards] = useState<MatchRewards | null>(null);
  // Why the match ended early (`timeout` for a forfeit), or null when it was played out.
  const [completionReason, setCompletionReason] = useState<string | null>(null);
  // Set when the server gives up on the match (a timeout) — there is nothing left to play.
  const [abandonedReason, setAbandonedReason] = useState<string | null>(null);
  // Rule that fired on the most recent move (e.g. SAME), flashed briefly as feedback.
  const [lastTriggeredRule, setLastTriggeredRule] = useState<string | null>(null);
  // Whose profile the opponent panel is showing, or null while it is closed (PLAN-020). Only ever a human opponent's
  // login — the CPU is a sentinel, not somebody to look up.
  const [profileLogin, setProfileLogin] = useState<string | null>(null);

  // The moves the server says this player may make this turn, and what each would do (see `requestPreview`). A ref, not
  // state: the drop reads it while dragging and it may never trigger a render of its own — the board is the only thing
  // on screen that changes.
  const previewRef = useRef<LegalMovesResponse | null>(null);
  // The turn a request is already out for, so a render cannot ask twice. Cleared when the answer arrives, which is what
  // lets the next turn ask again.
  const previewRequestRef = useRef<number | null>(null);
  // The move this device rendered the moment it was dropped (`cardId:x:y`). Its own `CardPlayed` push arrives a round
  // trip later and must only confirm it — no second flash, nothing to re-read.
  const appliedMoveRef = useRef<string | null>(null);
  // How to put the board back if the server refuses a move that was already rendered on sight (see `handleDragEnd`).
  const undoRef = useRef<(() => void) | null>(null);

  /**
   * Render a move the server has resolved. Used by **both** the preview (this player's own drop, in the same frame)
   * and the `CardPlayed` push (everything else), because the two carry the same data — see `LegalMove` and
   * `MatchPushes.CardPlayed` — so a card can never land two different ways depending on which one arrived first.
   *
   * The rule flash is set in this same call as the board, which is the point: the ⚡ effect and the cards it is about
   * are committed in one render, instead of the flash announcing a capture the player cannot see yet.
   */
  const applyMoveRender = useCallback(
    (
      move: {
        cardId: number;
        x: number;
        y: number;
        capturedCards: Array<{ x: number; y: number }>;
        triggeredRules: MatchRule[];
        player1Score: number;
        player2Score: number;
        isGameComplete: boolean;
        winnerId: string | null;
      },
      options: { actor: string; card: LocalCard; nextPlayer: string; flash: boolean }
    ) => {
      const { actor, card, nextPlayer, flash } = options;

      setBoard(prev => {
        const next = [...prev];
        next[move.y * 3 + move.x] = { ...card, owner: actor };
        move.capturedCards.forEach(cell => {
          const index = cell.y * 3 + cell.x;
          const captured = next[index];
          if (captured) {
            next[index] = { ...captured, owner: actor };
          }
        });
        return next;
      });

      setMatch(prev =>
        prev
          ? {
              ...prev,
              player1Score: move.player1Score,
              player2Score: move.player2Score,
              currentPlayerTurn: nextPlayer,
              winnerId: move.winnerId,
              status: move.isGameComplete ? 'completed' : prev.status,
            }
          : null
      );

      setIsMyTurn(nextPlayer === userId);

      if (flash && move.triggeredRules && move.triggeredRules.length > 0) {
        setLastTriggeredRule(ruleLabel(move.triggeredRules[0]));
        setTimeout(() => setLastTriggeredRule(null), 2500);
      }
    },
    [userId]
  );

  /**
   * Ask what this player may play this turn. Called when the turn becomes theirs — opening the board that is already
   * their turn, and every push that flips the turn back to them — so the round trip is spent while they are looking at
   * the board instead of after they drop a card. Fire and forget: a board with no list plays exactly as it always did,
   * and the server answers only the player whose turn it really is.
   */
  const requestPreview = useCallback(() => {
    if (!matchId || !isConnected || previewRequestRef.current === parseInt(matchId)) return;

    previewRequestRef.current = parseInt(matchId);

    requestLegalMovesSignalR(parseInt(matchId)).catch(error => {
      console.warn(
        'Turn preview unavailable — the board will wait for the server as before:',
        error
      );
    });
  }, [matchId, isConnected, requestLegalMovesSignalR]);

  // Configure sensors for better DevTools and mobile support
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 3 },
  });
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 2 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 50, tolerance: 15 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, mouseSensor, touchSensor, keyboardSensor);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = playerHand.find(c => c.id === active.id);
    setActiveCard(card || null);
    console.log('🚀 Drag started:', card?.name, 'Event:', event); // Enhanced debug log
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    console.log('✅ Drag ended:', { active: active?.id, over: over?.id, event });

    if (over && over.id !== undefined && matchId && userId) {
      const boardIndex = Number(over.id);
      const cardId = Number(active.id);

      // Check if the board position is empty and it's the player's turn
      if (board[boardIndex] === null && isMyTurn) {
        const card = playerHand.find(c => c.id === cardId);
        if (card) {
          // Convert board index to x, y coordinates
          const x = boardIndex % 3;
          const y = Math.floor(boardIndex / 3);

          // The server's own answer to this drop, when it has already arrived: the card, the flips it causes and the
          // scores it leaves land in this same frame, and the invoke below is still what writes the move — the preview
          // only skips the wait. A list built from a different board than the one on screen (or none at all) is not
          // used: the move then takes the ordinary path and the board follows the push.
          const preview = previewRef.current;
          const offered =
            preview && preview.placements === board.filter(cell => cell !== null).length
              ? preview.moves.find(move => move.cardId === cardId && move.x === x && move.y === y)
              : undefined;

          previewRef.current = null;

          try {
            // Immediately remove card from hand to prevent snap-back animation
            setPlayerHand(prev => prev.filter(c => c.id !== cardId));

            // Clear active card
            setActiveCard(null);

            if (offered && preview) {
              // Everything rendered here is what the server already resolved for this turn, so it can also be taken
              // back whole if the move is refused (see the catch below).
              const previousBoard = board;
              const previousMatch = match;
              const previousHand = playerHand;
              const previousOpponentHand = opponentHand;
              const previousTurn = isMyTurn;

              undoRef.current = () => {
                setBoard(previousBoard);
                setMatch(previousMatch);
                setPlayerHand(previousHand);
                setOpponentHand(previousOpponentHand);
                setIsMyTurn(previousTurn);
              };
              appliedMoveRef.current = `${cardId}:${x}:${y}`;

              applyMoveRender(offered, {
                actor: userId,
                card,
                nextPlayer: preview.nextPlayer,
                flash: true,
              });
            }

            // Send move to backend via SignalR
            console.log('🎮 Playing card via SignalR:', { matchId, cardId, x, y, userId });
            await playCardSignalR(parseInt(matchId), cardId, x, y);

            // Don't update local state further - wait for CardPlayed event from SignalR. A move rendered from the
            // preview has already landed on screen; that push only confirms it.
          } catch (error) {
            console.error('Failed to play card:', error);
            alert('Failed to play card: ' + (error as Error).message);

            if (undoRef.current) {
              // The server refused a move that was already on screen: undo the whole render (board, flips, scores and
              // turn) instead of only returning the card — the hand is part of that snapshot.
              undoRef.current();
              undoRef.current = null;
              appliedMoveRef.current = null;
              previewRef.current = preview;
            } else if (card) {
              // On error, restore the card to the hand
              setPlayerHand(prev => [...prev, card]);
            }
            setActiveCard(null);
          }
          return; // Exit early to skip the normal clear at the end
        }
      } else if (!isMyTurn) {
        console.log('❌ Not your turn!');
        alert("It's not your turn!");
      }
    }

    // Clear the active card state (for unsuccessful drops or cancelled drags)
    setActiveCard(null);
  };

  // Add a drag cancel handler for better cleanup
  const handleDragCancel = () => {
    console.log('❌ Drag cancelled'); // Enhanced debug log
    setActiveCard(null);
  };

  // Load match data on component mount
  useEffect(() => {
    const loadMatchData = async () => {
      if (!matchId || !userId) {
        setError('Missing match ID or user');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get match details and board state
        const matchResponse = await apiService.getMatch(parseInt(matchId));
        setMatch(matchResponse.match); // Load board state from placements
        setBoard(buildBoard(matchResponse.placements));

        // Get player's hand
        const hand = await apiService.getPlayerHand(parseInt(matchId));
        setPlayerHand(hand.map(card => convertApiCardToLocalCard(card)));

        // Create opponent hand (card backs)
        setOpponentHand(buildOpponentHand(matchResponse.placements, userId));

        // Check if it's player's turn
        setIsMyTurn(matchResponse.match.currentPlayerTurn === userId);

        setLoading(false);
      } catch (err) {
        console.error('Failed to load match:', err);
        setError('Failed to load match data');
        setLoading(false);
      }
    };
    loadMatchData();
  }, [matchId, userId]);

  // Check for game completion (all 9 board positions occupied)
  useEffect(() => {
    if (!match || !userId) return;

    // Count filled positions
    const filledPositions = board.filter(cell => cell !== null).length;

    // If all 9 positions are filled and game isn't already marked complete
    if (filledPositions === 9 && match.status !== 'completed') {
      console.log('🏁 All 9 positions filled! Game complete.');

      // Wait 3 seconds before showing the dialog
      const timer = setTimeout(() => {
        setGameResult(resolveResult(match, userId));
        setShowGameOver(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [board, match, userId]);

  // SignalR event handlers
  useEffect(() => {
    if (!isConnected || !matchId) return;
    const handleCardPlayed = async (...args: unknown[]) => {
      const data = args[0] as {
        playerId: string;
        cardId: number;
        x: number;
        y: number;
        capturedCards: Array<{ id: number; x: number; y: number; newOwner: string }>;
        triggeredRules: MatchRule[];
        player1Score: number;
        player2Score: number;
        currentPlayer: string;
        isGameComplete: boolean;
        winnerId: string | null;
      };
      console.log('🎴 Card played event received:', data);

      // A move this device rendered the moment it was dropped (see `handleDragEnd`): the push is the server agreeing
      // with it, so it only confirms — no second rule flash, and no re-reading a board that is already on screen.
      const renderedLocally = appliedMoveRef.current === `${data.cardId}:${data.x}:${data.y}`;
      appliedMoveRef.current = null;
      undoRef.current = null;

      // The list described the turn this move just ended, whoever played it.
      previewRef.current = null;

      try {
        if (!renderedLocally) {
          // Fetch the updated match state to get the actual card and board. The push names the played card's id but
          // not its art, and the opponent's hand is not ours to guess.
          const matchResponse = await apiService.getMatch(parseInt(matchId));
          setBoard(buildBoard(matchResponse.placements));
        }

        // Update player's hand
        if (data.playerId === userId) {
          // A move rendered on sight already took the card out of the hand it came from.
          if (!renderedLocally) {
            const hand = await apiService.getPlayerHand(parseInt(matchId));
            setPlayerHand(hand.map(card => convertApiCardToLocalCard(card)));
          }
        } else {
          // Update opponent hand (remove one card back)
          setOpponentHand(prev => prev.slice(0, -1));
        }

        // Update match state with scores
        setMatch(prev =>
          prev
            ? {
                ...prev,
                player1Score: data.player1Score,
                player2Score: data.player2Score,
                currentPlayerTurn: data.currentPlayer,
                winnerId: data.winnerId,
                status: data.isGameComplete ? 'completed' : prev.status,
              }
            : null
        );

        // Update turn state
        setIsMyTurn(data.currentPlayer === userId);

        // Flash the rule that fired (e.g. SAME) so both players notice the extra captures. It is set **after** the
        // board above, in the same handler, so the two are committed in one render: the ⚡ is about cards the player
        // can see, never a capture that has not landed yet.
        if (!renderedLocally && data.triggeredRules && data.triggeredRules.length > 0) {
          setLastTriggeredRule(ruleLabel(data.triggeredRules[0]));
          setTimeout(() => setLastTriggeredRule(null), 2500);
        }

        console.log('✅ Board and state updated successfully');
      } catch (error) {
        console.error('Failed to update board after card played:', error);
      }
    };
    const handleGameCompleted = (...args: unknown[]) => {
      const data = args[0] as {
        winnerId: string | null;
        player1Score: number;
        player2Score: number;
        completedAt: string;
        // Absent on a match that was played out; `timeout` when the server settled a match a player walked away
        // from (the forfeit below is the only place that sends it).
        reason?: string;
        rewards?: MatchRewards | null;
      };
      console.log('Game completed:', data);
      setLastRewards(data.rewards ?? null);
      setCompletionReason(data.reason ?? null);
      // Nothing left to play, so nothing left to preview.
      previewRef.current = null;
      setMatch(prev =>
        prev
          ? {
              ...prev,
              ...data,
              status: 'completed',
            }
          : null
      );
    };
    const handleMatchAbandoned = (...args: unknown[]) => {
      const data = args[0] as { matchId: number; reason?: string };
      console.log('Match abandoned:', data);
      previewRef.current = null;

      if (data.matchId === parseInt(matchId)) {
        setAbandonedReason(data.reason ?? 'nobody picked their cards in time');
      }
    };

    // The server's answer to `RequestLegalMoves`: what this player may play this turn, and what each move would do.
    // Kept in a ref rather than state — the drop reads it, and it changes nothing on screen by itself. A list for a
    // different match, or for the other player, is not ours: only a request this client made can be answered with it.
    const handleLegalMoves = (...args: unknown[]) => {
      const data = args[0] as LegalMovesResponse;
      console.log('🧭 Legal moves received:', data);

      // The turn is answered: the next turn may ask again.
      previewRequestRef.current = null;

      if (data.matchId !== parseInt(matchId) || data.playerId !== userId) {
        return;
      }

      // Staleness is judged at the drop, against the board on screen then (see `handleDragEnd`) — that is the only
      // moment the board is guaranteed to be current, and the only moment the list is used.
      previewRef.current = data;
    };
    const handleError = (...args: unknown[]) => {
      const errorMessage = args[0] as string;
      console.error('❌ SignalR Error:', errorMessage);
      alert(`Error: ${errorMessage}`);
    };

    // Join SignalR match room
    joinSignalRMatch(parseInt(matchId));

    // Subscribe to events
    on('CardPlayed', handleCardPlayed);
    on('GameCompleted', handleGameCompleted);
    on('MatchAbandoned', handleMatchAbandoned);
    on('LegalMoves', handleLegalMoves);
    on('Error', handleError);
    return () => {
      off('CardPlayed', handleCardPlayed);
      off('GameCompleted', handleGameCompleted);
      off('MatchAbandoned', handleMatchAbandoned);
      off('LegalMoves', handleLegalMoves);
      off('Error', handleError);
    };
  }, [isConnected, matchId, userId, joinSignalRMatch, on, off]);

  // How many cells the board currently shows — read by the opponent-watch below, which must not re-render a board that
  // has not actually changed.
  const filledCellsRef = useRef(0);
  useEffect(() => {
    filledCellsRef.current = board.filter(cell => cell !== null).length;
  }, [board]);

  /**
   * The turn is this player's: ask what they may play, so a dropped card can land in the same frame (see
   * `requestPreview`). One trigger covers every way a turn begins — opening a board that is already theirs, the push
   * that hands the turn back after an opponent's move, and a reconnection — because all of them end in `isMyTurn`
   * becoming true. The server answers only the player whose turn it really is, so asking is always safe.
   */
  useEffect(() => {
    if (!isMyTurn || !match || match.status !== 'active') return;

    requestPreview();
  }, [isMyTurn, match, requestPreview]);

  /**
   * The board's own cure for a push that never comes.
   *
   * Delivery is not guaranteed to the tab that needs it, and this is not about the socket: the process that plays the
   * CPU's turn is not necessarily the process holding this connection. Two backends can share one database — a local
   * `dotnet run`, which the repository's `.env` points at the deployed Supabase database, alongside the deployed
   * instance — and the turn claim (PLAN-016) then hands each CPU turn to exactly one of them, decided by nothing but
   * timing: the winner writes the move and pushes it to **its own** SignalR groups. The move exists (a refresh shows
   * it) and was pushed to nobody. Reconnecting cannot help, because there is nothing wrong with the connection: the
   * push was never sent here.
   *
   * So while the **opponent** is on turn — and only then, since this player's own moves are credited from the process
   * that answers their own connection — the board reads the match itself and applies what it finds. Nothing on screen
   * changes unless the server's board has really moved on.
   */
  useEffect(() => {
    if (!matchId || !match || match.status !== 'active' || isMyTurn || !userId) return;

    let cancelled = false;

    const lookForTheirMove = async () => {
      try {
        const matchResponse = await apiService.getMatch(parseInt(matchId));
        if (cancelled) return;
        if (matchResponse.placements.length === filledCellsRef.current) {
          return;
        }

        // The same state the push path builds, from the same mapping — minus the rule flash, which only travels on
        // `CardPlayed` (`triggeredRules` is not part of a match read).
        setMatch(matchResponse.match);
        setBoard(buildBoard(matchResponse.placements));
        setOpponentHand(buildOpponentHand(matchResponse.placements, userId));
        setIsMyTurn(matchResponse.match.currentPlayerTurn === userId);
        previewRef.current = null;
        console.log(
          '👀 Found the opponent’s move without a push (their answer came from another process)'
        );
      } catch (error) {
        console.warn('Could not check the match while waiting for the opponent:', error);
      }
    };

    const timer = window.setInterval(lookForTheirMove, OPPONENT_WATCH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [matchId, match, isMyTurn, userId]);

  /**
   * A reconnected socket has to be picked up where it left off, and "connected again" is not enough: SignalR keeps this
   * tab's event handlers across a reconnect, but the server's connection id — and with it this tab's membership of
   * `match-<id>` — belongs to the connection, not to the player, and anything pushed while the socket was down is never
   * replayed. So a reconnect does two things, in this order: **re-join the match** (or no push will ever arrive again,
   * which is the reported "refresh to see the CPU's move") and **re-read the board** the server has now (or a move made
   * during the gap stays invisible).
   */
  useEffect(() => {
    if (reconnectCount === 0 || !isConnected || !matchId || !userId) return;

    let cancelled = false;

    const catchUp = async () => {
      try {
        await joinSignalRMatch(parseInt(matchId));

        const matchResponse = await apiService.getMatch(parseInt(matchId));
        const hand = await apiService.getPlayerHand(parseInt(matchId));
        if (cancelled) return;

        setMatch(matchResponse.match);
        setBoard(buildBoard(matchResponse.placements));
        setPlayerHand(hand.map(card => convertApiCardToLocalCard(card)));
        setOpponentHand(buildOpponentHand(matchResponse.placements, userId));
        setIsMyTurn(matchResponse.match.currentPlayerTurn === userId);

        // Both of these described the turn before the gap: the list may be for a board that has moved on (the drop
        // checks that) and a request already out for this match would block the fresh one.
        previewRef.current = null;
        previewRequestRef.current = null;
        if (matchResponse.match.status === 'active') {
          requestPreview();
        }

        console.log('🔁 Caught up with the match after reconnecting');
      } catch (error) {
        console.error('Failed to catch up after reconnecting:', error);
      }
    };

    catchUp();

    return () => {
      cancelled = true;
    };
  }, [reconnectCount, isConnected, matchId, userId, joinSignalRMatch, requestPreview]);

  // Detect game completion and show dialog after 3 seconds
  useEffect(() => {
    if (!match || !userId) return;

    // Check if all 9 board positions are filled
    const isBoardFull = board.every(cell => cell !== null);

    if (isBoardFull && match.status === 'completed' && !showGameOver) {
      // Show dialog after 3 seconds
      const timer = setTimeout(() => {
        setGameResult(resolveResult(match, userId));
        setShowGameOver(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [board, match, userId, showGameOver]);

  // A forfeit ends the match with the board half empty, so the two full-board effects above never fire for it: the
  // completion push is the only signal and the final scores are what decide the wording.
  useEffect(() => {
    if (!match || !userId || !completionReason || showGameOver) return;

    const timer = setTimeout(() => {
      setGameResult(resolveResult(match, userId));
      setShowGameOver(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [match, userId, completionReason, showGameOver]);
  const getOpponentName = () => {
    if (!match) return 'Opponent';

    const opponent = match.player1Id === userId ? match.player2Id : match.player1Id;

    // The CPU plays under the sentinel login — an identity, not a name — so it is never shown as one.
    return opponent === CPU_OPPONENT_ID ? 'CPU' : opponent;
  };

  // Loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress sx={{ color: '#4a9eff' }} />
        <Typography variant="h6" sx={{ ml: 2, color: '#fff' }}>
          Loading match...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography variant="h6" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  // Match not loaded
  if (!match) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography variant="h6" sx={{ color: '#fff' }}>
          Match not found
        </Typography>
      </Box>
    );
  }

  // Settled before it could be played — a deadline passed or the search was cancelled. There is nothing to play, so
  // the way out is the only thing left on screen.
  if (match.status === 'abandoned' || abandonedReason) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
        sx={{ gap: 2, textAlign: 'center', px: 2 }}
      >
        <Typography variant="h5" sx={{ color: '#ffcc00', fontWeight: 'bold' }}>
          ⚠️ Match abandoned
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {abandonedReason
            ? `This match could not be played — ${abandonedReason}.`
            : 'This match could not be played — it expired before both players were ready.'}
        </Typography>
        <Button
          onClick={() => navigate('/lobby')}
          variant="contained"
          sx={{ bgcolor: '#4a9eff', '&:hover': { bgcolor: '#0078ff' }, px: 4, py: 1.5 }}
        >
          Back to Lobby
        </Button>
      </Box>
    );
  }

  // Get scores based on which player we are
  const opponentName = getOpponentName();
  const playerScore = match.player1Id === userId ? match.player1Score : match.player2Score;
  const opponentScore = match.player1Id === userId ? match.player2Score : match.player1Score;
  // The opponent's login exactly as the match stores it (`"AI"` for the CPU — an identity rather than a name), and
  // whether that makes them somebody whose profile can be looked up at all (PLAN-020).
  const opponentLogin = match.player1Id === userId ? match.player2Id : match.player1Id;
  const isCpuOpponent = opponentLogin === CPU_OPPONENT_ID;
  // Rewards granted to this player when the match completed, if the server granted any at all: a CPU match can be
  // reward-free (CpuOpponent.RewardsForCpuMatches on the server) and a loss pays 0 XP, so the dialog only shows the
  // box when there is something in it.
  const myReward = lastRewards
    ? match.player1Id === userId
      ? { coins: lastRewards.player1Coins, experience: lastRewards.player1Experience }
      : { coins: lastRewards.player2Coins, experience: lastRewards.player2Experience }
    : null;
  // Handle game over dialog actions
  const handleReturnToLobby = () => {
    navigate('/lobby');
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Turn indicator */}
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Typography
          variant="h6"
          sx={{
            color: match.status === 'completed' ? '#ffcc00' : isMyTurn ? '#4eff4a' : '#ff4a4a',
          }}
        >
          {match.status === 'completed'
            ? '🏁 Match Completed'
            : isMyTurn
              ? '🎯 Your Turn'
              : "⏳ Opponent's Turn"}
        </Typography>
        {connectionState !== 'connected' && (
          <Typography variant="body2" sx={{ color: '#ff9800' }}>
            {connectionState === 'reconnecting'
              ? '⚠️ Reconnecting to the server…'
              : connectionState === 'reconnected'
                ? '🔁 Reconnected — catching up…'
                : '⚠️ Disconnected from server'}
          </Typography>
        )}
        {match.rules && match.rules.length > 0 && (
          <Box className="match-rules">
            {match.rules.map(rule => (
              <span key={rule} className="rule-chip">
                {ruleLabel(rule)}
              </span>
            ))}
          </Box>
        )}
      </Box>
      <div className="game-layout">
        <Hand
          cards={opponentHand}
          // The name is a control for a human opponent and plain text for the CPU (PLAN-020): the score beside it is
          // never clickable, and the CPU branch renders exactly what it rendered before this plan.
          title={
            isCpuOpponent ? (
              `${opponentName} - Score: ${opponentScore}`
            ) : (
              <>
                <button
                  type="button"
                  className="match-opponent-name"
                  aria-haspopup="dialog"
                  title={`See ${opponentLogin}'s profile`}
                  onClick={() => setProfileLogin(opponentLogin)}
                >
                  {opponentName}
                </button>
                {` - Score: ${opponentScore}`}
              </>
            )
          }
          isOpponent={true}
          className="opponent-hand"
        />{' '}
        <Board board={board} currentUsername={userId} />
        <Hand
          cards={playerHand}
          title={`${userId} - Score: ${playerScore}`}
          isOpponent={false}
          className="player-hand"
          isMyTurn={isMyTurn}
        />
        {/* Full-field effect when a rule fires (e.g. SAME). It is absolutely positioned, so it
            covers the hand/board without shifting the layout, and `pointer-events: none` in
            Match.scss keeps drag & drop on the board working while it is on screen. */}
        {lastTriggeredRule && (
          <div className="match-rule-flash">
            <span className="match-rule-flash-text">⚡ {lastTriggeredRule}!</span>
          </div>
        )}
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="drag-overlay-card">
            {' '}
            <img
              src={`/triple-triad/images/cards/${activeCard.blueImagePath}`}
              alt={activeCard.name}
              className="drag-overlay-image"
            />
          </div>
        ) : null}
      </DragOverlay>

      {/* Game Over Dialog */}
      <Dialog
        open={showGameOver}
        onClose={() => {}} // Prevent closing by clicking outside
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
            border: '2px solid #3a3a5e',
            borderRadius: '12px',
          },
        }}
      >
        <DialogTitle
          sx={{
            textAlign: 'center',
            color: gameResult === 'won' ? '#4eff4a' : gameResult === 'lost' ? '#ff4a4a' : '#ffcc00',
            fontSize: '2rem',
            fontWeight: 'bold',
            textShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
          }}
        >
          {gameResult === 'won' && '🎉 Victory!'}
          {gameResult === 'lost' && '💔 Defeat'}
          {gameResult === 'draw' && '🤝 Draw!'}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', color: '#fff' }}>
          {/* A match settled by a timeout has no score to show: nobody played a card, so the line would read 5-5 and
              the outcome is stated in words instead (below). */}
          {!completionReason && (
            <>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Final Score
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  mb: 3,
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ color: '#4a9eff' }}>
                    {userId}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4eff4a' }}>
                    {playerScore}
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ alignSelf: 'center', color: '#666' }}>
                  -
                </Typography>
                <Box>
                  <Typography variant="h6" sx={{ color: '#ff6b6b' }}>
                    {opponentName}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ff4a4a' }}>
                    {opponentScore}
                  </Typography>
                </Box>
              </Box>
            </>
          )}
          {gameResult === 'won' && !completionReason && (
            <Typography variant="body1" sx={{ color: '#4eff4a', mb: 1 }}>
              Excellent work! You dominated the battlefield! 🏆
            </Typography>
          )}
          {gameResult === 'lost' && !completionReason && (
            <Typography variant="body1" sx={{ color: '#ff6b6b', mb: 1 }}>
              Better luck next time! Keep practicing! 💪
            </Typography>
          )}
          {gameResult === 'draw' && !completionReason && (
            <Typography variant="body1" sx={{ color: '#ffcc00', mb: 1 }}>
              Evenly matched! A true battle of equals!
            </Typography>
          )}
          {completionReason === 'timeout' && (
            <Typography variant="body1" sx={{ color: '#ffcc00', mb: 1 }}>
              ⏱️ {gameResult === 'won' ? 'Your opponent left — you win.' : 'You timed out.'}
            </Typography>
          )}
          {myReward && (myReward.coins > 0 || myReward.experience > 0) && (
            <Box
              sx={{
                mt: 2,
                display: 'inline-flex',
                gap: 2,
                alignItems: 'center',
                px: 2,
                py: 1,
                borderRadius: 2,
                background: 'rgba(255, 204, 0, 0.12)',
                border: '1px solid rgba(255, 204, 0, 0.35)',
              }}
            >
              <Typography variant="h6" sx={{ color: '#ffcc00', fontWeight: 'bold' }}>
                🪙 +{myReward.coins}
              </Typography>
              <Typography variant="h6" sx={{ color: '#4a9eff', fontWeight: 'bold' }}>
                ⭐ +{myReward.experience} XP
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            onClick={handleReturnToLobby}
            variant="contained"
            sx={{
              bgcolor: '#4a9eff',
              '&:hover': { bgcolor: '#0078ff' },
              px: 4,
              py: 1.5,
            }}
          >
            Return to Lobby
          </Button>
        </DialogActions>
      </Dialog>
      {/* The opponent's profile panel (PLAN-020). The dialog lives here because this is what knows the opponent's
          login; the panel it shows knows nothing about the shell. Closing it is just clearing the login. */}
      <PlayerProfileModal
        open={profileLogin !== null}
        login={profileLogin ?? ''}
        onClose={() => setProfileLogin(null)}
      />
    </DndContext>
  );
};
