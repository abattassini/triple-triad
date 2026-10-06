import { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { BareModal } from './BareModal';
import { PlayerProfile } from './PlayerProfile';
import {
  apiService,
  CPU_OPPONENT_ID,
  type FriendshipState,
  type OpponentProfile,
} from '../services/api';

interface PlayerProfileModalProps {
  open: boolean;
  /** Whose profile to show. Never the CPU sentinel — that is checked here as well as at the trigger. */
  login: string;
  onClose: () => void;
}

/**
 * Another player's profile in the shared dialog shell: it asks the server for `login`'s public profile, shows a
 * waiting state while the call is in flight, and hands the result to `PlayerProfile` — which knows nothing about any
 * of this (`plans/PLAN-020-opponent-profile/plan.md` §3.2). The shell is the only thing here that knows what a dialog
 * is, which is exactly the split the request asked for.
 *
 * Three things it refuses to do:
 *  - **Ask about the CPU.** `"AI"` is a sentinel, not a player row, so the only answer it could get is a 404. The
 *    trigger never offers it, and this guard means a future caller cannot make the request either.
 *  - **Trap the player while waiting.** The shell's own `BareModalLoading` is deliberately non-dismissable (it stands
 *    in for a flow that is about to move the player somewhere), so a passive panel cannot use it: the waiting state
 *    lives *inside* this dialog, which Esc and a backdrop click can always close.
 *  - **Let a slow reply win.** The dialog is opened from a name that can change, so every fetch carries a request id
 *    and only the newest one may paint — otherwise "open A, close, open B" can leave A's profile on screen under B's
 *    name.
 */
export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ open, login, onClose }) => {
  const [profile, setProfile] = useState<OpponentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // Only ever bumped by Try again, to re-run the effect below.
  // The caller's relation to the player on screen, as the server answered it: what the action under the record is
  // drawn from. Asking and accepting both replace it with the server's new value rather than guessing.
  const [friendship, setFriendship] = useState<FriendshipState>('none');
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const newestRequest = useRef(0);
  const isCpu = login === CPU_OPPONENT_ID;

  useEffect(() => {
    if (!open || isCpu) {
      return;
    }

    const request = ++newestRequest.current;
    const isStale = () => request !== newestRequest.current;
    setProfile(null);
    setError(null);
    setActionError(null);
    setFriendship('none');

    apiService
      .getPlayerProfile(login)
      .then(result => {
        if (!isStale()) {
          setProfile(result);
          // A profile fetched before this field existed carries no `friendship`; the safe reading of that is `none`,
          // which offers the one action that is always legal — ask, which the server may answer as an accept.
          setFriendship(result.friendship ?? 'none');
        }
      })
      .catch((failure: Error) => {
        if (!isStale()) {
          setError(failure.message);
        }
      });
  }, [open, login, isCpu, attempt]);

  // Asking and accepting are the two things this dialog can do, and both answer the pair's state as the server now
  // sees it — which is what the button is redrawn from. That is why a mutual ask needs no special case here: the
  // answer comes back `friends` (`plans/PLAN-022-notifications-and-friends/plan.md` §5 D3).
  const act = async (action: 'ask' | 'accept') => {
    setIsActing(true);
    setActionError(null);

    try {
      const answer =
        action === 'ask'
          ? await apiService.requestFriend(login)
          : await apiService.acceptFriend(login);
      setFriendship(answer.friendship);
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'That did not work.');
    } finally {
      setIsActing(false);
    }
  };

  // The CPU has no profile to show, and a closed dialog shows nothing: in both cases the DOM stays empty rather than
  // mounting a dialog nothing can fill.
  if (!open || isCpu) {
    return null;
  }

  // The four states of the action, from the profile's `friendship` — and nothing else decides which one is drawn
  // (`plans/PLAN-022-notifications-and-friends/plan.md` §3.5, §3.2's table):
  //   `none`      → *Add friend*, which asks (and accepts theirs if they asked first)
  //   `requested` → *Request sent*, inert: the request is theirs to answer now
  //   `incoming`  → *Accept friend request*
  //   `friends`   → a static badge, because there is nothing left to do from here (unfriending is the next plan's
  //                 friend list, not a duel's profile panel)
  // Declining is deliberately absent: that is the notification panel's job, where the request actually arrived.
  const friendAction = (
    <Box className="player-profile__friends">
      {friendship === 'none' && (
        <Button variant="contained" disabled={isActing} onClick={() => void act('ask')}>
          Add friend
        </Button>
      )}

      {friendship === 'requested' && (
        <Button variant="outlined" disabled title="Waiting for them to answer">
          Request sent
        </Button>
      )}

      {friendship === 'incoming' && (
        <Button variant="contained" disabled={isActing} onClick={() => void act('accept')}>
          Accept friend request
        </Button>
      )}

      {friendship === 'friends' && <span className="player-profile__friends-badge">Friends</span>}

      {actionError && (
        <Typography variant="body2" className="player-profile__error">
          {actionError}
        </Typography>
      )}
    </Box>
  );

  return (
    <BareModal
      open
      onClose={onClose}
      maxWidth="xs"
      ariaLabel={profile ? `${login}'s profile` : `Loading ${login}'s profile`}
    >
      {!profile && !error && (
        <Box className="player-profile">
          <CircularProgress className="player-profile__spinner" />
          <Typography variant="body2" className="player-profile__caption">
            Loading {login}&rsquo;s profile…
          </Typography>
        </Box>
      )}

      {error && (
        <Box className="player-profile">
          <Typography variant="h6" className="player-profile__name">
            {login}
          </Typography>
          <Typography variant="body2" className="player-profile__error">
            {error}
          </Typography>
          <Box className="player-profile__actions">
            <Button variant="outlined" onClick={() => setAttempt(current => current + 1)}>
              Try again
            </Button>
            <Button variant="contained" onClick={onClose}>
              Close
            </Button>
          </Box>
        </Box>
      )}

      {profile && <PlayerProfile profile={profile} action={friendAction} />}
    </BareModal>
  );
};
