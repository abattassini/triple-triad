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
  type Card as ApiCard,
  type Match as MatchData,
  type LocalCard,
} from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
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
    redImagePath: 'r' + apiCard.image, // Red version has 'r' prefix
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

export const Match: React.FC = () => {
  const { matchId, username } = useParams<{ matchId: string; username: string }>();
  const navigate = useNavigate();
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

    if (over && over.id !== undefined && matchId && username) {
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
            console.log('🎮 Playing card via SignalR:', { matchId, cardId, x, y, username });
            await playCardSignalR(parseInt(matchId), cardId, x, y, username);

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
      if (!matchId || !username) {
        setError('Missing match ID or username');
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
        const hand = await apiService.getPlayerHand(parseInt(matchId), username);
        setPlayerHand(hand.map(card => convertApiCardToLocalCard(card)));

        // Create opponent hand (card backs)
        const opponentPlacements = matchResponse.placements.filter(p => p.playerId !== username);
        const opponentHandSize = 5 - opponentPlacements.length;
        const cardBacks: LocalCard[] = Array(opponentHandSize)
          .fill(null)
          .map((_, index) => ({
            id: -1 - index, // Negative IDs for card backs
            name: 'Card back',
            blueImagePath: 'back.png',
            redImagePath: 'back.png',
          }));
        setOpponentHand(cardBacks);

        // Check if it's player's turn
        setIsMyTurn(matchResponse.match.currentPlayerTurn === username);

        setLoading(false);
      } catch (err) {
        console.error('Failed to load match:', err);
        setError('Failed to load match data');
        setLoading(false);
      }
    };
    loadMatchData();
  }, [matchId, username]);

  // Check for game completion (all 9 board positions occupied)
  useEffect(() => {
    if (!match || !username) return;

    // Count filled positions
    const filledPositions = board.filter(cell => cell !== null).length;

    // If all 9 positions are filled and game isn't already marked complete
    if (filledPositions === 9 && match.status !== 'completed') {
      console.log('🏁 All 9 positions filled! Game complete.');

      // Wait 3 seconds before showing the dialog
      const timer = setTimeout(() => {
        // Determine result
        const playerScore = match.player1Id === username ? match.player1Score : match.player2Score;
        const opponentScore =
          match.player1Id === username ? match.player2Score : match.player1Score;

        let result: 'won' | 'lost' | 'draw';
        if (playerScore > opponentScore) {
          result = 'won';
        } else if (playerScore < opponentScore) {
          result = 'lost';
        } else {
          result = 'draw';
        }

        setGameResult(result);
        setShowGameOver(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [board, match, username]);

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
        player1Score: number;
        player2Score: number;
        currentPlayer: string;
        isGameComplete: boolean;
        winnerId: string | null;
      };
      console.log('🎴 Card played event received:', data);

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
        if (data.playerId === username) {
          const hand = await apiService.getPlayerHand(parseInt(matchId), username);
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
        setIsMyTurn(data.currentPlayer === username);

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
      };
      console.log('Game completed:', data);
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
    on('Error', handleError);
    return () => {
      off('CardPlayed', handleCardPlayed);
      off('GameCompleted', handleGameCompleted);
      off('Error', handleError);
    };
  }, [isConnected, matchId, username, joinSignalRMatch, on, off]);

  // Detect game completion and show dialog after 3 seconds
  useEffect(() => {
    if (!match || !username) return;

    // Check if all 9 board positions are filled
    const isBoardFull = board.every(cell => cell !== null);

    if (isBoardFull && match.status === 'completed' && !showGameOver) {
      // Determine game result
      const playerScore = match.player1Id === username ? match.player1Score : match.player2Score;
      const opponentScore = match.player1Id === username ? match.player2Score : match.player1Score;

      let result: 'won' | 'lost' | 'draw';
      if (playerScore > opponentScore) {
        result = 'won';
      } else if (playerScore < opponentScore) {
        result = 'lost';
      } else {
        result = 'draw';
      }

      // Show dialog after 3 seconds
      const timer = setTimeout(() => {
        setGameResult(result);
        setShowGameOver(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [board, match, username, showGameOver]);
  const getOpponentName = () => {
    if (!match) return 'Opponent';
    return match.player1Id === username ? match.player2Id : match.player1Id;
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
  } // Get scores based on which player we are
  const opponentName = getOpponentName();
  const playerScore = match.player1Id === username ? match.player1Score : match.player2Score;
  const opponentScore = match.player1Id === username ? match.player2Score : match.player1Score;
  // Handle game over dialog actions
  const handleReturnToLobby = () => {
    navigate(`/lobby/${username}`);
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
      </Box>
      <div className="game-layout">
        <Hand
          cards={opponentHand}
          title={`${opponentName} - Score: ${opponentScore}`}
          isOpponent={true}
          className="opponent-hand"
        />{' '}
        <Board board={board} currentUsername={username} />
        <Hand
          cards={playerHand}
          title={`${username} - Score: ${playerScore}`}
          isOpponent={false}
          className="player-hand"
          isMyTurn={isMyTurn}
        />
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
                {username}
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
          {gameResult === 'won' && (
            <Typography variant="body1" sx={{ color: '#4eff4a', mb: 1 }}>
              Excellent work! You dominated the battlefield! 🏆
            </Typography>
          )}
          {gameResult === 'lost' && (
            <Typography variant="body1" sx={{ color: '#ff6b6b', mb: 1 }}>
              Better luck next time! Keep practicing! 💪
            </Typography>
          )}
          {gameResult === 'draw' && (
            <Typography variant="body1" sx={{ color: '#ffcc00', mb: 1 }}>
              Evenly matched! A true battle of equals!
            </Typography>
          )}{' '}
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
