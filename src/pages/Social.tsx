import { useState } from 'react';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { FiSearch, FiUsers } from 'react-icons/fi';
import { FriendActionsDialog } from '../components/FriendActionsDialog';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { RemoveFriendConfirmModal } from '../components/RemoveFriendConfirmModal';
import { avatarUrlFor } from '../data/Avatar';
import { useFriends } from '../hooks/useFriends';
import { MIN_SEARCH_LENGTH, usePlayerSearch } from '../hooks/usePlayerSearch';
import { useChallenges } from '../contexts/ChallengesContext';
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
 * It owns the player-lookup query plus three pieces of flow state, and nothing else: which friend is having their
 * actions opened, whose profile is being shown, and which removal is waiting for confirmation. The friends list, its
 * loading state and its errors belong to `useFriends`; the search results belong to `usePlayerSearch`; the dialogs
 * belong to their own components. Two things are deliberate:
 *  - the action sheet is handed the friend **looked up from the list by login**, so a presence change that lands while
 *    it is open is reflected in it (a friend going offline disables *Challenge* under the player's eyes);
 *  - *View profile* and *Remove friend* close that sheet as they open their own, so only one dialog is ever on screen.
 */
export const Social: React.FC = () => {
  const { friends, isLoading, error, refresh, remove } = useFriends();
  // Challenging a friend is the provider's business: it owns the wait, the answer and the dialog each opens.
  const { challenge } = useChallenges();
  // The player lookup (§3.3, §10): the box's text is owned here and the results by the hook. `isLookupDismissed` is the
  // only piece of dropdown state — whether the user closed it (Esc / click-away) — because `isLookupOpen` is derived
  // from it and the query (§13).
  const [searchQuery, setSearchQuery] = useState('');
  const [isLookupDismissed, setIsLookupDismissed] = useState(false);
  const {
    results: searchResults,
    isLoading: isSearching,
    error: searchError,
  } = usePlayerSearch(searchQuery);

  // Open exactly while there is something to look up and the dropdown has not been dismissed. Deriving it from
  // `searchQuery` (rather than setting a boolean in the handlers) is what fixes the one-character case: an `onOpen` that
  // read the query could only ever see the *previous* render's value, so the first keystroke closed the popup it had
  // just been asked to open.
  const isLookupOpen = searchQuery.trim().length >= MIN_SEARCH_LENGTH && !isLookupDismissed;
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

          {/* The player lookup (`plans/PLAN-026-player-search-and-online-page/plan.md` §3.3, §10): a MUI
              `Autocomplete` used as a lookup — type a name and the matching players (bots included) drop down as you
              type; picking one opens *their* profile panel, which is where *Add friend* lives. The server does the
              matching, so the client's own filter is off and the box only asks once the query is long enough. */}
          <Box className="social-search">
            <Autocomplete
              fullWidth
              options={searchResults}
              value={null}
              inputValue={searchQuery}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input' || reason === 'clear') {
                  setSearchQuery(value);
                  setIsLookupDismissed(false);
                }
              }}
              onChange={(_event, player) => {
                if (player) {
                  setProfileLogin(player.login);
                  setSearchQuery('');
                }
              }}
              // The server already filtered and its answer is the truth; filtering again on the client would only
              // hide rows it deliberately returned.
              filterOptions={options => options}
              getOptionLabel={player => player.login}
              open={isLookupOpen}
              onOpen={() => setIsLookupDismissed(false)}
              onClose={() => setIsLookupDismissed(true)}
              loading={isSearching}
              loadingText="Searching…"
              noOptionsText={`No players match “${searchQuery.trim()}”.`}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Search players"
                  placeholder="Type a player's name"
                  className="social-search__field"
                  // Keep the label floated so the placeholder is visible in the empty box, not only on focus.
                  InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <FiSearch aria-hidden="true" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              renderOption={(props, player) => {
                const { key, className, ...optionProps } = props;
                return (
                  <li
                    key={key}
                    className={`${className ?? ''} social-search__option`.trim()}
                    {...optionProps}
                  >
                    <Avatar
                      src={avatarUrlFor(player.avatarUrl)}
                      alt=""
                      className="social-search__option-avatar"
                    >
                      <PersonIcon className="social-search__option-avatar-fallback" />
                    </Avatar>
                    <span className="social-search__option-login">{player.login}</span>
                    <span
                      className={`social-search__option-dot${
                        player.online ? ' social-search__option-dot--online' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </li>
                );
              }}
              slotProps={{ paper: { className: 'social-search__paper' } }}
            />

            {searchError && (
              <Typography variant="body2" className="social-search__error">
                {searchError}
              </Typography>
            )}
          </Box>

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
              No friends yet — search for a player above, or add one from an opponent&rsquo;s
              profile in a duel.
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
        onChallenge={login => {
          // The dialog closes: the wait for an answer has its own modal, owned by `ChallengesProvider` (§3.9).
          setActionsLogin(null);
          void challenge(login);
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
    </Box>
  );
};
