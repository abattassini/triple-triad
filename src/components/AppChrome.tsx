import { useState } from 'react';
import { Avatar, Box, Button, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiHome, FiPlayCircle, FiUsers } from 'react-icons/fi';
import { BareModal } from './BareModal';
import { NotificationBell } from './NotificationBell';
import { NotificationPanel } from './NotificationPanel';
import { PlayerStats } from './PlayerStats';
import { avatarUrlFor } from '../data/Avatar';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './AppChrome.scss';

// The three section pages, in the order the request asks for.
const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: FiHome },
  { to: '/play', label: 'Play', icon: FiPlayCircle },
  { to: '/social', label: 'Social', icon: FiUsers },
];

/**
 * The app chrome shared by every signed-in page except the match board: a **header** (the player's identity on the
 * left, the app's name centred, the notifications bell on the right) and a menu that is a **fixed footer** on phones
 * and a **left bar** on wider screens. The footer becomes the bar at 768px; at 1025px the bar widens and shows the
 * three labels beside doubled icons. The header itself is present at **every** width (`PLAN-021`'s review settled
 * that), and it is the only place the identity lives — the bar carries the nav alone.
 *
 * The chrome is `z-index: 1100`, deliberately **below** MUI's modal layer (`1300`), so any `BareModal` darkens it and
 * swallows its clicks exactly like the rest of the page — the modal never has to know the chrome exists.
 *
 * Tapping the identity opens the player's own profile in a `BareModal` (the shared `PlayerStats` card), which is also
 * where Sign Out lives: these pages no longer mount the hamburger drawer that used to own it.
 *
 * The header's **third column** holds the notifications bell — the one place in the app a player learns somebody asked
 * to be their friend (`plans/PLAN-022-notifications-and-friends/plan.md` §5 D5). It is the column that was empty, so
 * the centred title is untouched by it.
 */
export const AppChrome: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const login = user?.login ?? '';
  const avatarSrc = avatarUrlFor(user?.avatarUrl);
  const avatarAlt = login ? `${login}'s avatar` : 'Your avatar';

  const handleSignOut = () => {
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    // Give up any pending challenge first (§3.2 #5), while the token is still here to authenticate it: the call is
    // fire-and-forget, because a sign-out must not wait on the network.
    void apiService.expireChallenges();
    signOut();
    navigate('/');
  };

  const navLinks = NAV_ITEMS.map(({ to, label, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) =>
        `app-chrome__nav-item${isActive ? ' app-chrome__nav-item--active' : ''}`
      }
    >
      <span className="app-chrome__nav-icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="app-chrome__nav-label">{label}</span>
    </NavLink>
  ));

  const identity = (
    <button
      type="button"
      className="app-chrome__identity"
      onClick={() => setIsProfileOpen(true)}
      aria-haspopup="dialog"
      aria-label="Open your profile"
    >
      <Avatar src={avatarSrc} alt={avatarAlt} className="app-chrome__avatar">
        <PersonIcon className="app-chrome__avatar-fallback" />
      </Avatar>
      <span className="app-chrome__name">{login}</span>
    </button>
  );

  return (
    <>
      {/* The identity on the left, the app's name centred, the bell on the right — shown at every width. */}
      <header className="app-chrome__header">
        {identity}
        <Typography component="h1" className="app-chrome__title">
          Triple Triad
        </Typography>
        <div className="app-chrome__header-actions">
          <NotificationBell onClick={() => setIsNotificationsOpen(true)} />
        </div>
      </header>

      {/* Desktop: the same three entries as a bar on the left, below the header. */}
      <nav className="app-chrome__bar" aria-label="Sections">
        <Box className="app-chrome__nav">{navLinks}</Box>
      </nav>

      {/* Mobile: the footer. */}
      <nav className="app-chrome__footer" aria-label="Sections">
        {navLinks}
      </nav>

      <BareModal
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        maxWidth="xs"
        ariaLabel="Your profile"
      >
        <Box className="app-chrome__profile">
          <PlayerStats player={user} variant="card" />
          <Button
            variant="text"
            color="inherit"
            className="app-chrome__signout"
            startIcon={<LogoutIcon />}
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </Box>
      </BareModal>

      {/* The inbox, one dialog: opened by the bell and driven entirely by `NotificationsContext` (§3.5). */}
      <NotificationPanel open={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
    </>
  );
};
