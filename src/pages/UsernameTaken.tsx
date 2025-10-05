import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import './UsernameTaken.scss';

export const UsernameTaken: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  return (
    <Container className="username-taken-container">
      <Box className="error-content">
        <ErrorOutlineIcon className="error-icon" />
        <Typography variant="h3" className="error-title">
          Username Already in Use
        </Typography>
        <Typography variant="body1" className="error-message">
          The username "<strong>{username}</strong>" is currently being used by another player.
        </Typography>
        <Typography variant="body2" className="error-hint">
          Please choose a different username and try again.
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/')}
          className="back-button"
        >
          Choose Another Username
        </Button>
      </Box>
    </Container>
  );
};
