import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../contexts/AuthContext';
import './SignIn.scss';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const TOUCHED_NONE = { identifier: false, password: false };

interface TouchedFields {
  identifier: boolean;
  password: boolean;
}

// Single flexible identifier field: if the value looks like an email (contains
// "@"), validate it as an email; otherwise treat it as a login (non-empty).
const validateIdentifier = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Please enter your login or email.';
  }
  if (trimmed.includes('@') && !EMAIL_PATTERN.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return undefined;
};

// Sign in only requires the password to be filled in; the strict 8-20 /
// letters-and-numbers rules apply at account creation, not here.
const validateSignInPassword = (value: string): string | undefined => {
  if (value.length === 0) {
    return 'Password is required.';
  }
  return undefined;
};

export const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<TouchedFields>(TOUCHED_NONE);

  const identifierError = validateIdentifier(identifier);
  const passwordError = validateSignInPassword(password);
  const isFormValid = !identifierError && !passwordError;

  const markTouched = (field: keyof TouchedFields) => {
    setTouched({ ...touched, [field]: true });
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    setTouched({ identifier: true, password: true });
    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await signIn(identifier.trim(), password);
      navigate('/lobby');
    } catch (error) {
      setSubmitError((error as Error).message);
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" className="sign-in-container">
      <Paper
        className="sign-in-card"
        elevation={3}
        sx={{
          background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
          border: '1px solid #3a3a5e',
          borderRadius: '12px',
        }}
      >
        <Typography variant="h4" className="sign-in-title">
          Sign In
        </Typography>
        <Typography variant="body2" className="sign-in-subtitle">
          Welcome back! Enter your login or email to continue
        </Typography>

        {submitError && (
          <Box className="sign-in-error">
            <Typography variant="body1" className="sign-in-error-text">
              {submitError}
            </Typography>
          </Box>
        )}

        <form className="sign-in-form" noValidate onSubmit={handleSubmit}>
          <TextField
            id="sign-in-identifier"
            label="Login or email"
            fullWidth
            required
            value={identifier}
            onChange={event => setIdentifier(event.target.value)}
            onBlur={() => markTouched('identifier')}
            error={touched.identifier && Boolean(identifierError)}
            helperText={
              touched.identifier
                ? identifierError
                : 'Use the login or email you chose when signing up.'
            }
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: { autoComplete: 'username', maxLength: 254 },
            }}
          />

          <TextField
            id="sign-in-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
            onBlur={() => markTouched('password')}
            error={touched.password && Boolean(passwordError)}
            helperText={touched.password ? passwordError : 'Enter your password.'}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
              htmlInput: { autoComplete: 'current-password', maxLength: 254 },
            }}
          />

          <Button
            variant="contained"
            size="large"
            fullWidth
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="sign-in-submit"
            sx={{
              backgroundColor: '#4a9eff',
              '&:hover': { backgroundColor: '#3a8eef' },
            }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>

          <Box className="sign-in-switch">
            <Typography variant="body2" className="sign-in-switch-text">
              Don't have an account?
            </Typography>
            <Button variant="text" color="primary" onClick={() => navigate('/create-account')}>
              Sign up
            </Button>
          </Box>

          <Button
            variant="text"
            color="inherit"
            className="sign-in-back"
            onClick={() => navigate('/')}
          >
            {'\u2190'} Back to home
          </Button>
        </form>
      </Paper>
    </Container>
  );
};
