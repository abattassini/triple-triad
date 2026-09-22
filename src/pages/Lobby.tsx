import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Alert, Box, Typography, CircularProgress, Container, Button, Paper } from '@mui/material';
import { BareModal } from '../components/BareModal';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { PlayerStats } from '../components/PlayerStats';
import { SelectHandModal } from '../components/SelectHandModal';
import { apiService, ALL_MATCH_RULES, type MatchRule } from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { useAuth } from '../contexts/AuthContext';
import './Lobby.scss';

/**
 * Whether two rule sets are the same rules, regardless of order: the backend sends them in enum order while the
 * client's constants may list them differently.
 */
const sameRuleSet = (left: MatchRule[], right: MatchRule[]): boolean =>
  left.length === right.length && left.every(rule => right.includes(rule));

/** Where the Quick Match flow is: idle → the rules modal → searching → picking → waiting → the board. */
type MatchPhase = 'idle' | 'searching' | 'picking' | 'waiting';

/** How often the waiting panel checks the match while the opponent picks — the MatchReady push is the fast path. */
const READINESS_POLL_MS = 2000;

export const Lobby: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const login = user?.login;
  const { isConnected, on, off, joinMatch } = useSignalR();

  // Where the Quick Match flow is (see MatchPhase above).
  const [phase, setPhase] = useState<MatchPhase>('idle');
  // The match being set up — and, while waiting, the one about to be opened.
  const [matchId, setMatchId] = useState<number | null>(null);
  // The rules the player is waiting with, so the searching state can name them.
  const [searchingRules, setSearchingRules] = useState<MatchRule[]>([]);
  // Whether the "how do you want to play?" modal is open.
  const [isChoosingRules, setIsChoosingRules] = useState(false);
  // Why the picker is still on screen: the server rejected the list we sent.
  const [pickError, setPickError] = useState<string | null>(null);
  // True while the commit call (join, or filing the hand) is in flight.
  const [isConfirming, setIsConfirming] = useState(false);
  // A dead end (a timeout, a failed call) explained above the tiles.
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!login) {
      navigate('/');
      return;
    }
  }, [login, navigate]);

  // Pick up the latest coins/XP/W-L-T whenever the lobby is entered after a match.
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /** In the match's SignalR room, so its pushes reach us. A failure is not fatal: the board joins again on mount. */
  const enterRoom = useCallback(
    async (id: number) => {
      try {
        await joinMatch(id);
      } catch (error) {
        console.error('Failed to join the match room:', error);
      }
    },
    [joinMatch]
  );

  /** Both hands are filed: join the match's SignalR group and open the board. */
  const openBoard = useCallback(
    async (id: number) => {
      await enterRoom(id);
      navigate(`/match/${id}`);
    },
    [enterRoom, navigate]
  );

  /** A dead end (a timeout, a cancel, a failed call): the tiles come back with the reason on screen. */
  const endSearch = useCallback((message?: string) => {
    setPhase('idle');
    setMatchId(null);
    setIsConfirming(false);
    setPickError(null);

    if (message) {
      setStatusMessage(message);
    }
  }, []);
  useEffect(() => {
    if (!isConnected || !login) return;

    // Somebody joined the match we were waiting in: both players exist now, so the picker opens on both sides at the
    // same time — ours is opened right here, the joiner's by the join call it just made.
    const handleMatchJoined = (...args: unknown[]) => {
      const data = args[0] as { matchId: number; status: string };
      console.log('Match joined:', data);

      if (data.status === 'active' && phase === 'searching') {
        setMatchId(data.matchId);
        setPhase('picking');
      }
    };

    // Both hands are in: the board can open (the push is the fast path, the poll below is the safety net).
    const handleMatchReady = (...args: unknown[]) => {
      const data = args[0] as { matchId: number };
      console.log('Match ready:', data);

      if (data.matchId === matchId && phase === 'waiting') {
        openBoard(data.matchId);
      }
    };

    // The server gave up on the match (a timeout, or the search was cancelled): there is nothing left to wait for.
    const handleMatchAbandoned = (...args: unknown[]) => {
      const data = args[0] as { matchId: number; reason?: string };
      console.log('Match abandoned:', data);

      if (data.matchId === matchId) {
        endSearch(data.reason ? `Match abandoned — ${data.reason}.` : 'That match was abandoned.');
      }
    };

    // Listen for errors
    const handleError = (...args: unknown[]) => {
      const message = args[0] as string;
      console.error('SignalR Error:', message);
      endSearch(`Error: ${message}`);
    };

    on('MatchJoined', handleMatchJoined);
    on('MatchReady', handleMatchReady);
    on('MatchAbandoned', handleMatchAbandoned);
    on('Error', handleError);

    return () => {
      off('MatchJoined', handleMatchJoined);
      off('MatchReady', handleMatchReady);
      off('MatchAbandoned', handleMatchAbandoned);
      off('Error', handleError);
    };
  }, [isConnected, login, matchId, phase, on, off, openBoard, endSearch]);

  // While the opponent picks, the MatchReady push above is the fast path and this poll is the safety net — and the
  // only way to notice a deadline that passed between two sweeps (`timedOut`).
  useEffect(() => {
    if (phase !== 'waiting' || matchId === null) return;

    let cancelled = false;

    const check = async () => {
      try {
        const { match } = await apiService.getMatch(matchId);
        if (cancelled) return;

        if (match.status === 'abandoned' || match.timedOut) {
          endSearch('The match was abandoned before it could start.');
          return;
        }

        if (match.handsReady) {
          openBoard(matchId);
        }
      } catch (error) {
        // A blip on one check is not fatal: the push and the next tick both get another chance.
        console.error('Checking the match failed:', error);
      }
    };

    // Checked once straight away too, so a match whose other hand is already in opens without waiting a tick.
    check();
    const timer = window.setInterval(check, READINESS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase, matchId, openBoard, endSearch]);

  /**
   * Quick Match. A waiting match with exactly these rules is joined, otherwise a waiting match of our own is created
   * and we become the one who is found. **Neither call files a hand**: the moment the match has its two players both
   * of them are sent to the picker, and each files their five through `POST match/{id}/hand` — which is also what
   * makes the match ready and opens the board.
   */
  const startMatch = async (rules: MatchRule[]) => {
    if (!login || !isConnected) {
      alert('Please wait for connection...');
      return;
    }

    // Close the choice first: from here the tile's searching state (or the picker) takes over.
    setIsChoosingRules(false);
    setStatusMessage(null);
    setPickError(null);
    setSearchingRules(rules);
    setMatchId(null);
    setPhase('searching');

    try {
      // Only a waiting match that plays by exactly these rules may be joined, so the option the player picked is
      // the match they get; a waiting match with other rules (or none) means starting our own.
      const waitingMatches = await apiService.getWaitingMatches();
      const compatible = waitingMatches.find(match => sameRuleSet(match.rules, rules));

      if (compatible) {
        // Somebody is waiting: joining seats us (there is no hand in this call) and both of us pick from here.
        const joined = await apiService.joinMatch(compatible.id, { pickHandLater: true });
        await enterRoom(joined.match.id);

        setMatchId(joined.match.id);
        setPhase('picking');
        return;
      }

      // Nothing waiting with these rules: create one and keep the tile spinning until somebody joins. It is created
      // without a hand on purpose — the pick comes once the match has both players.
      const created = await apiService.createMatch(undefined, rules, { pickHandLater: true });
      await enterRoom(created.match.id);

      setMatchId(created.match.id);
      console.log('Waiting for opponent...', created.match.id);
    } catch (error) {
      console.error('Quick match error:', error);
      endSearch(`Failed to start quick match: ${(error as Error).message}`);
    }
  };

  /**
   * Continue in the picker: file the five cards. Both players do exactly this once the match exists, and this is the
   * call that tells the server our hand is in — the board opens when *both* hands are. A failure keeps the picker on
   * screen with the server's reason and never navigates.
   */
  const confirmPick = async (cardIds: number[]) => {
    if (matchId === null) return;

    setIsConfirming(true);
    setPickError(null);

    try {
      await apiService.setMatchHand(matchId, cardIds);
      setPhase('waiting');
    } catch (error) {
      setPickError((error as Error).message);
    } finally {
      setIsConfirming(false);
    }
  };

  /** The searching tile's Cancel: give up the waiting match through the API, not only in local state. */
  const handleCancelSearch = async () => {
    if (matchId === null) {
      endSearch();
      return;
    }

    try {
      await apiService.cancelMatch(matchId);
      endSearch('Search cancelled.');
    } catch (error) {
      // Most often somebody joined in the meantime — the MatchJoined push then moves us on to the picker.
      console.error('Cancelling the search failed:', error);
      setStatusMessage(`Could not cancel the search: ${(error as Error).message}`);
    }
  };

  /**
   * The picker's way out. The match has both players by the time the picker opens, so there is nothing to cancel any
   * more: it is left to the hand-pick timeout (S2), which settles it two minutes later.
   */
  const handleCancelPicking = () => {
    endSearch();
  };

  if (!login) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box className="lobby-container">
      <HamburgerMenu />
      <Container className="lobby-content">
        <PlayerStats player={user} variant="card" className="lobby-stats-mobile" />

        <Typography variant="body1" className="lobby-subtitle">
          {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
        </Typography>

        {statusMessage && (
          <Alert severity="info" className="lobby-status" onClose={() => setStatusMessage(null)}>
            {statusMessage}
          </Alert>
        )}

        <Box className="lobby-body">
          <PlayerStats player={user} variant="sidebar" className="lobby-stats-desktop" />

          <Box className="lobby-actions">
            <Paper elevation={3} sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2 }}>
              <Typography variant="h5" sx={{ color: '#4a9eff', mb: 1 }}>
                🎮 Quick Match
              </Typography>
              <Typography variant="body2" sx={{ color: '#ccc', mb: 2 }}>
                Join a match with a random opponent
              </Typography>

              {phase === 'searching' ? (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <CircularProgress sx={{ color: '#4a9eff' }} />
                  <Typography variant="body1" sx={{ mt: 2, color: '#fff' }}>
                    Searching for opponent...
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#4a9eff', mt: 1 }}>
                    {searchingRules.length > 0
                      ? `Rules: ${searchingRules.map(rule => rule.toUpperCase()).join(' · ')}`
                      : 'No special rules'}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleCancelSearch}
                    sx={{ mt: 2 }}
                  >
                    Cancel
                  </Button>
                </Box>
              ) : (
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={() => setIsChoosingRules(true)}
                  // The picker and the waiting panel live in their own modal, which blocks the page behind them.
                  disabled={!isConnected || phase !== 'idle'}
                  sx={{
                    backgroundColor: '#4a9eff',
                    '&:hover': { backgroundColor: '#3a8eef' },
                  }}
                >
                  Quick Match
                </Button>
              )}
            </Paper>

            <Paper elevation={3} sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2 }}>
              <Typography variant="h5" sx={{ color: '#4a9eff', mb: 1 }}>
                🃏 My Cards
              </Typography>
              <Typography variant="body2" sx={{ color: '#ccc', mb: 2 }}>
                See the cards you own, grouped by level
              </Typography>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => navigate('/cards')}
                sx={{
                  backgroundColor: '#4a9eff',
                  '&:hover': { backgroundColor: '#3a8eef' },
                }}
              >
                My Cards
              </Button>
            </Paper>

            <Paper elevation={3} sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2 }}>
              <Typography variant="h5" sx={{ color: '#4a9eff', mb: 1 }}>
                🛒 Card Shop
              </Typography>
              <Typography variant="body2" sx={{ color: '#ccc', mb: 2 }}>
                Buy a 5-card pack for 1,500 coins
              </Typography>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => navigate('/shop')}
                sx={{
                  backgroundColor: '#4a9eff',
                  '&:hover': { backgroundColor: '#3a8eef' },
                }}
              >
                Open Shop
              </Button>
            </Paper>

            <Paper
              elevation={3}
              sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2, opacity: 0.6 }}
            >
              <Typography variant="h5" sx={{ color: '#888', mb: 1 }}>
                ➕ Create Match
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                Custom match settings (Coming Soon)
              </Typography>
              <Button variant="contained" fullWidth size="large" disabled>
                Create Match
              </Button>
            </Paper>

            <Paper
              elevation={3}
              sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2, opacity: 0.6 }}
            >
              <Typography variant="h5" sx={{ color: '#888', mb: 1 }}>
                📋 Match History
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                No matches played yet
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Container>

      <BareModal
        open={isChoosingRules}
        onClose={() => setIsChoosingRules(false)}
        // Full width up to the dialog's cap: without it MUI shrink-wraps the paper to its content, which
        // left the modal a narrow column in the middle of a desktop screen. Lobby.scss keeps the content a
        // modest centred column (the two options stay stacked), so `sm` is all the room it needs.
        fullWidth
        maxWidth="sm"
        className="lobby-rules-modal"
        ariaLabel="Quick Match options"
      >
        <Typography variant="h5" className="lobby-rules-modal__title">
          🎮 Quick Match
        </Typography>
        <Typography variant="body2" className="lobby-rules-modal__hint">
          Pick how you want to play
        </Typography>

        <Box className="lobby-rules-modal__options">
          <Button
            autoFocus
            variant="outlined"
            size="large"
            fullWidth
            className="lobby-rules-modal__option"
            onClick={() => startMatch([])}
          >
            <span className="lobby-rules-modal__option-label">Basic Match</span>
            <span className="lobby-rules-modal__option-caption">No special rules</span>
          </Button>

          {/* The caption is rendered from the constant, so a fifth rule needs no change here. */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            className="lobby-rules-modal__option lobby-rules-modal__option--rules"
            onClick={() => startMatch(ALL_MATCH_RULES)}
          >
            <span className="lobby-rules-modal__option-label">Match with Rules</span>
            <span className="lobby-rules-modal__option-caption">
              {ALL_MATCH_RULES.map(rule => rule.toUpperCase()).join(' · ')}
            </span>
          </Button>
        </Box>

        <Button
          variant="text"
          color="inherit"
          className="lobby-rules-modal__cancel"
          onClick={() => setIsChoosingRules(false)}
        >
          Cancel
        </Button>
      </BareModal>

      {/* The picker, or the wait for the opponent's pick. Its own modal, so the page behind stays blocked while a
          match is being set up; Cancel is offered while picking only — once the hand is committed, the ways out are
          the board and the timeouts. */}
      <SelectHandModal
        open={phase === 'picking' || phase === 'waiting'}
        phase={phase === 'waiting' ? 'waiting' : 'picking'}
        onConfirm={confirmPick}
        isConfirming={isConfirming}
        error={pickError}
        onCancel={phase === 'picking' ? handleCancelPicking : undefined}
      />
    </Box>
  );
};
