import { Badge, IconButton } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '../contexts/NotificationsContext';
import './NotificationBell.scss';

interface NotificationBellProps {
  onClick: () => void;
}

/**
 * The bell: the app's one way into the inbox, and the only reason the chrome knows notifications exist
 * (`plans/PLAN-022-notifications-and-friends/plan.md` §3.5, §5 D5). It sits in the header's third column — the column
 * that was deliberately empty until now — so it is present on every signed-in page without disturbing the centred
 * title, which is a property `PLAN-021`'s review settled and this must not undo.
 *
 * It is a small, inert control on purpose: it shows a number and opens the panel. Every read, every push subscription
 * and every action lives in `NotificationsContext` and `NotificationPanel`, so nothing here can fall out of step with
 * them.
 */
export const NotificationBell: React.FC<NotificationBellProps> = ({ onClick }) => {
  const { unreadCount } = useNotifications();

  const label = unreadCount === 0 ? 'Notifications' : `Notifications, ${unreadCount} unread`;

  return (
    <IconButton
      className="notification-bell"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
    >
      {/* Coloured the way MUI colours an error badge, and hidden entirely at zero: a badge showing "0" is noise. */}
      <Badge
        badgeContent={unreadCount}
        color="error"
        max={99}
        invisible={unreadCount === 0}
        overlap="circular"
        className="notification-bell__badge"
      >
        <NotificationsIcon className="notification-bell__icon" />
      </Badge>
    </IconButton>
  );
};
