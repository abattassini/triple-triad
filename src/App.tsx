import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import './App.css';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { MatchPage } from './pages/MatchPage';
import { AccountCreation } from './pages/AccountCreation';
import { SignIn } from './pages/SignIn';
import { useAuth } from './contexts/AuthContext';

// Redirects unauthenticated visitors to the sign-in page.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress sx={{ color: '#4a9eff' }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create-account" element={<AccountCreation />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route
          path="/lobby"
          element={
            <ProtectedRoute>
              <Lobby />
            </ProtectedRoute>
          }
        />
        <Route
          path="/match/:matchId"
          element={
            <ProtectedRoute>
              <MatchPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </div>
  );
}

export default App;
