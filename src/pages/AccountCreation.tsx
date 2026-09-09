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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { apiService } from '../services/api';
import './AccountCreation.scss';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const TOUCHED_ALL = { login: true, email: true, password: true, confirm: true };
const TOUCHED_NONE = { login: false, email: false, password: false, confirm: false };

interface TouchedFields {
  login: boolean;
  email: boolean;
  password: boolean;
  confirm: boolean;
}

interface PasswordChecks {
  length: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
}

// Returns an error message when invalid, or undefined when the value is valid.
const validateLogin = (value: string): string | undefined => {
  if (value.trim().length === 0) {
    return 'Login is required.';
  }
  return undefined;
};

// Strict rule set for the first password field:
// 8-20 characters and must contain at least one letter and one number.
const validatePassword = (value: string): string | undefined => {
  if (value.length === 0) {
    return 'Password is required.';
  }
  if (value.length < 8 || value.length > 20) {
    return 'Password must be between 8 and 20 characters.';
  }
  if (!/[A-Za-z]/.test(value)) {
    return 'Password must contain at least one letter.';
  }
  if (!/\d/.test(value)) {
    return 'Password must contain at least one number.';
  }
  return undefined;
};

// The confirmation field only needs to match the first password exactly.
const validateConfirmPassword = (confirm: string, password: string): string | undefined => {
  if (confirm.length === 0) {
    return 'Please confirm your password.';
  }
  if (confirm !== password) {
    return 'Passwords do not match.';
  }
  return undefined;
};

const validateEmail = (value: string): string | undefined => {
  if (value.trim().length === 0) {
    return 'Email is required.';
  }
  if (!EMAIL_PATTERN.test(value.trim())) {
    return 'Please enter a valid email address.';
  }
  return undefined;
};

const getPasswordChecks = (value: string): PasswordChecks => ({
  length: value.length >= 8 && value.length <= 20,
  hasLetter: /[A-Za-z]/.test(value),
  hasNumber: /\d/.test(value),
});
export const AccountCreation: React.FC = () => {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<TouchedFields>(TOUCHED_NONE);

  const loginError = validateLogin(login);
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const confirmError = validateConfirmPassword(confirm, password);
  const passwordChecks = getPasswordChecks(password);
  const isFormValid = !loginError && !emailError && !passwordError && !confirmError;

  const markTouched = (field: keyof TouchedFields) => {
    setTouched({ ...touched, [field]: true });
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    setTouched(TOUCHED_ALL);
    if (!isFormValid) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const player = await apiService.registerAccount({
        login: login.trim(),
        email: email.trim(),
        password,
      });
      console.log('Account created:', player);
      setSubmitted(true);
    } catch (error) {
      setSubmitError((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" className="account-creation-container">
      <Paper
        className="account-creation-card"
        elevation={3}
        sx={{
          background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
          border: '1px solid #3a3a5e',
          borderRadius: '12px',
        }}
      >
        <Typography variant="h4" className="account-creation-title">
          Create Account
        </Typography>
        <Typography variant="body2" className="account-creation-subtitle">
          Join the table and start collecting Triple Triad cards
        </Typography>

        {submitted && (
          <Box className="account-creation-success">
            <Typography variant="body1" className="account-creation-success-text">
              <CheckCircleIcon fontSize="small" /> Account created! You can now sign in.
            </Typography>
          </Box>
        )}

        {submitError && (
          <Box className="account-creation-error">
            <Typography variant="body1" className="account-creation-error-text">
              {submitError}
            </Typography>
          </Box>
        )}

        <form className="account-creation-form" noValidate onSubmit={handleSubmit}>
          <TextField
            id="account-creation-login"
            label="Login"
            fullWidth
            required
            value={login}
            onChange={event => setLogin(event.target.value)}
            onBlur={() => markTouched('login')}
            error={touched.login && Boolean(loginError)}
            helperText={touched.login ? loginError : 'Pick a username that players will see.'}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: { autoComplete: 'username', maxLength: 30 },
            }}
          />

          <TextField
            id="account-creation-email"
            label="Email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            onBlur={() => markTouched('email')}
            error={touched.email && Boolean(emailError)}
            helperText={touched.email ? emailError : 'We will never share your email.'}
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
          <TextField
            id="account-creation-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
            onBlur={() => markTouched('password')}
            error={touched.password && Boolean(passwordError)}
            helperText={
              touched.password ? passwordError : 'Between 8 and 20 characters, letters and numbers.'
            }
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
              htmlInput: { autoComplete: 'new-password', maxLength: 20 },
            }}
          />

          <Box className="password-checklist">
            <Typography
              variant="body2"
              className={passwordChecks.length ? 'check-ok' : 'check-error'}
            >
              {passwordChecks.length ? '\u2713' : '\u2717'} Between 8 and 20 characters
            </Typography>
            <Typography
              variant="body2"
              className={passwordChecks.hasLetter ? 'check-ok' : 'check-error'}
            >
              {passwordChecks.hasLetter ? '\u2713' : '\u2717'} At least one letter
            </Typography>
            <Typography
              variant="body2"
              className={passwordChecks.hasNumber ? 'check-ok' : 'check-error'}
            >
              {passwordChecks.hasNumber ? '\u2713' : '\u2717'} At least one number
            </Typography>
          </Box>
          <TextField
            id="account-creation-confirm"
            label="Confirm password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            required
            value={confirm}
            onChange={event => setConfirm(event.target.value)}
            onBlur={() => markTouched('confirm')}
            error={touched.confirm && Boolean(confirmError)}
            helperText={touched.confirm ? confirmError : 'Repeat your password, it must match.'}
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
            className="account-creation-submit"
            sx={{
              backgroundColor: '#4a9eff',
              '&:hover': { backgroundColor: '#3a8eef' },
            }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
          </Button>

          <Button
            variant="text"
            color="inherit"
            className="account-creation-back"
            onClick={() => navigate('/')}
          >
            {'\u2190'} Back to home
          </Button>
        </form>
      </Paper>
    </Container>
  );
};
