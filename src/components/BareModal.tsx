import { Box, Dialog, Fade, type DialogProps } from '@mui/material';
import './BareModal.scss';

interface BareModalProps {
  open: boolean;
  /** Called when the shell is allowed to dismiss (Esc or a backdrop click). */
  onClose: () => void;
  /**
   * When false, Esc and the backdrop do nothing and the consumer decides how its content is left — the pack reveal
   * uses this to stay put until every card is face up. Defaults to true.
   */
  dismissable?: boolean;
  /** Sizing of the (transparent) paper. */
  maxWidth?: DialogProps['maxWidth'];
  fullWidth?: boolean;
  /** Applied to the content wrapper, so each consumer styles its own innards. */
  className?: string;
  /** Accessible name of the dialog. */
  ariaLabel?: string;
  children: React.ReactNode;
}

/**
 * The shared overlay: the page behind it is darkened, blurred and impossible to click, while the dialog itself has
 * no surface at all — no background, no border, no shadow — so the consumer's own content is the only thing on
 * screen.
 *
 * It owns the shell and nothing else: the layout, padding and everything visible belong to the consumer (through
 * `className`). `dismissable` is the single exit policy, which lets a consumer gate the way out without the shell
 * knowing anything about it.
 */
export const BareModal: React.FC<BareModalProps> = ({
  open,
  onClose,
  dismissable = true,
  maxWidth = 'sm',
  fullWidth = false,
  className = '',
  ariaLabel,
  children,
}) => (
  <Dialog
    open={open}
    // Esc and a backdrop click only ever close a dismissable modal; otherwise the consumer's own control is the way
    // out (e.g. the reveal's Continue button).
    onClose={() => {
      if (dismissable) {
        onClose();
      }
    }}
    disableEscapeKeyDown={!dismissable}
    maxWidth={maxWidth}
    fullWidth={fullWidth}
    slots={{ transition: Fade }}
    aria-label={ariaLabel}
    slotProps={{
      // No surface at all: the consumer's content is the whole dialog. These removals live in `sx` because emotion's
      // generated class reliably beats Paper's defaults, whereas a stylesheet rule of equal specificity would depend
      // on injection order.
      paper: {
        elevation: 0,
        className: 'bare-modal__paper',
        sx: {
          background: 'none',
          boxShadow: 'none',
          border: 0,
          overflow: 'visible',
          margin: 0,
        },
      },
      // Dark and blurred: the Modal root plus this Backdrop swallow every click aimed at the page underneath, which
      // is what makes the page behind unusable while the modal is open.
      backdrop: {
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(2px)',
        },
      },
    }}
  >
    <Box className={`bare-modal ${className}`.trim()}>{children}</Box>
  </Dialog>
);
