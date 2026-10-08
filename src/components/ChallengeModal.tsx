import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { FiPlayCircle } from 'react-icons/fi';
import { BareModal } from './BareModal';
import './ChallengeModal.scss';

interface ChallengeModalProps {
  open: boolean;
  /** Who invited the player. */
  challenger: string;
  /** True while the answer is in flight. */
  isAnswering?: boolean;
  /** The server's sentence when an answer was refused (a challenge that expired while the dialog was open). */
  error?: string | null;
  onAccept: () => void;
  onRefuse: () => void;
  /** The X: close **without answering** — the invitation stays in the bell (`plans/PLAN-027-friend-challenge` §3.9). */
  onClose: () => void;
}

/**
 * The invitation, over whatever the invited player was doing (`plans/PLAN-027-friend-challenge/plan.md` §3.9). It is
 * opened app-wide by `ChallengesProvider`, which is why it knows nothing about pages: it is handed who challenged and
 * what the three ways out mean.
 *
 * The X is `BareModal`'s opt-in close button (§3.8) — the one modal in the app that asks for one — and it deliberately
 * differs from *Refuse*: closing leaves the invitation standing, refusing ends it.
 */
export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  open,
  challenger,
  isAnswering = false,
  error = null,
  onAccept,
  onRefuse,
  onClose,
}) => {
  if (!open) {
    return null;
  }

  return (
    <BareModal
      open
      onClose={onClose}
      showCloseButton
      maxWidth="xs"
      ariaLabel={`${challenger} challenged you to a match`}
    >
      <Box className="challenge-modal">
        <span className="challenge-modal__icon" aria-hidden="true">
          <FiPlayCircle />
        </span>

        <Typography variant="h6" className="challenge-modal__title">
          You have been challenged!
        </Typography>
        <Typography variant="body1" className="challenge-modal__line">
          <strong>{challenger}</strong> challenged you to a match.
        </Typography>

        {error && (
          <Typography variant="body2" className="challenge-modal__error">
            {error}
          </Typography>
        )}

        <Box className="challenge-modal__actions">
          <Button variant="contained" disabled={isAnswering} onClick={onAccept}>
            Accept
          </Button>
          <Button variant="outlined" disabled={isAnswering} onClick={onRefuse}>
            Refuse
          </Button>
        </Box>

        {isAnswering && <CircularProgress size={20} className="challenge-modal__spinner" />}
      </Box>
    </BareModal>
  );
};
