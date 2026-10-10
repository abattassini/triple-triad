import { useState } from 'react';
import { Avatar, Box, Button, CircularProgress, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { FriendActionsDialog } from './FriendActionsDialog';
import { PlayerProfileModal } from './PlayerProfileModal';
import { RemoveFriendConfirmModal } from './RemoveFriendConfirmModal';
import { avatarUrlFor } from '../data/Avatar';
import { useFriends } from '../hooks/useFriends';
import { useChallenges } from '../contexts/ChallengesContext';
import type { FriendSummary } from '../services/api';
import './FriendsList.scss';

/** Alphabetically and case-insensitively: the server sorts logins ordinally, which is not how a name reads. */
const byLogin = (a: FriendSummary, b: FriendSummary) =>
  a.login.localeCompare(b.login, undefined, { sensitivity: 'base' });

interface FriendsListProps {
  /**
   * Called right after a challenge is handed to `ChallengesProvider`, which is about to open the rule choice. A host
   * that wrapped the list in its own container (Play's modal, `plans/PLAN-028-challenge-rules-and-friend-list/plan.md`
   * §3.4 D6) closes it here so the two dialogs do not stack; Social omits the prop.
   */
  onChallengeStarted?: () => void;
}

/**
 * The friends list, and the four things you can do about a friend — *View profile*, *Challenge to a match*, *Remove
 * friend* and *Cancel* — in one component (`plans/PLAN-028-challenge-rules-and-friend-list/plan.md` §3.4). Social
 * renders it under its player search and Play renders it inside the *Challenge a Friend* modal, so the two surfaces
 * cannot behave differently.
 *
 * It owns the list's data (`useFriends`), its loading/error/empty states, and the three dialogs the actions open. The
 * action sheet is handed the friend **looked up from the list by login**, so a presence change that lands while it is
 * open is reflected in it (a friend going offline disables *Challenge* under the player's eyes); *View profile* and
 * *Remove friend* close that sheet as they open their own, so only one dialog is ever on screen.
 */
export const FriendsList: React.FC<FriendsListProps> = ({ onChallengeStarted }) => {
  const { friends, isLoading, error, refresh, remove } = useFriends();
  // Challenging a friend is the provider's business: it owns the rule choice, the wait, the answer and the dialogs.
  const { challenge } = useChallenges();
  const [actionsLogin, setActionsLogin] = useState<string | null>(null);
  const [profileLogin, setProfileLogin] = useState<string | null>(null);
  const [removeLogin, setRemoveLogin] = useState<string | null>(null);

  const online = friends.filter(friend => friend.online).sort(byLogin);
  const offline = friends.filter(friend => !friend.online).sort(byLogin);
  const actionsFriend = friends.find(friend => friend.login === actionsLogin) ?? null;

  /** One section, or nothing at all when it is empty — an "Online (0)" heading costs a screen and says nothing. */
  const section = (title: string, rows: FriendSummary[]) =>
    rows.length === 0 ? null : (
      <Box className="friends-list__section">
        <Typography variant="h6" className="friends-list__section-title">
          {title} ({rows.length})
        </Typography>
        <Box className="friends-list__section-list">
          {rows.map(friend => (
            <button
              key={friend.login}
              type="button"
              className="friends-list__friend"
              onClick={() => setActionsLogin(friend.login)}
              // The dot is decoration; the state is in the accessible name, which is all a screen reader gets.
              aria-label={`${friend.login}, ${friend.online ? 'online' : 'offline'}`}
            >
              <Avatar
                src={avatarUrlFor(friend.avatarUrl)}
                alt=""
                className="friends-list__friend-avatar"
              >
                <PersonIcon className="friends-list__friend-avatar-fallback" />
              </Avatar>
              <span className="friends-list__friend-login">{friend.login}</span>
              <span
                className={`friends-list__friend-dot${
                  friend.online ? ' friends-list__friend-dot--online' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          ))}
        </Box>
      </Box>
    );

  return (
    <>
      {isLoading && (
        <Box className="friends-list__waiting">
          <CircularProgress className="friends-list__waiting-spinner" />
        </Box>
      )}

      {!isLoading && error && (
        <Box className="friends-list__error">
          <Typography variant="body2" className="friends-list__error-message">
            {error}
          </Typography>
          <Button variant="contained" onClick={() => void refresh()}>
            Try again
          </Button>
        </Box>
      )}

      {!isLoading && !error && friends.length === 0 && (
        <Typography variant="body2" className="friends-list__empty">
          No friends yet — add one from an opponent&rsquo;s profile after a duel.
        </Typography>
      )}

      {!isLoading && !error && friends.length > 0 && (
        <Box className="friends-list">
          {section('Online', online)}
          {section('Offline', offline)}
        </Box>
      )}

      <FriendActionsDialog
        open={actionsFriend !== null}
        friend={actionsFriend}
        onViewProfile={login => {
          setActionsLogin(null);
          setProfileLogin(login);
        }}
        onChallenge={login => {
          // The sheet closes: the provider opens the rule choice and then its own waiting dialog (§3.3).
          setActionsLogin(null);
          onChallengeStarted?.();
          challenge(login);
        }}
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
    </>
  );
};
