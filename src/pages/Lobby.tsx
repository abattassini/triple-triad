import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Container, Button, Paper } from '@mui/material';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { apiService } from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import './Lobby.scss';

export const Lobby: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [isSearching, setIsSearching] = useState(false);
  const { isConnected, on, off, joinMatch } = useSignalR();

  useEffect(() => {
    if (!username) {
      navigate('/');
      return;
    }
  }, [username, navigate]);
  useEffect(() => {
    if (!isConnected || !username) return; // Listen for match joined event (when second player joins)
    const handleMatchJoined = (...args: unknown[]) => {
      const data = args[0] as { matchId: number; status: string };
      console.log('Match joined:', data);
      if (data.status === 'active') {
        setIsSearching(false);
        navigate(`/match/${data.matchId}/${username}`);
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
  }, [isConnected, username, navigate, on, off]);

  const handleQuickMatch = async () => {
    if (!username || !isConnected) {
      alert('Please wait for connection...');
      return;
    }

    setIsSearching(true);

    try {
      // First, check if there's a waiting match
      const waitingMatches = await apiService.getWaitingMatches();

      if (waitingMatches.length > 0) {
        // Join the first waiting match
        const matchToJoin = waitingMatches[0];
        const result = await apiService.joinMatch(matchToJoin.id, username);
        // Join SignalR group
        await joinMatch(result.match.id);

        // Navigate to match immediately
        navigate(`/match/${result.match.id}/${username}`);
      } else {
        // Create a new match and wait for opponent
        const result = await apiService.createMatch(username, undefined);

        // Join SignalR group
        await joinMatch(result.match.id);

        console.log('Waiting for opponent...', result.match.id);
        // Stay in searching state - will navigate when MatchJoined event fires
      }
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

  if (!username) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box className="lobby-container">
      <HamburgerMenu />
      <Container className="lobby-content">
        <Typography variant="h3" className="lobby-title">
          Welcome, {username}!
        </Typography>
        <Typography variant="body1" className="lobby-subtitle" sx={{ mb: 2 }}>
          {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
        </Typography>

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
                onClick={handleQuickMatch}
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
      </Container>
    </Box>
  );
};
