import { useState } from 'react';
import { Avatar, Box, Button, CircularProgress, Container, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { FiSearch, FiUsers } from 'react-icons/fi';
import { FriendActionsDialog } from '../components/FriendActionsDialog';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { RemoveFriendConfirmModal } from '../components/RemoveFriendConfirmModal';
import { avatarUrlFor } from '../data/Avatar';
import { useFriends } from '../hooks/useFriends';
import type { FriendSummary } from '../services/api';
import './Social.scss';

/** Alphabetically and case-insensitively: the server sorts logins ordinally, which is not how a name reads. */
const byLogin = (a: FriendSummary, b: FriendSummary) =>
  a.login.localeCompare(b.login, undefined, { sensitivity: 'base' });

/**
 * Social: the friends list (`plans/PLAN-023-social-friends-list/plan.md` §3.4) — everybody the signed-in player has
 * agreed to be friends with, split by whether they are online **right now**, each one a button that opens their
 * actions.
 *
 * It owns three pieces of flow state and nothing else: which friend is having their actions opened, whose profile is
 * being shown, and which removal is waiting for confirmation. The list, its loading state and its errors belong to
 * `useFriends`; the dialogs belong to their own components. Two things are deliberate:
 *  - the action sheet is handed the friend **looked up from the list by login**, so a presence change that lands while
 *    it is open is reflected in it (a friend going offline disables *Challenge* under the player's eyes);
 *  - *View profile* and *Remove friend* close that sheet as they open their own, so only one dialog is ever on screen.
 */
export const Social: React.FC = () => {
  const { friends, isLoading, error, refresh, remove } = useFriends();
  const [actionsLogin, setActionsLogin] = useState<string | null>(null);
  const [profileLogin, setProfileLogin] = useState<string | null>(null);
  const [removeLogin, setRemoveLogin] = useState<string | null>(null);

  const online = friends.filter(friend => friend.online).sort(byLogin);
  const offline = friends.filter(friend => !friend.online).sort(byLogin);
  const actionsFriend = friends.find(friend => friend.login === actionsLogin) ?? null;

  /** One section, or nothing at all when it is empty — an "Online (0)" heading costs a screen and says nothing. */
  const section = (title: string, rows: FriendSummary[]) =>
    rows.length === 0 ? null : (
      <Box className="social-section">
        <Typography variant="h6" className="social-section__title">
          {title} ({rows.length})
        </Typography>
        <Box className="social-section__list">
          {rows.map(friend => (
            <button
              key={friend.login}
              type="button"
              className="social-friend"
              onClick={() => setActionsLogin(friend.login)}
              // The dot is decoration; the state is in the accessible name, which is all a screen reader gets.
              aria-label={`${friend.login}, ${friend.online ? 'online' : 'offline'}`}
            >
              <Avatar src={avatarUrlFor(friend.avatarUrl)} alt="" className="social-friend__avatar">
                <PersonIcon className="social-friend__avatar-fallback" />
              </Avatar>
              <span className="social-friend__login">{friend.login}</span>
              <span
                className={`social-friend__dot${friend.online ? ' social-friend__dot--online' : ''}`}
                aria-hidden="true"
              />
            </button>
          ))}
        </Box>
      </Box>
    );

  return (
    <Box className="social app-chrome-page">
      <Container className="social-container">
        <Box className="social-content">
          <Typography variant="h4" className="social-title">
            <FiUsers className="page-title-icon" aria-hidden="true" /> Social
          </Typography>
          <Typography variant="body1" className="social-subtitle">
            Your friends, and who is around right now
          </Typography>

          {/* The search is a future plan: disabled *and* explained, so it does not read as broken. */}
          <Button
            className="social-search"
            variant="outlined"
            startIcon={<FiSearch />}
            disabled
            title="Coming in a future plan"
          >
            Search Player
          </Button>

          {isLoading && (
            <Box className="social-waiting">
              <CircularProgress className="social-waiting__spinner" />
            </Box>
          )}

          {!isLoading && error && (
            <Box className="social-error">
              <Typography variant="body2" className="social-error__message">
                {error}
              </Typography>
              <Button variant="contained" onClick={() => void refresh()}>
                Try again
              </Button>
            </Box>
          )}

          {!isLoading && !error && friends.length === 0 && (
            <Typography variant="body2" className="social-empty">
              No friends yet — add one from an opponent&rsquo;s profile in a duel.
            </Typography>
          )}

          {!isLoading && !error && friends.length > 0 && (
            <Box className="social-friends">
              {section('Online', online)}
              {section('Offline', offline)}
            </Box>
          )}
        </Box>
      </Container>

      <FriendActionsDialog
        open={actionsFriend !== null}
        friend={actionsFriend}
        onViewProfile={login => {
          setActionsLogin(null);
          setProfileLogin(login);
        }}
        onChallenge={() => undefined}
        onRemove={login => {
          setActionsLogin(null);
          setRemoveLogin(login);
        }}
        onClose={() => setActionsLogin(null)}
      />

      <RemoveFriendConfirmModal
        login={removeLogin}
        onCancel={() => setRemoveLogin(null)}
        onConfirm={async login => {
          await remove(login);
          setRemoveLogin(null);
        }}
      />

      <PlayerProfileModal
        open={profileLogin !== null}
        login={profileLogin ?? ''}
        onClose={() => setProfileLogin(null)}
      />
    </Box>
  );
};
