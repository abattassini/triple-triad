import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { apiService } from '../services/api';
import './ResetPassword.scss';

/** 10 symbols from the backend's unambiguous 32-character alphabet — see PasswordResetService.CodeLength. */
const CODE_LENGTH = 10;

/** Mirrors the backend's PasswordRules so the two can never disagree about what a password may be. */
const validatePassword = (value: string): string | undefined => {
  if (value.length < 8 || value.length > 20) {
    return 'Password must be between 8 and 20 characters.';
  }
  if (!/[a-zA-Z]/.test(value)) {
    return 'Password must contain at least one letter.';
  }
  if (!/[0-9]/.test(value)) {
    return 'Password must contain at least one number.';
  }
  return undefined;
};

/**
 * Case and dashes are presentation only: the backend strips both before it hashes the code, so normalising here just
 * makes the local length check agree with what will actually be looked up.
 */
const normaliseCode = (value: string): string => value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();

/**
 * Finishes a recovery.
 *
 * The code arrives two ways and both must work. The emailed link lands here with `?token=…`, which pre-fills the
 * field; the same email also prints the code for typing. That redundancy is the point — a mail client that mangles
 * the URL, or a player reading the message on a phone while sitting at a desktop, should never be the difference
 * between recovering an account and losing it.
 *
 * On success the player is sent to sign in rather than signed in: the reset bumps their session version, so every
 * token they were holding — including anything the client still has in storage — is already dead.
 */
export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(() => normaliseCode(searchParams.get('token') ?? ''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ code: false, password: false, confirm: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const normalisedCode = normaliseCode(code);
  const codeError =
    normalisedCode.length === CODE_LENGTH
      ? undefined
      : 'Enter the 10-character code from the email.';
  const passwordError = validatePassword(password);
  const confirmError = confirm === password ? undefined : 'Both passwords must match.';
  const isFormValid = !codeError && !passwordError && !confirmError;

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    setTouched({ code: true, password: true, confirm: true });

    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiService.resetPassword(normalisedCode, password);
      setIsDone(true);
    } catch (error) {
      // The backend is specific here on purpose ("that code is not valid", "that code has expired"), and the player
      // needs to know which it is to decide whether to retype the code or request a new one.
      setSubmitError((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" className="reset-password-container">
      <Paper
        className="reset-password-card"
        elevation={3}
        sx={{
          background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
          border: '1px solid #3a3a5e',
          borderRadius: '12px',
        }}
      >
        <Typography variant="h4" className="reset-password-title">
          {isDone ? 'Password changed' : 'Choose a new password'}
        </Typography>
        <Typography variant="body2" className="reset-password-subtitle">
          {isDone
            ? 'You can sign in with your new password now'
            : 'Use the code we emailed you — the link is not the only way in'}
        </Typography>

        {isDone && (
          <Box className="reset-password-done">
            <Typography variant="body1" className="reset-password-done-text">
              Your password has been changed, and every device that was signed in has been signed
              out.
            </Typography>
          </Box>
        )}

        {submitError && (
          <Box className="reset-password-error">
            <Typography variant="body1" className="reset-password-error-text">
              {submitError}
            </Typography>
          </Box>
        )}

        {isDone ? (
          <Box className="reset-password-form">
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => navigate('/sign-in')}
              sx={{
                backgroundColor: '#4a9eff',
                '&:hover': { backgroundColor: '#3a8eef' },
              }}
            >
              Go to Sign In
            </Button>
          </Box>
        ) : (
          <form className="reset-password-form" noValidate onSubmit={handleSubmit}>
            <TextField
              id="reset-password-code"
              label="Reset code"
              fullWidth
              required
              value={code}
              onChange={event => setCode(event.target.value)}
              onBlur={() => setTouched({ ...touched, code: true })}
              error={touched.code && Boolean(codeError)}
              helperText={touched.code ? codeError : 'The 10 characters from the email.'}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKeyIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: { autoComplete: 'one-time-code', maxLength: 20 },
              }}
            />

            <TextField
              id="reset-password-new"
              label="New password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              onBlur={() => setTouched({ ...touched, password: true })}
              error={touched.password && Boolean(passwordError)}
              helperText={
                touched.password
                  ? passwordError
                  : 'Between 8 and 20 characters, letters and numbers.'
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon fontSize="small" />
                    </InputAdornment>
                  ),
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
                htmlInput: { autoComplete: 'new-password', maxLength: 20 },
              }}
            />

            <TextField
              id="reset-password-confirm"
              label="Confirm new password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              required
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              onBlur={() => setTouched({ ...touched, confirm: true })}
              error={touched.confirm && Boolean(confirmError)}
              helperText={
                touched.confirm ? confirmError : 'Repeat your new password, it must match.'
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: { autoComplete: 'new-password', maxLength: 20 },
              }}
            />

            <Button
              variant="contained"
              size="large"
              fullWidth
              type="submit"
              disabled={!isFormValid || isSubmitting}
              sx={{
                backgroundColor: '#4a9eff',
                '&:hover': { backgroundColor: '#3a8eef' },
              }}
            >
              {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Set new password'}
            </Button>
          </form>
        )}

        <Button
          variant="text"
          color="inherit"
          className="reset-password-back"
          onClick={() => navigate('/sign-in')}
        >
          {'\u2190'} Back to sign in
        </Button>
      </Paper>
    </Container>
  );
};
