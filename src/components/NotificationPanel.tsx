import { useEffect, useState } from 'react';
import { Avatar, Box, Button, CircularProgress, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { BareModal } from './BareModal';
import { avatarUrlFor } from '../data/Avatar';
import {
  apiService,
  FRIEND_ACCEPTED_TYPE,
  FRIEND_REQUEST_TYPE,
  MATCH_CHALLENGE_TYPE,
  type GameNotification,
} from '../services/api';
import { useNotifications } from '../contexts/NotificationsContext';
import { useChallenges } from '../contexts/ChallengesContext';
import './NotificationPanel.scss';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * What a row says. One line per kind, and **a generic line for anything this build has never heard of** — which is the
 * whole point of the kind living on the server rather than in a client union (`plans/PLAN-022-notifications-and-friends`
 * §1.3): a kind added there renders here with no client change at all.
 */
const describe = (row: GameNotification): string => {
  switch (row.type) {
    case FRIEND_REQUEST_TYPE:
      return `${row.actorLogin} sent you a friend request`;
    case FRIEND_ACCEPTED_TYPE:
      return `${row.actorLogin} accepted your friend request`;
    case MATCH_CHALLENGE_TYPE:
      return `${row.actorLogin} challenged you to a match`;
    default:
      return `${row.actorLogin} sent you a notification`;
  }
};

/** When it happened, in the reader's own locale. An unparseable stamp says nothing rather than "Invalid Date". */
const whenLabel = (createdAt: string): string => {
  const when = new Date(createdAt);
  return Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/**
 * The inbox (`plans/PLAN-022-notifications-and-friends/plan.md` §3.5): the list, the Accept and Decline a request
 * carries, and *Mark all read* — in the shared `BareModal` shell, so the darkened page and the way out are the shell's
 * business and not this component's.
 *
 * Three things are deliberate:
 *  - **Every open re-reads.** The push is only a hint (§5 D6), so opening the panel is where a lost hint is made good;
 *    the read also stamps what is on screen, which is what the badge counts.
 *  - **Buttons follow `friendshipState`, not the row's age.** A request answered on another screen, or withdrawn,
 *    carries `friends` or `none` and shows no action.
 *  - **An answered request leaves the list.** The server stops *listing* a request once it has been answered or
 *    withdrawn, so acting here makes the row disappear on the re-read that follows — nothing in the client deletes
 *    anything, and the row itself survives in the database as the record (§3.4).
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({ open, onClose }) => {
  const { notifications, unreadCount, isLoading, error, refresh, markAllRead } = useNotifications();
  // Answering a challenge from here ends in the same place the dialog does: the Play page's picker (§3.9).
  const { accept } = useChallenges();
  const [busyLogin, setBusyLogin] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Accepts a challenge from its row. The panel closes first, because acceptance sends the player to `/play` and this
   * modal is mounted app-wide — leaving it open would cover the picker it just opened.
   */
  const acceptChallenge = async (matchId: number) => {
    setBusyId(matchId);
    setActionError(null);

    const accepted = await accept(matchId);

    if (accepted) {
      onClose();
    } else {
      setActionError('That challenge is no longer available.');
    }

    setBusyId(null);
  };

  /** Declines it. The row leaves the list on the re-read, because the server stops listing a challenge that is answered. */
  const refuseChallenge = async (matchId: number) => {
    setBusyId(matchId);
    setActionError(null);

    try {
      await apiService.refuseChallenge(matchId);
      await refresh();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'That did not work.');
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    setActionError(null);
    void refresh({ markVisibleRead: true });
  }, [open, refresh]);

  // Accepting and declining are the same call from here: the server's *ask* endpoint answers a mutual ask by accepting,
  // and its *remove* endpoint is a decline, a cancellation and an unfriending in one write. Afterwards the list is
  // re-read, so the row's new state — and with it the absence of these buttons — comes from the server.
  const act = async (login: string, action: 'accept' | 'decline') => {
    setBusyLogin(login);
    setActionError(null);

    try {
      if (action === 'accept') {
        await apiService.acceptFriend(login);
      } else {
        await apiService.removeFriend(login);
      }
      await refresh();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'That did not work.');
    } finally {
      setBusyLogin(null);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <BareModal open onClose={onClose} maxWidth="xs" ariaLabel="Notifications">
      <Box className="notification-panel">
        <Box className="notification-panel__head">
          <Typography component="h2" className="notification-panel__title">
            Notifications
          </Typography>
          <Button
            size="small"
            variant="text"
            className="notification-panel__read-all"
            disabled={unreadCount === 0}
            onClick={() => void markAllRead()}
          >
            Mark all read
          </Button>
        </Box>

        {actionError && (
          <Typography variant="body2" className="notification-panel__error">
            {actionError}
          </Typography>
        )}

        {/* One waiting state, and it only takes the panel over when there is nothing to show yet: a re-read behind an
            already-drawn list must not blank it out. */}
        {isLoading && notifications.length === 0 && (
          <Box className="notification-panel__waiting">
            <CircularProgress size={32} className="notification-panel__spinner" />
          </Box>
        )}

        {error && (
          <Typography variant="body2" className="notification-panel__error">
            {error}
          </Typography>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <Typography variant="body2" className="notification-panel__empty">
            Nothing here yet. Friend requests will land here.
          </Typography>
        )}

        {notifications.length > 0 && (
          <Box component="ul" className="notification-panel__list">
            {notifications.map(row => (
              <li
                key={row.id}
                className={`notification-panel__row${
                  row.readAt === null ? ' notification-panel__row--unread' : ''
                }`}
              >
                <Avatar
                  src={avatarUrlFor(row.actorAvatarUrl)}
                  alt={`${row.actorLogin}'s avatar`}
                  className="notification-panel__avatar"
                >
                  <PersonIcon />
                </Avatar>

                <Box className="notification-panel__body">
                  <Typography variant="body2" className="notification-panel__line">
                    {describe(row)}
                  </Typography>
                  <Typography
                    variant="caption"
                    className="notification-panel__when"
                    title={new Date(row.createdAt).toString()}
                  >
                    {whenLabel(row.createdAt)}
                  </Typography>

                  {/* A challenge is answerable while it is still `pending` — the server's stamp, not the row's age,
                      decides that, so one answered elsewhere shows no buttons (§3.6). */}
                  {row.type === MATCH_CHALLENGE_TYPE &&
                    row.challengeState === 'pending' &&
                    row.subjectId !== null && (
                      <Box className="notification-panel__actions">
                        <Button
                          size="small"
                          variant="contained"
                          disabled={busyId === row.subjectId}
                          onClick={() => void acceptChallenge(row.subjectId as number)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busyId === row.subjectId}
                          onClick={() => void refuseChallenge(row.subjectId as number)}
                        >
                          Refuse
                        </Button>
                      </Box>
                    )}

                  {/* A request that is still waiting for *this* player — the only kind that offers an action, and the
                      only request the server lists (§3.4). Acting on it takes the row out of the list on the re-read
                      below. */}
                  {row.friendshipState === 'incoming' && (
                    <Box className="notification-panel__actions">
                      <Button
                        size="small"
                        variant="contained"
                        disabled={busyLogin === row.actorLogin}
                        onClick={() => void act(row.actorLogin, 'accept')}
                      >
                        Accept
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={busyLogin === row.actorLogin}
                        onClick={() => void act(row.actorLogin, 'decline')}
                      >
                        Decline
                      </Button>
                    </Box>
                  )}
                </Box>
              </li>
            ))}
          </Box>
        )}

        <Button variant="contained" className="notification-panel__close" onClick={onClose}>
          Close
        </Button>
      </Box>
    </BareModal>
  );
};
