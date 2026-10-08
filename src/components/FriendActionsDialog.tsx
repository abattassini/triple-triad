import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Fade,
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { FiPlayCircle, FiUser, FiUserMinus } from 'react-icons/fi';
import { avatarUrlFor } from '../data/Avatar';
import type { FriendSummary } from '../services/api';
import './FriendActionsDialog.scss';

interface FriendActionsDialogProps {
  open: boolean;
  /**
   * Whose actions these are — the **row from the list**, not a copy taken when it was clicked, so a presence change
   * that lands while this is open reaches the Challenge button
   * (`plans/PLAN-023-social-friends-list/plan.md` §3.5).
   */
  friend: FriendSummary | null;
  onViewProfile: (login: string) => void;
  /** Sends the invitation; the wait, the answer and the dialogs belong to `ChallengesProvider` (§3.9). */
  onChallenge: (login: string) => void;
  onRemove: (login: string) => void;
  onClose: () => void;
}

/**
 * The three things you can do about a friend, as a MUI `Dialog` — a shell of its own rather than a `BareModal`
 * consumer, because an action sheet brings its own surface, title and buttons
 * (`plans/PLAN-023-social-friends-list/plan.md` §3.5, §5 D2).
 *
 * What it inherits from the house and what it deliberately does not re-implement:
 *  - MUI's **default z-index** (1300) is above the chrome's 1100, so this darkens and blocks the chrome with no
 *    coordination — the same contract `BareModal` relies on. Nothing sets an inline z-index, so a dialog opened from
 *    here (the profile, the confirm) paints above it and `ModalManager` keeps this one out of the accessibility tree.
 *  - The **paper is the app's own panel** (`slotProps.paper.sx`), not the theme's flat Paper, so it matches
 *    `PlayerProfile` and the inbox instead of looking like another application.
 *  - **Esc, the backdrop and the focus trap** are MUI's, and the content is what scrolls on a short screen — a long
 *    login or a phone in landscape must not push *Cancel* off the bottom.
 */
export const FriendActionsDialog: React.FC<FriendActionsDialogProps> = ({
  open,
  friend,
  onViewProfile,
  onChallenge,
  onRemove,
  onClose,
}) => {
  // Nothing to act on, and nothing to draw: the page keeps this mounted and hands it the selected row.
  if (!open || !friend) {
    return null;
  }

  return (
    <Dialog
      open
      onClose={onClose}
      slots={{ transition: Fade }}
      aria-label={`Actions for ${friend.login}`}
      slotProps={{
        paper: {
          className: 'friend-actions__paper',
          sx: {
            width: 'min(360px, calc(100vw - 64px))',
            maxHeight: 'calc(100dvh - 64px)',
            margin: 0,
            color: '#fff',
            background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
            border: '2px solid #3a3a5e',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          },
        },
      }}
    >
      <DialogTitle className="friend-actions__head">
        <Avatar
          src={avatarUrlFor(friend.avatarUrl)}
          alt={`${friend.login}'s avatar`}
          className="friend-actions__avatar"
        >
          <PersonIcon className="friend-actions__avatar-fallback" />
        </Avatar>
        <Box className="friend-actions__identity">
          <Typography variant="h6" className="friend-actions__name">
            {friend.login}
          </Typography>
          <Typography
            variant="body2"
            className={`friend-actions__presence${
              friend.online ? ' friend-actions__presence--online' : ''
            }`}
          >
            {friend.online ? 'Online now' : 'Offline'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent className="friend-actions__options">
        <Button
          className="friend-actions__option"
          variant="outlined"
          startIcon={<FiUser />}
          onClick={() => onViewProfile(friend.login)}
        >
          <span className="friend-actions__label">View profile</span>
        </Button>

        <Button
          className="friend-actions__option"
          variant="outlined"
          startIcon={<FiPlayCircle />}
          disabled={!friend.online}
          onClick={() => onChallenge(friend.login)}
        >
          <span className="friend-actions__label">Challenge to a match</span>
        </Button>

        <Button
          className="friend-actions__option friend-actions__option--danger"
          variant="outlined"
          startIcon={<FiUserMinus />}
          onClick={() => onRemove(friend.login)}
        >
          <span className="friend-actions__label">Remove friend</span>
        </Button>
      </DialogContent>

      <Box className="friend-actions__cancel">
        <Button variant="text" onClick={onClose}>
          Cancel
        </Button>
      </Box>
    </Dialog>
  );
};
