import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiService,
  CHALLENGE_ACCEPTED,
  CHALLENGE_CANCELLED,
  CHALLENGE_EXPIRED,
  CHALLENGE_RECEIVED,
  CHALLENGE_REFUSED,
} from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { useAuth } from './AuthContext';
import { ChallengeModal } from '../components/ChallengeModal';
import { ChallengeSentModal } from '../components/ChallengeSentModal';
import { ChallengesContext, type ChallengesContextValue } from './ChallengesContext';

/** The invitation the player is being asked to answer. */
interface IncomingChallenge {
  matchId: number;
  challenger: string;
}

/** The invitation the player has sent and is waiting on. */
interface OutgoingChallenge {
  login: string;
  /** Null when it could not be sent at all — the dialog then shows the reason instead of waiting. */
  matchId: number | null;
}

/**
 * The challenge state, app-wide (plans/PLAN-027-friend-challenge/plan.md §3.9). It is mounted beside
 * `NotificationsProvider` for the same reason that one is: an invitation must be able to arrive **on any page**, so the
 * listener and the two dialogs it drives cannot belong to a page.
 *
 * Both halves of a challenge are here — the one being answered and the one being waited on — because they are one
 * conversation seen from two sides, and the pushes that move them are addressed to one player's own connections.
 *
 * Acceptance ends in **one** place: `navigate('/play', { state: { matchId } })`. The Play page already owns the pick →
 * `MatchReady` → board flow, so a challenge reuses it rather than growing a second one.
 */
