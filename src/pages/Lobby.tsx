import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Container, Button, Paper } from '@mui/material';
import { BareModal } from '../components/BareModal';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { PlayerStats } from '../components/PlayerStats';
import { apiService, ALL_MATCH_RULES, type MatchRule } from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { useAuth } from '../contexts/AuthContext';
import './Lobby.scss';

/**
 * Whether two rule sets are the same rules, regardless of order: the backend sends them in enum order while the
 * client's constants may list them differently.
 */
const sameRuleSet = (left: MatchRule[], right: MatchRule[]): boolean =>
  left.length === right.length && left.every(rule => right.includes(rule));

export const Lobby: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const login = user?.login;
  const [isSearching, setIsSearching] = useState(false);
  // The rules the player is waiting with, so the searching state can name them.
  const [searchingRules, setSearchingRules] = useState<MatchRule[]>([]);
  // Whether the "how do you want to play?" modal is open.
  const [isChoosingRules, setIsChoosingRules] = useState(false);
  const { isConnected, on, off, joinMatch } = useSignalR();

  useEffect(() => {
    if (!login) {
      navigate('/');
      return;
    }
  }, [login, navigate]);

  // Pick up the latest coins/XP/W-L-T whenever the lobby is entered after a match.
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);
  useEffect(() => {
    if (!isConnected || !login) return; // Listen for match joined event (when second player joins)
    const handleMatchJoined = (...args: unknown[]) => {
      const data = args[0] as { matchId: number; status: string };
      console.log('Match joined:', data);
      if (data.status === 'active') {
        setIsSearching(false);
        navigate(`/match/${data.matchId}`);
      }
    };

    // Listen for errors
    const handleError = (...args: unknown[]) => {
      const message = args[0] as string;
      console.error('SignalR Error:', message);
      setIsSearching(false);
      alert(`Error: ${message}`);
    };

    on('MatchJoined', handleMatchJoined);
    on('Error', handleError);

    return () => {
      off('MatchJoined', handleMatchJoined);
      off('Error', handleError);
    };
  }, [isConnected, login, navigate, on, off]);

  const startMatch = async (rules: MatchRule[]) => {
    if (!login || !isConnected) {
      alert('Please wait for connection...');
      return;
    }

    // Close the choice first: from here the tile's searching state takes over.
    setIsChoosingRules(false);
    setSearchingRules(rules);
    setIsSearching(true);

    try {
      // Only a waiting match that plays by exactly these rules may be joined, so the option the player picked is
      // the match they get; a waiting match with other rules (or none) means starting our own.
      const waitingMatches = await apiService.getWaitingMatches();
      const compatible = waitingMatches.find(match => sameRuleSet(match.rules, rules));

      if (compatible) {
        const result = await apiService.joinMatch(compatible.id);

        // Join SignalR group, then go straight to the board.
        await joinMatch(result.match.id);

        navigate(`/match/${result.match.id}`);
        return;
      }

      // Nothing waiting with these rules: create one and stay in the searching state until the MatchJoined event.
      const result = await apiService.createMatch(undefined, rules);

      // Join SignalR group
      await joinMatch(result.match.id);

      console.log('Waiting for opponent...', result.match.id);
    } catch (error) {
      console.error('Quick match error:', error);
      setIsSearching(false);
      alert('Failed to start quick match: ' + (error as Error).message);
    }
  };
  const handleCancelSearch = () => {
    setIsSearching(false);
    // TODO: Call API to cancel/delete waiting match
  };

  if (!login) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box className="lobby-container">
      <HamburgerMenu />
      <Container className="lobby-content">
        <PlayerStats player={user} variant="card" className="lobby-stats-mobile" />

        <Typography variant="body1" className="lobby-subtitle">
          {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
        </Typography>

        <Box className="lobby-body">
          <PlayerStats player={user} variant="sidebar" className="lobby-stats-desktop" />

          <Box className="lobby-actions">
            <Paper elevation={3} sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2 }}>
              <Typography variant="h5" sx={{ color: '#4a9eff', mb: 1 }}>
                🎮 Quick Match
              </Typography>
              <Typography variant="body2" sx={{ color: '#ccc', mb: 2 }}>
                Join a match with a random opponent
              </Typography>

              {isSearching ? (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <CircularProgress sx={{ color: '#4a9eff' }} />
                  <Typography variant="body1" sx={{ mt: 2, color: '#fff' }}>
                    Searching for opponent...
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#4a9eff', mt: 1 }}>
                    {searchingRules.length > 0
                      ? `Rules: ${searchingRules.map(rule => rule.toUpperCase()).join(' · ')}`
                      : 'No special rules'}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleCancelSearch}
                    sx={{ mt: 2 }}
                  >
                    Cancel
                  </Button>
                </Box>
              ) : (
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={() => setIsChoosingRules(true)}
                  disabled={!isConnected}
                  sx={{
                    backgroundColor: '#4a9eff',
                    '&:hover': { backgroundColor: '#3a8eef' },
                  }}
                >
                  Quick Match
                </Button>
              )}
            </Paper>

            <Paper elevation={3} sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2 }}>
              <Typography variant="h5" sx={{ color: '#4a9eff', mb: 1 }}>
                🃏 My Cards
              </Typography>
              <Typography variant="body2" sx={{ color: '#ccc', mb: 2 }}>
                See the cards you own, grouped by level
              </Typography>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => navigate('/cards')}
                sx={{
                  backgroundColor: '#4a9eff',
                  '&:hover': { backgroundColor: '#3a8eef' },
                }}
              >
                My Cards
              </Button>
            </Paper>

            <Paper elevation={3} sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2 }}>
              <Typography variant="h5" sx={{ color: '#4a9eff', mb: 1 }}>
                🛒 Card Shop
              </Typography>
              <Typography variant="body2" sx={{ color: '#ccc', mb: 2 }}>
                Buy a 5-card pack for 1,500 coins
              </Typography>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => navigate('/shop')}
                sx={{
                  backgroundColor: '#4a9eff',
                  '&:hover': { backgroundColor: '#3a8eef' },
                }}
              >
                Open Shop
              </Button>
            </Paper>

            <Paper
              elevation={3}
              sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2, opacity: 0.6 }}
            >
              <Typography variant="h5" sx={{ color: '#888', mb: 1 }}>
                ➕ Create Match
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                Custom match settings (Coming Soon)
              </Typography>
              <Button variant="contained" fullWidth size="large" disabled>
                Create Match
              </Button>
            </Paper>

            <Paper
              elevation={3}
              sx={{ p: 3, backgroundColor: '#1a1a2e', borderRadius: 2, opacity: 0.6 }}
            >
              <Typography variant="h5" sx={{ color: '#888', mb: 1 }}>
                📋 Match History
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                No matches played yet
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Container>

      <BareModal
        open={isChoosingRules}
        onClose={() => setIsChoosingRules(false)}
        className="lobby-rules-modal"
        ariaLabel="Quick Match options"
      >
        <Typography variant="h5" className="lobby-rules-modal__title">
          🎮 Quick Match
        </Typography>
        <Typography variant="body2" className="lobby-rules-modal__hint">
          Pick how you want to play
        </Typography>

        <Box className="lobby-rules-modal__options">
          <Button
            autoFocus
            variant="outlined"
            size="large"
            fullWidth
            className="lobby-rules-modal__option"
            onClick={() => startMatch([])}
          >
            <span className="lobby-rules-modal__option-label">Basic Match</span>
            <span className="lobby-rules-modal__option-caption">No special rules</span>
          </Button>

          {/* The caption is rendered from the constant, so a fifth rule needs no change here. */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            className="lobby-rules-modal__option lobby-rules-modal__option--rules"
            onClick={() => startMatch(ALL_MATCH_RULES)}
          >
            <span className="lobby-rules-modal__option-label">Match with Rules</span>
            <span className="lobby-rules-modal__option-caption">
              {ALL_MATCH_RULES.map(rule => rule.toUpperCase()).join(' · ')}
            </span>
          </Button>
        </Box>

        <Button
          variant="text"
          color="inherit"
          className="lobby-rules-modal__cancel"
          onClick={() => setIsChoosingRules(false)}
        >
          Cancel
        </Button>
      </BareModal>
    </Box>
  );
};
