import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import './App.css';
import { AppChrome } from './components/AppChrome';
import { Landing } from './pages/Landing';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Social } from './pages/Social';
import { CardShop } from './pages/CardShop';
import { MyCards } from './pages/MyCards';
import { MyPacks } from './pages/MyPacks';
import { Welcome } from './pages/Welcome';
import { OnlinePlayers } from './pages/OnlinePlayers';
import { MatchPage } from './pages/MatchPage';
import { AccountCreation } from './pages/AccountCreation';
import { SignIn } from './pages/SignIn';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { useAuth } from './contexts/AuthContext';
import { NotificationsProvider } from './contexts/NotificationsProvider';

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
// an authenticated visitor is sent: Home for the entry pages, but the Welcome page for account creation — so the
// redirect that follows a successful registration can never race ahead of it and land the player in Home.
function PublicOnlyRoute({
  children,
  redirectTo = '/home',
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

// Who may open the operator pages — the online roster (`plans/PLAN-026-player-search-and-online-page/plan.md` §3.4).
// Matched case-insensitively against the signed-in login, and kept in step with the server's own allowlist
// (`PlayerController.OperatorLogins`): the redirect here is the UX, the server's 403 is the rule.
const OPERATOR_LOGINS = ['batta', 'argel'];

// Restricts a route to the operator logins: a signed-in non-operator is sent Home as if the page did not exist for
// them. It sits inside `AppLayout`, so it only ever sees an authenticated player.
function PrivilegedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !OPERATOR_LOGINS.includes(user.login.toLowerCase())) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

// The signed-in pages that carry the chrome (`AppChrome`): one mount for all of them, rather than each page mounting
// it. The match board is deliberately not one of them.
function AppLayout() {
  return (
    <ProtectedRoute>
      <AppChrome />
      <Outlet />
    </ProtectedRoute>
  );
}

function App() {
  return (
    <div className="app">
      {/* The inbox is app-wide state: the bell lives in the chrome, and the panel it opens must survive a page change
          — so the provider is mounted once, above the routes rather than on the pages that show it (§3.5). */}
      <NotificationsProvider>
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
          {/* Password recovery. Both are public-only, and both sit above the catch-all below — a reset link arriving
            from an email lands on /reset-password with ?token=…, which must reach this route rather than be
            redirected to Home. The GitHub Pages 404 shim (public/404.html + index.html) is what keeps that
            deep link working on a static host. */}
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPassword />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicOnlyRoute>
                <ResetPassword />
              </PublicOnlyRoute>
            }
          />
          {/* The pages that carry the chrome: every signed-in screen but the match board, so they share one layout
            element instead of mounting it five times. */}
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/play" element={<Play />} />
            <Route path="/social" element={<Social />} />
            <Route path="/shop" element={<CardShop />} />
            <Route path="/cards" element={<MyCards />} />
            <Route path="/packs" element={<MyPacks />} />
            <Route path="/welcome" element={<Welcome />} />
            {/* The operators' online roster: no nav entry, reachable only by typing the URL, and only for the
                operator logins — everyone else is sent Home
                (plans/PLAN-026-player-search-and-online-page/plan.md §3.4). */}
            <Route
              path="/online"
              element={
                <PrivilegedRoute>
                  <OnlinePlayers />
                </PrivilegedRoute>
              }
            />
          </Route>
          {/* The board, deliberately outside the chrome: a duel owns the whole screen. */}
          <Route
            path="/match/:matchId"
            element={
              <ProtectedRoute>
                <MatchPage />
              </ProtectedRoute>
            }
          />
          {/* The old Lobby is retired: its matchmaking is `/play`, its cards/shop links are on `/home`. */}
          <Route path="/lobby" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </NotificationsProvider>
    </div>
  );
}

export default App;
