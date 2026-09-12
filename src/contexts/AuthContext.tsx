import { createContext, useContext } from 'react';
import type { Player } from '../services/api';

export interface AuthContextValue {
  user: Player | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => void;
  // Re-fetches the current player profile (e.g. to pick up post-match stats).
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
