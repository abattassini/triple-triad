import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { BareModal } from './BareModal';
import './RemoveFriendConfirmModal.scss';

interface RemoveFriendConfirmModalProps {
  /** The friend to remove. Null keeps the dialog out of the DOM entirely. */
  login: string | null;
  onCancel: () => void;
  /** Removes them for real. A rejection surfaces here as the server's own sentence. */
  onConfirm: (login: string) => Promise<void>;
}

/**
 * The yes/no step before a friendship is deleted (`plans/PLAN-023-social-friends-list/plan.md` §3.6) — a `BareModal`,
 * as the request asked, because that is the house's shell and this dialog needs none of its own: it paints the usual
 * panel inside it, like `PlayerProfile` does.
 *
 * Three behaviours worth stating: **nothing happens until Remove is pressed**; the button is disabled while the call is
 * in flight, so a double-click cannot send two deletes; and a refusal keeps the dialog open with the server's sentence
 * in it, because a dialog that vanishes on failure leaves the player wondering whether the friend is gone.
 */
export const RemoveFriendConfirmModal: React.FC<RemoveFriendConfirmModalProps> = ({
  login,
  onCancel,
  onConfirm,
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!login) {
    return null;
  }

  const confirm = async () => {
    setIsRemoving(true);
    setError(null);

    try {
      await onConfirm(login);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not remove that friend.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <BareModal
      open
      onClose={onCancel}
      // Mid-flight the dialog is not dismissable: the write is in the air, and the answer decides what happens next.
      dismissable={!isRemoving}
      maxWidth="xs"
      ariaLabel={`Remove ${login}`}
    >
      <Box className="friend-remove">
        <Typography variant="h6" className="friend-remove__title">
          Remove {login}?
        </Typography>

        <Typography variant="body2" className="friend-remove__caption">
          They disappear from your friends list, and you stop being on theirs. You can ask them
          again later.
        </Typography>

        {error && (
          <Typography variant="body2" className="friend-remove__error">
            {error}
          </Typography>
        )}

        <Box className="friend-remove__actions">
          <Button variant="outlined" disabled={isRemoving} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={isRemoving}
            onClick={() => void confirm()}
          >
            Remove
          </Button>
        </Box>
      </Box>
    </BareModal>
  );
};
