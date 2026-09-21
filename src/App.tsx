import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import './App.css';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { CardShop } from './pages/CardShop';
import { MyCards } from './pages/MyCards';
import { MyPacks } from './pages/MyPacks';
import { Welcome } from './pages/Welcome';
import { MatchPage } from './pages/MatchPage';
import { AccountCreation } from './pages/AccountCreation';
import { SignIn } from './pages/SignIn';
import { useAuth } from './contexts/AuthContext';

// Full-screen loader shown while the persisted session is being restored.
function LoadingScreen() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress sx={{ color: '#4a9eff' }} />
    </Box>
  );
}

// Redirects unauthenticated visitors to the sign-in page.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

// Keeps signed-in users out of the public entry pages (Landing / Sign In / Create Account). `redirectTo` is where
// an authenticated visitor is sent: the Lobby for the entry pages, but the Welcome page for account creation — so
// the redirect that follows a successful registration can never race ahead of it and land the player in the Lobby.
function PublicOnlyRoute({
  children,
  redirectTo = '/lobby',
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <div className="app">
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnlyRoute>
              <Landing />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/create-account"
          element={
            <PublicOnlyRoute redirectTo="/welcome">
              <AccountCreation />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/sign-in"
          element={
            <PublicOnlyRoute>
              <SignIn />
            </PublicOnlyRoute>
          }
        />
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
        <Route
          path="/shop"
          element={
            <ProtectedRoute>
              <CardShop />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cards"
          element={
            <ProtectedRoute>
              <MyCards />
            </ProtectedRoute>
          }
        />
        <Route
          path="/packs"
          element={
            <ProtectedRoute>
              <MyPacks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <Welcome />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </div>
  );
}

export default App;
