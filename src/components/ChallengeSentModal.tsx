import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { BareModal } from './BareModal';
import './ChallengeSentModal.scss';

interface ChallengeSentModalProps {
  open: boolean;
  /** Who was invited. */
  friend: string;
  /**
   * Set once the invitation ends without being accepted — the server's sentence (declined, expired) or the reason it
   * could not be sent. When it is set the dialog stops waiting and offers a way out.
   */
  message?: string | null;
  /** True while the withdrawal is in flight. */
  isCancelling?: boolean;
  onCancel: () => void;
  onClose: () => void;
}

/**
 * The challenger's side of a challenge (`plans/PLAN-027-friend-challenge/plan.md` §3.9): a small wait with a way to
 * withdraw the invitation. On acceptance the provider closes it and hands the match to the Play page, so this dialog
 * never has to know what happens next.
 *
 * It is deliberately not the `ChallengeModal` mirrored: the invited player *answers* an invitation, while the
 * challenger can only wait or take it back — two different sets of actions, so two components.
 */
export const ChallengeSentModal: React.FC<ChallengeSentModalProps> = ({
  open,
  friend,
  message = null,
  isCancelling = false,
  onCancel,
  onClose,
}) => {
  if (!open) {
    return null;
  }

  return (
    <BareModal open onClose={onClose} maxWidth="xs" ariaLabel={`Waiting for ${friend}`}>
      <Box className="challenge-sent">
        {message ? (
          <>
            <Typography variant="h6" className="challenge-sent__title">
              Challenge not played
            </Typography>
            <Typography variant="body2" className="challenge-sent__line">
              {message}
            </Typography>
            <Button variant="contained" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <CircularProgress size={32} className="challenge-sent__spinner" />
            <Typography variant="h6" className="challenge-sent__title">
              Challenge sent
            </Typography>
            <Typography variant="body2" className="challenge-sent__line">
              Waiting for <strong>{friend}</strong> to accept…
            </Typography>
            <Button variant="text" color="inherit" disabled={isCancelling} onClick={onCancel}>
              Cancel challenge
            </Button>
          </>
        )}
      </Box>
    </BareModal>
  );
};
