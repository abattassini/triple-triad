import { useState, useEffect } from 'react';
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
import { Board } from './Board';
import {
  apiService,
  CPU_OPPONENT_ID,
  type Card as ApiCard,
  type Match as MatchData,
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
    on,
    off,
    joinMatch: joinSignalRMatch,
    playCard: playCardSignalR,
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
          try {
            // Immediately remove card from hand to prevent snap-back animation
            setPlayerHand(prev => prev.filter(c => c.id !== cardId));

            // Clear active card
            setActiveCard(null);

            // Convert board index to x, y coordinates
            const x = boardIndex % 3;
            const y = Math.floor(boardIndex / 3);

            // Send move to backend via SignalR
            console.log('🎮 Playing card via SignalR:', { matchId, cardId, x, y, userId });
            await playCardSignalR(parseInt(matchId), cardId, x, y);

            // Don't update local state further - wait for CardPlayed event from SignalR
            // If there's an error, the CardPlayed event won't fire and the hand will be
            // refreshed on the next state update
          } catch (error) {
            console.error('Failed to play card:', error);
            alert('Failed to play card: ' + (error as Error).message);

            // On error, restore the card to the hand
            if (card) {
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
        const newBoard: ((LocalCard & { owner?: string }) | null)[] = Array(9).fill(null);
        matchResponse.placements.forEach(placement => {
          const boardIndex = placement.y * 3 + placement.x; // Convert x,y to board index
          newBoard[boardIndex] = convertApiCardToLocalCard(placement.card, placement.owner);
        });
        setBoard(newBoard);

        // Get player's hand
        const hand = await apiService.getPlayerHand(parseInt(matchId));
        setPlayerHand(hand.map(card => convertApiCardToLocalCard(card)));

        // Create opponent hand (card backs)
        const opponentPlacements = matchResponse.placements.filter(p => p.playerId !== userId);
        const opponentHandSize = 5 - opponentPlacements.length;
        const cardBacks: LocalCard[] = Array(opponentHandSize)
          .fill(null)
          .map((_, index) => ({
            id: -1 - index, // Negative IDs for card backs
            name: 'Card back',
            blueImagePath: 'ff8-deck/back.png',
            redImagePath: 'ff8-deck/back.png',
          }));
        setOpponentHand(cardBacks);

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

      // Flash the rule that fired (e.g. SAME) so both players notice the extra captures.
      if (data.triggeredRules && data.triggeredRules.length > 0) {
        setLastTriggeredRule(ruleLabel(data.triggeredRules[0]));
        setTimeout(() => setLastTriggeredRule(null), 2500);
      }

      try {
        // Fetch the updated match state to get the actual card and board
        const matchResponse = await apiService.getMatch(parseInt(matchId));
        // Update board with all placements
        const newBoard: ((LocalCard & { owner?: string }) | null)[] = Array(9).fill(null);
        matchResponse.placements.forEach(placement => {
          const boardIndex = placement.y * 3 + placement.x;
          newBoard[boardIndex] = convertApiCardToLocalCard(placement.card, placement.owner);
        });
        setBoard(newBoard);

        // Update player's hand
        if (data.playerId === userId) {
          const hand = await apiService.getPlayerHand(parseInt(matchId));
          setPlayerHand(hand.map(card => convertApiCardToLocalCard(card)));
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

      if (data.matchId === parseInt(matchId)) {
        setAbandonedReason(data.reason ?? 'nobody picked their cards in time');
      }
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
    on('Error', handleError);
    return () => {
      off('CardPlayed', handleCardPlayed);
      off('GameCompleted', handleGameCompleted);
      off('MatchAbandoned', handleMatchAbandoned);
      off('Error', handleError);
    };
  }, [isConnected, matchId, userId, joinSignalRMatch, on, off]);

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
        {!isConnected && (
          <Typography variant="body2" sx={{ color: '#ff9800' }}>
            ⚠️ Disconnected from server
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
          title={`${opponentName} - Score: ${opponentScore}`}
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
    </DndContext>
  );
};
