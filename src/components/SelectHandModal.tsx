import { Box, CircularProgress, Typography } from '@mui/material';
import { BareModal } from './BareModal';
import { SelectHand } from './SelectHand';

/** What the modal is showing: the picker, or the wait for the opponent's five cards. */
export type SelectHandPhase = 'picking' | 'waiting';

interface SelectHandModalProps {
  open: boolean;
  phase: SelectHandPhase;
  /** Fires with exactly HAND_SIZE card ids when the player confirms — the hand the match will be played with. */
  onConfirm: (cardIds: number[]) => void;
  /** Message above the grid, e.g. the server rejecting the list. */
  error?: string | null;
  /** True while the confirm call is in flight: Continue spins and cannot be pressed again. */
  isConfirming?: boolean;
  /** Leaving the search; only offered while picking. */
  onCancel?: () => void;
}

/**
 * `SelectHand` in the shared bare modal. While it is open the page behind is unusable, so the only things a player
 * can do are pick cards and continue — plus the one deliberate way out, cancel, which only the picker offers.
 *
 * The modal owns no selection state and knows nothing about matchmaking: the caller decides which phase is on
 * screen, what a confirm means (create, join or file a hand) and whether cancelling is still possible.
 */
export const SelectHandModal: React.FC<SelectHandModalProps> = ({
  open,
  phase,
  onConfirm,
  error = null,
  isConfirming = false,
  onCancel,
}) => (
  <BareModal
    open={open}
    // Never dismissable: Esc and the backdrop do nothing, so cancel and continue are the only ways out.
    onClose={() => onCancel?.()}
    dismissable={false}
    fullWidth
    maxWidth="lg"
    ariaLabel="Choose your hand"
  >
    {phase === 'waiting' ? (
      <Box className="select-hand-waiting">
        <CircularProgress size={32} sx={{ color: '#4a9eff' }} />
        <Typography variant="h6" className="select-hand-waiting__title">
          Opponent found
        </Typography>
        <Typography variant="body2" className="select-hand-waiting__caption">
          Waiting for your opponent to pick their cards…
        </Typography>
      </Box>
    ) : (
      <SelectHand
        onConfirm={onConfirm}
        isConfirming={isConfirming}
        error={error}
        onCancel={onCancel}
      />
    )}
  </BareModal>
);
