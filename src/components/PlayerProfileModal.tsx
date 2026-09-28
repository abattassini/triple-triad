import { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { BareModal } from './BareModal';
import { PlayerProfile } from './PlayerProfile';
import { apiService, CPU_OPPONENT_ID, type OpponentProfile } from '../services/api';

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

    apiService
      .getPlayerProfile(login)
      .then(result => {
        if (!isStale()) {
          setProfile(result);
        }
      })
      .catch((failure: Error) => {
        if (!isStale()) {
          setError(failure.message);
        }
      });
  }, [open, login, isCpu, attempt]);

  // The CPU has no profile to show, and a closed dialog shows nothing: in both cases the DOM stays empty rather than
  // mounting a dialog nothing can fill.
  if (!open || isCpu) {
    return null;
  }

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

      {profile && <PlayerProfile profile={profile} />}
    </BareModal>
  );
};
