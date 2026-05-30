import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../services/api';
import type { BattleResult, UserInfo } from '../types/pokemon';

// We persist the logged-in user's id (not the full profile) across reloads.
// On boot we refetch the profile so it always reflects current points and
// prediction counts.
const STORAGE_KEY = 'pbp.userId';

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<UserInfo>;
  logout: () => void;
  // Called from BattleArena after a simulation — updates points, correct,
  // and incorrect counters locally so the menu and history page reflect
  // the new totals without an extra /api/users fetch.
  applyBattleResult: (result: BattleResult) => void;
  // Replace the local user with whatever the backend returns — used after
  // clearing battle history, which resets counters server-side.
  setUserState: (u: UserInfo) => void;
  // Counter that bumps every time something happens that changes the
  // outputs of the awards procedures (a battle, or any donation CRUD).
  // AwardsPage uses it as a useEffect dependency so that opening the
  // page after a battle/donation always shows fresh ranks/streaks.
  awardsRefreshKey: number;
  refreshAwards: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [awardsRefreshKey, setAwardsRefreshKey] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    const id = Number(stored);
    api
      .getUser(id)
      .then(setUser)
      .catch(() => {
        // Stale or unreachable — force re-login.
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const u = await api.login(username, password);
    localStorage.setItem(STORAGE_KEY, String(u.userId));
    setUser(u);
  };

  const signup = async (username: string, password: string) => {
    // Successful signup does NOT log the user in — per product spec they
    // are redirected to the login page instead.
    return api.signup(username, password);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const applyBattleResult = (result: BattleResult) => {
    const correct = result.predictedWinnerId === result.winnerPokemonId;
    setUser(prev =>
      prev
        ? {
            ...prev,
            totalPoints: prev.totalPoints + result.pointsDelta,
            correctPredictions: prev.correctPredictions + (correct ? 1 : 0),
            incorrectPredictions: prev.incorrectPredictions + (correct ? 0 : 1),
          }
        : prev,
    );
  };

  const refreshAwards = () => setAwardsRefreshKey(k => k + 1);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        applyBattleResult,
        setUserState: setUser,
        awardsRefreshKey,
        refreshAwards,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
