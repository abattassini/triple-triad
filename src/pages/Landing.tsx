import { Box, Typography, Container } from '@mui/material';
import './Landing.scss';

export const Landing: React.FC = () => {
  return (
    <Container className="landing-container">
      <Box className="landing-content">
        <Typography variant="h2" className="landing-title">
          Triple Triad
        </Typography>
        <Typography variant="h5" className="landing-subtitle">
          Final Fantasy Card Game
        </Typography>

        <Box className="instructions">
          <Typography variant="body1" className="instruction-text">
            To play, add your username to the URL:
          </Typography>
          <Typography variant="h6" className="url-example">
            /triple-triad/<strong>yourname</strong>
          </Typography>
          <Typography variant="body2" className="example-hint">
            Example: /triple-triad/alice
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};
