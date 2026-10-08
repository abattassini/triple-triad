import { useCallback, useEffect, useState } from 'react';
import { Avatar, Box, Button, CircularProgress, Container, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { FiRefreshCw, FiUsers } from 'react-icons/fi';
import { apiService, type OnlinePlayerSummary } from '../services/api';
import { avatarUrlFor } from '../data/Avatar';
import './OnlinePlayers.scss';

/**
 * The operators' online roster (`plans/PLAN-026-player-search-and-online-page/plan.md` §3.4): everyone logged in right
 * now — the humans the server sees on a live connection and the bots its emulated presence reports — as a read-only
 * list.
 *
 * It is deliberately URL-only and guarded: `AppLayout`'s `PrivilegedRoute` sends anyone but `batta`/`argel` to `/home`,
 * and the endpoint behind it answers `403` to the same people. There is no nav entry anywhere.
 *
 * Freshness is a mount read plus a manual **Refresh**, not a push (D8): the roster is a diagnostic, not something a
 * presence change has to repaint live.
 */
export const OnlinePlayers: React.FC = () => {
  const [players, setPlayers] = useState<OnlinePlayerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const answer = await apiService.getOnlinePlayers();
      setPlayers(answer.players);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load the online roster.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Box className="online-roster app-chrome-page">
      <Container className="online-roster-container">
        <Box className="online-roster__content">
          <Typography variant="h4" className="online-roster__title">
            <FiUsers className="page-title-icon" aria-hidden="true" /> Online players
          </Typography>
          <Typography variant="body1" className="online-roster__subtitle">
            Everyone logged in right now — humans and bots
          </Typography>

          <Button
            className="online-roster__refresh"
            variant="outlined"
            startIcon={<FiRefreshCw />}
            onClick={() => void refresh()}
            disabled={isLoading}
          >
            Refresh
          </Button>

          {isLoading && players.length === 0 && (
            <Box className="online-roster__waiting">
              <CircularProgress className="online-roster__spinner" />
            </Box>
          )}

          {!isLoading && error && (
            <Box className="online-roster__error">
              <Typography variant="body2" className="online-roster__error-message">
                {error}
              </Typography>
              <Button variant="contained" onClick={() => void refresh()}>
                Try again
              </Button>
            </Box>
          )}

          {!isLoading && !error && players.length === 0 && (
            <Typography variant="body2" className="online-roster__empty">
              Nobody is online right now.
            </Typography>
          )}

          {!error && players.length > 0 && (
            <Box className="online-roster__list">
              <Typography variant="h6" className="online-roster__count">
                Online now ({players.length})
              </Typography>
              {players.map(player => (
                <div key={player.login} className="online-roster__row">
                  <Avatar
                    src={avatarUrlFor(player.avatarUrl)}
                    alt=""
                    className="online-roster__avatar"
                  >
                    <PersonIcon className="online-roster__avatar-fallback" />
                  </Avatar>
                  <span className="online-roster__login">{player.login}</span>
                  {player.isBot && <span className="online-roster__bot">BOT</span>}
                  <span className="online-roster__dot" aria-hidden="true" />
                </div>
              ))}
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
};
