import { useCallback, useEffect, useState } from 'react';
import { apiService, type Player } from '../services/api';
import { clearSession, getAccessToken, getStoredUser, setSession } from '../services/auth';
import { AuthContext, type AuthContextValue } from './AuthContext';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Player | null>(getStoredUser());
  const [loading, setLoading] = useState(true);

  // Restore and validate the persisted session on startup.
  useEffect(() => {
    const restore = async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }

      try {
        const me = await apiService.getMe();
        setUser(me);
      } catch {
        clearSession();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restore();
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const { token, player } = await apiService.signIn(identifier, password);
    setSession(token, player);
    setUser(player);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  // Re-fetches the profile (coins/XP/W-L-T may have changed after a match).
  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const me = await apiService.getMe();
      setUser(me);
      setSession(token, me);
    } catch {
      // Keep the cached user if the refresh fails (e.g. offline / transient error).
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    loading,
    signIn,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