export const ChallengesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { isConnected, on, off, reconnectCount } = useSignalR();

  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingChallenge | null>(null);
  const [outgoingMessage, setOutgoingMessage] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isChallenging, setIsChallenging] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [incomingError, setIncomingError] = useState<string | null>(null);

  // The pushes arrive as callbacks that must read the *current* pair, not the one from the render that installed them.
  const incomingRef = useRef<IncomingChallenge | null>(null);
  const outgoingRef = useRef<OutgoingChallenge | null>(null);

  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);

  useEffect(() => {
    outgoingRef.current = outgoing;
  }, [outgoing]);

  /** The one way an accepted challenge moves on: the Play page's picker, for the match that is now active. */
  const openPicker = useCallback(
    (matchId: number) => {
      navigate('/play', { state: { matchId } });
    },
    [navigate]
  );

  /** Invites a friend. The outcome is the "waiting" dialog either way — it explains a refusal where one happened. */
  const challenge = useCallback(async (login: string) => {
    setIsChallenging(true);
    setOutgoingMessage(null);

    try {
      const answer = await apiService.challengePlayer(login);
      setOutgoing({ login, matchId: answer.matchId });
    } catch (failure) {
      setOutgoing({ login, matchId: null });
      setOutgoingMessage(
        failure instanceof Error ? failure.message : 'That challenge could not be sent.'
      );
    } finally {
      setIsChallenging(false);
    }
  }, []);

  /** Answers an invitation — from the dialog's *Accept*, or from the bell's row. */
  const accept = useCallback(
    async (matchId: number): Promise<boolean> => {
      setIsAnswering(true);
      setIncomingError(null);

      try {
        await apiService.acceptChallenge(matchId);
        setIncoming(null);
        openPicker(matchId);
        return true;
      } catch (failure) {
        setIncomingError(failure instanceof Error ? failure.message : 'That did not work.');
        return false;
      } finally {
        setIsAnswering(false);
      }
    },
    [openPicker]
  );

  const refuse = useCallback(async () => {
    const current = incomingRef.current;
    if (!current) {
      return;
    }

    setIsAnswering(true);
    setIncomingError(null);

    try {
      await apiService.refuseChallenge(current.matchId);
      setIncoming(null);
    } catch (failure) {
      setIncomingError(failure instanceof Error ? failure.message : 'That did not work.');
    } finally {
      setIsAnswering(false);
    }
  }, []);

  const cancelOutgoing = useCallback(async () => {
    const current = outgoingRef.current;
    setIsCancelling(true);

    try {
      if (current?.matchId) {
        await apiService.cancelChallenge(current.matchId);
      }
    } catch {
      // The push, or the twenty-minute window, settles it either way.
    } finally {
      setIsCancelling(false);
      setOutgoing(null);
      setOutgoingMessage(null);
    }
  }, []);

  // A signed-out provider holds nothing: an invitation must not outlive the session on a shared screen.
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setIncoming(null);
      setOutgoing(null);
      setOutgoingMessage(null);
      setIncomingError(null);
    }
  }, [loading, isAuthenticated]);

  // The pushes. `reconnectCount` is in the deps for the same reason the bell has it: a reconnect is a new connection
  // whose server-side groups did not follow it, so the listeners have to be re-installed.
  useEffect(() => {
    if (!isAuthenticated || !isConnected) {
      return;
    }

    const handleReceived = (...args: unknown[]) => {
      const data = args[0] as { matchId?: number; challenger?: string } | undefined;
      if (typeof data?.matchId !== 'number' || typeof data?.challenger !== 'string') {
        return;
      }

      setIncomingError(null);
      setIncoming({ matchId: data.matchId, challenger: data.challenger });
    };

    const handleAccepted = (...args: unknown[]) => {
      const data = args[0] as { matchId?: number } | undefined;
      if (typeof data?.matchId !== 'number' || outgoingRef.current?.matchId !== data.matchId) {
        return;
      }

      setOutgoing(null);
      setOutgoingMessage(null);
      openPicker(data.matchId);
    };

    const handleRefused = (...args: unknown[]) => {
      const data = args[0] as { matchId?: number } | undefined;
      const current = outgoingRef.current;
      if (typeof data?.matchId !== 'number' || current?.matchId !== data.matchId) {
        return;
      }

      setOutgoingMessage(`${current.login} declined your challenge.`);
    };

    const handleCancelled = (...args: unknown[]) => {
      const data = args[0] as { matchId?: number } | undefined;
      if (typeof data?.matchId !== 'number' || incomingRef.current?.matchId !== data.matchId) {
        return;
      }

      // The challenger withdrew it: the dialog goes, and the inbox row stops listing it on the next read.
      setIncoming(null);
      setIncomingError(null);
    };

    const handleExpired = (...args: unknown[]) => {
      const data = args[0] as { matchId?: number } | undefined;
      if (typeof data?.matchId !== 'number') {
        return;
      }

      if (incomingRef.current?.matchId === data.matchId) {
        setIncoming(null);
        setIncomingError(null);
      }

      if (outgoingRef.current?.matchId === data.matchId) {
        setOutgoingMessage('That challenge expired.');
      }
    };

    on(CHALLENGE_RECEIVED, handleReceived);
    on(CHALLENGE_ACCEPTED, handleAccepted);
    on(CHALLENGE_REFUSED, handleRefused);
    on(CHALLENGE_CANCELLED, handleCancelled);
    on(CHALLENGE_EXPIRED, handleExpired);

    return () => {
      off(CHALLENGE_RECEIVED, handleReceived);
      off(CHALLENGE_ACCEPTED, handleAccepted);
      off(CHALLENGE_REFUSED, handleRefused);
      off(CHALLENGE_CANCELLED, handleCancelled);
      off(CHALLENGE_EXPIRED, handleExpired);
    };
  }, [isAuthenticated, isConnected, reconnectCount, on, off, openPicker]);

  const value: ChallengesContextValue = { challenge, isChallenging, accept };

  return (
    <ChallengesContext.Provider value={value}>
      {children}

      <ChallengeModal
        open={incoming !== null}
        challenger={incoming?.challenger ?? ''}
        isAnswering={isAnswering}
        error={incomingError}
        onAccept={() => incoming && void accept(incoming.matchId)}
        onRefuse={() => void refuse()}
        // The X closes **without answering**: the invitation is still in the bell (§3.9).
        onClose={() => {
          setIncoming(null);
          setIncomingError(null);
        }}
      />

      <ChallengeSentModal
        open={outgoing !== null}
        friend={outgoing?.login ?? ''}
        message={outgoingMessage}
        isCancelling={isCancelling}
        onCancel={() => void cancelOutgoing()}
        onClose={() => {
          setOutgoing(null);
          setOutgoingMessage(null);
        }}
      />
    </ChallengesContext.Provider>
  );
};
