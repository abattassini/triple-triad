import { Box, CircularProgress, Dialog, Fade, Typography, type DialogProps } from '@mui/material';
import './BareModal.scss';

interface BareModalProps {
  open: boolean;
  /**
   * Called when the shell is allowed to dismiss (Esc or a backdrop click). Only a dismissable modal needs one: a
   * modal that cannot be dismissed (`dismissable={false}`) has no exit to pass on.
   */
  onClose?: () => void;
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
        onClose?.();
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

interface BareModalLoadingProps {
  open: boolean;
  /** What is being waited for: the line under the spinner, and the dialog's accessible name. */
  caption?: string;
}

/**
 * The shell's own loading state: the same darkened, click-swallowing page, with a spinner where a consumer's content
 * would be — for the gap between a click and the thing that click asked for (the Lobby's rule options, and the picker
 * they lead to). It lives here because the loading look belongs to the shell: every consumer waiting on a call shows
 * the same spinner in the same place instead of inventing its own.
 *
 * It cannot be dismissed — the call behind it is what decides where the flow goes next, and there is no `onClose` to
 * give it — so Esc and the backdrop leave it exactly where it is.
 */
export const BareModalLoading: React.FC<BareModalLoadingProps> = ({
  open,
  caption = 'Loading…',
}) => (
  <BareModal open={open} dismissable={false} ariaLabel={caption}>
    <Box className="bare-modal__loading">
      <CircularProgress size={40} sx={{ color: '#4a9eff' }} />
      <Typography variant="body1" className="bare-modal__loading-caption">
        {caption}
      </Typography>
    </Box>
  </BareModal>
);
