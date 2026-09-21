import { Avatar, Box, LinearProgress, Paper, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import type { Player } from '../services/api';
import './PlayerStats.scss';

// Placeholder served from `public/images/avatars/` (Vite base is `/triple-triad/`).
const AVATAR_PLACEHOLDER = '/triple-triad/images/avatars/placeholder.svg';

// The level curve is derived on the client so the backend only stores raw XP.
const LEVEL_STEP = 100;
const levelForXp = (xp: number): number => Math.floor(xp / LEVEL_STEP) + 1;
const xpIntoLevel = (xp: number): number => xp % LEVEL_STEP;

export type PlayerStatsVariant = 'card' | 'sidebar' | 'compact';

interface PlayerStatsProps {
  player: Player | null;
  variant?: PlayerStatsVariant;
  className?: string;
}

const AvatarBadge: React.FC<{ player: Player; size: number }> = ({ player, size }) => (
  <Avatar
    src={player.avatarUrl || AVATAR_PLACEHOLDER}
    alt={`${player.login}'s avatar`}
    className="player-stats__avatar"
    sx={{ width: size, height: size }}
  >
    <PersonIcon sx={{ fontSize: size * 0.6 }} />
  </Avatar>
);

const CoinsPill: React.FC<{ coins: number }> = ({ coins }) => (
  <Box className="player-stats__coins">
    <span className="player-stats__coin-icon" aria-hidden="true">
      🪙
    </span>
    <span className="player-stats__coin-value">{coins.toLocaleString()}</span>
  </Box>
);

/**
 * One countable good as a link pill: the card count opens My Cards and the pack count opens My Packs, so every
 * screen that already shows the profile is also an entry point to those pages. Styled as a button (hover lift,
 * pointer, focus ring) because that is exactly what it is.
 */
const GoodsPill: React.FC<{ icon: string; value: number; label: string; to: string }> = ({
  icon,
  value,
  label,
  to,
}) => {
  const navigate = useNavigate();

  return (
    <Box
      component="button"
      type="button"
      className={`player-stats__goods player-stats__goods--${label}`}
      onClick={() => navigate(to)}
      aria-label={`${value.toLocaleString()} ${label} — open my ${label}`}
      title={`Go to my ${label}`}
    >
      <span className="player-stats__goods-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="player-stats__goods-value">{value.toLocaleString()}</span>
    </Box>
  );
};

/**
 * The two goods pills, driven by the counts the profile reports. A profile cached in `localStorage` before those
 * fields existed reads 0 until the next refresh rather than rendering `undefined`.
 */
const GoodsRow: React.FC<{ player: Player }> = ({ player }) => (
  <Box className="player-stats__goods-row">
    <GoodsPill icon="🃏" value={player.cardsOwned ?? 0} label="cards" to="/cards" />
    <GoodsPill icon="🎁" value={player.packsOwned ?? 0} label="packs" to="/packs" />
  </Box>
);

const XpBlock: React.FC<{ player: Player }> = ({ player }) => {
  const level = levelForXp(player.experience);
  const into = xpIntoLevel(player.experience);
  const percent = Math.round((into / LEVEL_STEP) * 100);

  return (
    <Box className="player-stats__xp-block">
      <Typography variant="body2" className="player-stats__level">
        Lv {level} · {into}/{LEVEL_STEP} XP
      </Typography>
      <LinearProgress
        variant="determinate"
        value={percent}
        className="player-stats__xp-bar"
        sx={{
          height: 8,
          borderRadius: 999,
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          '& .MuiLinearProgress-bar': {
            background: 'linear-gradient(90deg, #0078ff, #4a9eff)',
            borderRadius: 999,
          },
        }}
      />
    </Box>
  );
};

const StatTiles: React.FC<{ player: Player }> = ({ player }) => (
  <Box className="player-stats__tiles">
    <Box className="player-stats__tile player-stats__tile--wins">
      <span className="player-stats__tile-value">{player.wins}</span>
      <span className="player-stats__tile-label">Wins</span>
    </Box>
    <Box className="player-stats__tile player-stats__tile--losses">
      <span className="player-stats__tile-value">{player.losses}</span>
      <span className="player-stats__tile-label">Losses</span>
    </Box>
    <Box className="player-stats__tile player-stats__tile--ties">
      <span className="player-stats__tile-value">{player.ties}</span>
      <span className="player-stats__tile-label">Ties</span>
    </Box>
  </Box>
);

const RecordRows: React.FC<{ player: Player }> = ({ player }) => (
  <Box className="player-stats__record">
    <Box className="player-stats__record-row">
      <span className="player-stats__record-label player-stats__record-label--wins">Wins</span>
      <span className="player-stats__record-value">{player.wins}</span>
    </Box>
    <Box className="player-stats__record-row">
      <span className="player-stats__record-label player-stats__record-label--losses">Losses</span>
      <span className="player-stats__record-value">{player.losses}</span>
    </Box>
    <Box className="player-stats__record-row">
      <span className="player-stats__record-label player-stats__record-label--ties">Ties</span>
      <span className="player-stats__record-value">{player.ties}</span>
    </Box>
  </Box>
);

/**
 * Player profile stats (avatar, name, coins, XP and W/L/T).
 * - `card`    → mobile: profile hero + a row of stat tiles.
 * - `sidebar` → desktop: vertical panel (avatar, coins, XP, stacked record).
 * - `compact` → drawer: avatar + name + coins inline.
 */
export const PlayerStats: React.FC<PlayerStatsProps> = ({
  player,
  variant = 'card',
  className = '',
}) => {
  if (!player) {
    return null;
  }

  const rootClass = `player-stats player-stats--${variant} ${className}`.trim();

  if (variant === 'compact') {
    return (
      <Box className={rootClass}>
        <AvatarBadge player={player} size={32} />
        <Box className="player-stats__compact-info">
          <span className="player-stats__compact-name">{player.login}</span>
          <Box className="player-stats__compact-pills">
            <CoinsPill coins={player.coins} />
            <GoodsRow player={player} />
          </Box>
        </Box>
      </Box>
    );
  }

  if (variant === 'sidebar') {
    return (
      <Paper elevation={3} className={rootClass}>
        <AvatarBadge player={player} size={96} />
        <Typography variant="h6" className="player-stats__name">
          {player.login}
        </Typography>
        <CoinsPill coins={player.coins} />
        <GoodsRow player={player} />
        <XpBlock player={player} />
        <RecordRows player={player} />
      </Paper>
    );
  }

  return (
    <Paper elevation={3} className={rootClass}>
      <Box className="player-stats__hero">
        <AvatarBadge player={player} size={64} />
        <Box className="player-stats__identity">
          <Typography variant="h6" className="player-stats__name">
            {player.login}
          </Typography>
          <XpBlock player={player} />
        </Box>
        <CoinsPill coins={player.coins} />
      </Box>
      <GoodsRow player={player} />
      <StatTiles player={player} />
    </Paper>
  );
};
