import { useState } from 'react';
import {
  Autocomplete,
  Avatar,
  Box,
  Container,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { FiSearch, FiUsers } from 'react-icons/fi';
import { FriendsList } from '../components/FriendsList';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { avatarUrlFor } from '../data/Avatar';
import { MIN_SEARCH_LENGTH, usePlayerSearch } from '../hooks/usePlayerSearch';
import './Social.scss';

/**
 * Social: the player lookup and the friends list (`plans/PLAN-023-social-friends-list/plan.md` §3.4,
 * `plans/PLAN-028-challenge-rules-and-friend-list/plan.md` §3.4). The list itself — its Online/Offline sections, its
 * states and the *View profile / Challenge to a match / Remove friend / Cancel* sheet — is the shared `FriendsList`,
 * which Play's *Challenge a Friend* modal renders too.
 *
 * This page keeps only what is Social's own: the lookup query and its dropdown state. Picking a search result opens
 * *that player's* profile panel here, which is where *Add friend* lives; the friends' own actions belong to
 * `FriendsList`.
 */
export const Social: React.FC = () => {
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
  // A search result opens *that player's* profile — *Add friend* lives there — which is separate from the friends'
  // own action sheet inside `FriendsList`.
  const [profileLogin, setProfileLogin] = useState<string | null>(null);

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

          {/* The friends list, and the action sheet it opens — the same component Play's Challenge a Friend modal
              renders (§3.4), so the two surfaces cannot behave differently. */}
          <FriendsList />
        </Box>
      </Container>

      {/* Only the lookup's profile panel: the friends' action sheet, remove confirm and profile live inside
          `FriendsList`. Picking a search result opens *that player's* panel, which is where *Add friend* lives. */}
      <PlayerProfileModal
        open={profileLogin !== null}
        login={profileLogin ?? ''}
        onClose={() => setProfileLogin(null)}
      />
    </Box>
  );
};
