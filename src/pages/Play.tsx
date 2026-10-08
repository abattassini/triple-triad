import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Alert, Box, Typography, CircularProgress, Container, Button } from '@mui/material';
import { FiPlayCircle } from 'react-icons/fi';
import { ActionTile } from '../components/ActionTile';
import { BareModal, BareModalLoading } from '../components/BareModal';
import { SelectHandModal } from '../components/SelectHandModal';
import { apiService, ALL_MATCH_RULES, type MatchRule } from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { useAuth } from '../contexts/AuthContext';
import './Play.scss';

/** Where the Quick Match flow is: idle → the rules modal → searching → picking → waiting → the board. */
type MatchPhase = 'idle' | 'searching' | 'picking' | 'waiting';

/** How often the waiting panel checks the match while the opponent picks — the MatchReady push is the fast path. */
const READINESS_POLL_MS = 2000;

// How long a Quick Match gives a real opponent before a bot steps in (plans/PLAN-025-bots/plan.md): a random wait in
// this window, so the fallback never fires at a fixed, predictable moment.
const BOT_FALLBACK_MIN_MS = 4000;
const BOT_FALLBACK_MAX_MS = 8000;

export const Play: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const login = user?.login;
  const { isConnected, on, off, joinMatch } = useSignalR();

  // Where the Quick Match flow is (see MatchPhase above).
  const [phase, setPhase] = useState<MatchPhase>('idle');
  // True while that start call is in flight, so the tile cannot be clicked twice.
  const [isStarting, setIsStarting] = useState(false);
  // The pending bot fallback: while searching, a real opponent gets a random 5–15 s before a bot is seated.
  const botFallback = useRef<number | null>(null);
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

  // Pick up the latest coins/XP/W-L-T whenever Play is entered after a match.
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

  /**
   * A hand-off from an accepted challenge (plans/PLAN-027-friend-challenge/plan.md §3.9): the match is already `active`
   * with both seats filled, so this page only has to join its room and open the picker — the same pick → `MatchReady` →
   * board path Quick Match takes. Consumed once, so cancelling the picker does not reopen it.
   */
  const handedOffMatchId = (useLocation().state as { matchId?: number } | null)?.matchId ?? null;
  const handoffConsumed = useRef<number | null>(null);

  useEffect(() => {
    if (handedOffMatchId === null || handoffConsumed.current === handedOffMatchId) {
      return;
    }

    handoffConsumed.current = handedOffMatchId;
    void enterRoom(handedOffMatchId);
    setMatchId(handedOffMatchId);
    setPhase('picking');
  }, [handedOffMatchId, enterRoom]);

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
    if (botFallback.current !== null) {
      window.clearTimeout(botFallback.current);
      botFallback.current = null;
    }

    setPhase('idle');
    setMatchId(null);
    setIsConfirming(false);
    setPickError(null);

    if (message) {
      setStatusMessage(message);
    }
  }, []);

  // The fallback timer must not outlive the page.
  useEffect(
    () => () => {
      if (botFallback.current !== null) {
        window.clearTimeout(botFallback.current);
      }
    },
    []
  );

  /**
   * No human turned up in the wait window: ask the server to seat an online bot instead
   * (plans/PLAN-025-bots/plan.md). If a human joined just as the timer fired, the server returns that existing match
   * rather than replacing it, so a real game is never taken away — the picker opens either way.
   */
  const fallbackToBot = useCallback(
    async (rules: MatchRule[]) => {
      try {
        const { match } = await apiService.quickBot(rules);
        await enterRoom(match.id);
        setMatchId(match.id);
        setPhase('picking');
      } catch (error) {
        console.error('Bot fallback failed:', error);
        endSearch(`Could not find an opponent: ${(error as Error).message}`);
      }
    },
    [enterRoom, endSearch]
  );
  useEffect(() => {
    if (!isConnected || !login) return;

    // Somebody joined the match we were waiting in: both players exist now, so the picker opens on both sides at the
    // same time — ours is opened right here, the joiner's by the join call it just made.
    const handleMatchJoined = (...args: unknown[]) => {
      const data = args[0] as { matchId: number; status: string };
      console.log('Match joined:', data);

      if (data.status === 'active' && phase === 'searching') {
        // A real opponent turned up: the bot fallback is no longer wanted.
        if (botFallback.current !== null) {
          window.clearTimeout(botFallback.current);
          botFallback.current = null;
        }

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
    setIsStarting(true);

    try {
      // One call. The server looks for an opponent already waiting under exactly these rules and seats us in their
      // match, or starts a match for us to be found in — and it has to be the server's decision rather than ours.
      // The old flow read the waiting list here and wrote in a separate request, so two players searching at the same
      // instant could both read "nobody is waiting" and each start a match, leaving the two of them waiting for each
      // other. Neither of them ever looked again.
      const { match } = await apiService.quickMatch(rules);
      await enterRoom(match.id);

      setMatchId(match.id);

      if (match.status === 'active') {
        // Somebody was waiting and we were seated in their game: both players exist now, so the picker opens here and
        // the other side's is opened by its MatchJoined push.
        setPhase('picking');
        return;
      }

      // Nobody compatible was waiting, so we are the one being found. A real opponent gets a random 5–15 s before we
      // fall back to a bot; a human who joins in the meantime cancels the timer through its MatchJoined push.
      console.log('Waiting for opponent...', match.id);
      const delay =
        BOT_FALLBACK_MIN_MS +
        Math.floor(Math.random() * (BOT_FALLBACK_MAX_MS - BOT_FALLBACK_MIN_MS + 1));
      botFallback.current = window.setTimeout(() => {
        botFallback.current = null;
        void fallbackToBot(rules);
      }, delay);
    } catch (error) {
      console.error('Quick match error:', error);
      endSearch(`Failed to start quick match: ${(error as Error).message}`);
    } finally {
      setIsStarting(false);
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

      // Both hands open the board: against a bot ours is the second one in, so the MatchReady push (or the poll) opens
      // it a beat later — there is no special case here any more.
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
    <Box className="play-container app-chrome-page">
      <Container className="play-content">
        <Typography variant="h4" className="play-title">
          <FiPlayCircle className="page-title-icon" aria-hidden="true" /> Play
        </Typography>
        <Typography variant="body1" className="play-subtitle">
          Find an opponent and start a match
        </Typography>

        {statusMessage && (
          <Alert severity="info" className="play-status" onClose={() => setStatusMessage(null)}>
            {statusMessage}
          </Alert>
        )}

        <Box className="action-tiles">
          {/* The button is the tile's own (the component renders it); while searching, the body is that whole state
              instead. The picker and the waiting panel live in their own modal, which blocks the page behind them. */}
          <ActionTile
            icon={<FiPlayCircle />}
            title="Quick Match"
            caption="Find a random opponent"
            actionLabel="Quick Match"
            onAction={() => setIsChoosingRules(true)}
            actionDisabled={!isConnected || phase !== 'idle' || isStarting}
          >
            {phase === 'searching' ? (
              <Box className="play-searching">
                <CircularProgress sx={{ color: '#4a9eff' }} />
                <Typography variant="body1" className="play-searching__title">
                  Searching for opponent...
                </Typography>
                <Typography variant="body2" className="play-searching__rules">
                  {searchingRules.length > 0
                    ? `Rules: ${searchingRules.map(rule => rule.toUpperCase()).join(' · ')}`
                    : 'No special rules'}
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  className="play-searching__cancel"
                  onClick={handleCancelSearch}
                >
                  Cancel
                </Button>
              </Box>
            ) : undefined}
          </ActionTile>
        </Box>
      </Container>

      <BareModal
        open={isChoosingRules}
        onClose={() => setIsChoosingRules(false)}
        // Full width up to the dialog's cap: without it MUI shrink-wraps the paper to its content, which
        // left the modal a narrow column in the middle of a desktop screen. Play.scss keeps the content a
        // modest centred column (the two options stay stacked), so `sm` is all the room it needs.
        fullWidth
        maxWidth="sm"
        className="play-rules-modal"
        ariaLabel="Quick Match options"
      >
        <Typography variant="h5" className="play-rules-modal__title">
          <FiPlayCircle className="page-title-icon" aria-hidden="true" />
          Quick Match
        </Typography>
        <Typography variant="body2" className="play-rules-modal__hint">
          Pick how you want to play
        </Typography>

        <Box className="play-rules-modal__options">
          <Button
            autoFocus
            variant="outlined"
            size="large"
            fullWidth
            className="play-rules-modal__option"
            onClick={() => startMatch([])}
          >
            <span className="play-rules-modal__option-label">Basic Match</span>
            <span className="play-rules-modal__option-caption">No special rules</span>
          </Button>

          {/* The caption is rendered from the constant, so a fifth rule needs no change here. */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            className="play-rules-modal__option play-rules-modal__option--rules"
            onClick={() => startMatch(ALL_MATCH_RULES)}
          >
            <span className="play-rules-modal__option-label">Match with Rules</span>
            <span className="play-rules-modal__option-caption">
              {ALL_MATCH_RULES.map(rule => rule.toUpperCase()).join(' · ')}
            </span>
          </Button>
        </Box>

        <Button
          variant="text"
          color="inherit"
          className="play-rules-modal__cancel"
          onClick={() => setIsChoosingRules(false)}
        >
          Cancel
        </Button>
      </BareModal>

      {/* From the option click until the picker is on screen: the choice has been made and the create/join (plus the
          SignalR room) is in flight. The same shell shows a spinner instead of dropping the player onto an idle Play,
          and it closes on its own — `isStarting` is cleared in the same batch that moves the phase on, so the
          searching tile (or the picker) is what the player sees next. It cannot be dismissed, because the call behind
          it decides where the flow goes next. */}
      <BareModalLoading open={isStarting} caption="Finding you an opponent…" />

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
