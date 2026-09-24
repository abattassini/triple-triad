import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { apiService } from '../services/api';
import './ForgotPassword.scss';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const validateEmail = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Please enter your email.';
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return undefined;
};

/**
 * Asks for a recovery code.
 *
 * The success copy is deliberately vague — "if that email belongs to an account, a code is on its way" — because the
 * endpoint answers identically for an address it knows and one it does not. A page that said "we sent it!" would undo
 * that: it would become a better oracle than the endpoint it wraps. The wording therefore has to read sensibly in
 * both cases.
 *
 * The follow-up button exists because the mail may be slow, filtered, or have a link the client mangles; the same
 * email carries the code in a form the player can type, so the flow must not dead-end here.
 */
export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const emailError = validateEmail(email);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    setTouched(true);

    if (emailError) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiService.forgotPassword(email.trim());
      setIsRequested(true);
    } catch (error) {
      setSubmitError((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" className="forgot-password-container">
      <Paper
        className="forgot-password-card"
        elevation={3}
        sx={{
          background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
          border: '1px solid #3a3a5e',
          borderRadius: '12px',
        }}
      >
        <Typography variant="h4" className="forgot-password-title">
          Forgot password
        </Typography>
        <Typography variant="body2" className="forgot-password-subtitle">
          {isRequested
            ? 'Check your inbox for the next step'
            : 'Enter your email and we will send a code to reset your password'}
        </Typography>

        {isRequested && (
          <Box className="forgot-password-sent">
            <Typography variant="body1" className="forgot-password-sent-text">
              If that email belongs to an account, a reset code is on its way. It works for 15
              minutes and can only be used once.
            </Typography>
          </Box>
        )}

        {submitError && (
          <Box className="forgot-password-error">
            <Typography variant="body1" className="forgot-password-error-text">
              {submitError}
            </Typography>
          </Box>
        )}

        {isRequested ? (
          <Box className="forgot-password-form">
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => navigate('/reset-password')}
              sx={{
                backgroundColor: '#4a9eff',
                '&:hover': { backgroundColor: '#3a8eef' },
              }}
            >
              I have a code
            </Button>
          </Box>
        ) : (
          <form className="forgot-password-form" noValidate onSubmit={handleSubmit}>
            <TextField
              id="forgot-password-email"
              label="Email"
              type="email"
              fullWidth
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              onBlur={() => setTouched(true)}
              error={touched && Boolean(emailError)}
              helperText={
                touched ? emailError : 'The address you used when you created your account.'
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: { autoComplete: 'email', maxLength: 254 },
              }}
            />

            <Button
              variant="contained"
              size="large"
              fullWidth
              type="submit"
              disabled={Boolean(emailError) || isSubmitting}
              sx={{
                backgroundColor: '#4a9eff',
                '&:hover': { backgroundColor: '#3a8eef' },
              }}
            >
              {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Send reset code'}
            </Button>
          </form>
        )}

        <Button
          variant="text"
          color="inherit"
          className="forgot-password-back"
          onClick={() => navigate('/sign-in')}
        >
          {'\u2190'} Back to sign in
        </Button>
      </Paper>
    </Container>
  );
};
