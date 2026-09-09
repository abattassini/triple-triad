import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import './Landing.scss';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container className="landing-container">
      <Box className="landing-content">
        <Typography variant="h2" className="landing-title">
          Triple Triad
        </Typography>
        <Typography variant="h5" className="landing-subtitle">
          Final Fantasy Card Game
        </Typography>

        <Box className="landing-actions">
          <Typography variant="body1" className="landing-hint">
            Sign in or create an account to play
          </Typography>
          <Button
            variant="outlined"
            size="large"
            fullWidth
            className="landing-sign-in"
            onClick={() => navigate('/sign-in')}
          >
            Sign In
          </Button>
          <Button
            variant="contained"
            size="large"
            fullWidth
            className="landing-sign-up"
            sx={{
              backgroundColor: '#4a9eff',
              '&:hover': { backgroundColor: '#3a8eef' },
            }}
            onClick={() => navigate('/create-account')}
          >
            Sign Up
          </Button>
        </Box>
      </Box>
    </Container>
  );
};
