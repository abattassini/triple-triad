import { Avatar, Box, LinearProgress, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { FiCreditCard } from 'react-icons/fi';
import { avatarUrlFor } from '../data/Avatar';
import { LEVEL_STEP, levelForXp, xpIntoLevel } from '../data/Levels';
import type { OpponentProfile } from '../services/api';
import './PlayerProfile.scss';

interface PlayerProfileProps {
  profile: OpponentProfile;
  className?: string;
  /**
   * An optional node under the record — where the panel's *action* goes. The panel itself stays inert
   * (`plans/PLAN-022-notifications-and-friends/plan.md` §3.5): it knows nothing about friends, calls and buttons, and
   * whoever owns the dialog decides what, if anything, may be done from here (`PlayerProfileModal` passes the friend
   * button; the chrome's own profile passes nothing).
   */
  action?: React.ReactNode;
}

/**
 * Another player's public profile as a panel: avatar, name, level, and the record — the cards they own, wins, losses
 * and ties.
 *
 * It is deliberately inert. **No `BareModal`, no fetch, no navigation**: it is handed an `OpponentProfile` and draws
 * it, so it can be put anywhere. Today that is `PlayerProfileModal` on the match page, which is what owns the dialog
 * and knows where the data comes from (`plans/PLAN-020-opponent-profile/plan.md` §3.1). The card figure is a figure
 * and not a link, on purpose: a cards pill on someone else's profile would open *my* collection, which is what
 * `PlayerStats`' pills mean and what this panel must never mean.
 *
 * The level is drawn exactly the way the stats panel draws it — `Lv N · x/100 XP` over a bar — so the same number cannot
 * look like two different things on two screens. That XP line is the one field here the request did not name
 * (plan §5 D5).
 */
export const PlayerProfile: React.FC<PlayerProfileProps> = ({
  profile,
  className = '',
  action,
}) => {
  const level = levelForXp(profile.experience);
  const into = xpIntoLevel(profile.experience);

  return (
    <Box className={`player-profile ${className}`.trim()}>
      <Avatar
        src={avatarUrlFor(profile.avatarUrl)}
        alt={`${profile.login}'s avatar`}
        className="player-profile__avatar"
        sx={{ width: 96, height: 96 }}
      >
        <PersonIcon sx={{ fontSize: 58 }} />
      </Avatar>

      <Typography variant="h6" className="player-profile__name">
        {profile.login}
      </Typography>

      <Box className="player-profile__level">
        <Typography variant="body2" className="player-profile__level-label">
          Lv {level} · {into}/{LEVEL_STEP} XP
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.round((into / LEVEL_STEP) * 100)}
          className="player-profile__level-bar"
        />
      </Box>

      <Box className="player-profile__cards">
        <span className="player-profile__cards-icon" aria-hidden="true">
          <FiCreditCard />
        </span>
        <span className="player-profile__cards-value">
          {profile.cardsOwned === null ? '??' : profile.cardsOwned.toLocaleString()}
        </span>
        <span className="player-profile__cards-label">
          {profile.cardsOwned === null
            ? 'cards'
            : profile.cardsOwned === 1
              ? 'card owned'
              : 'cards owned'}
        </span>
      </Box>

      <Box className="player-profile__record">
        <Box className="player-profile__tile player-profile__tile--wins">
          <span className="player-profile__tile-value">{profile.wins}</span>
          <span className="player-profile__tile-label">Wins</span>
        </Box>
        <Box className="player-profile__tile player-profile__tile--losses">
          <span className="player-profile__tile-value">{profile.losses}</span>
          <span className="player-profile__tile-label">Losses</span>
        </Box>
        <Box className="player-profile__tile player-profile__tile--ties">
          <span className="player-profile__tile-value">{profile.ties}</span>
          <span className="player-profile__tile-label">Ties</span>
        </Box>
      </Box>

      {/* Whatever the dialog's owner allows from here — the friend button, on the opponent panel. The panel does not
          look inside it, which is what keeps it usable anywhere (§3.5). */}
      {action && <Box className="player-profile__action">{action}</Box>}
    </Box>
  );
};
