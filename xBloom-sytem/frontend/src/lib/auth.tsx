import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAuthToken, type StaffUser } from "./api";

interface AuthState {
  user: StaffUser | null;
  token: string | null;
  isAdmin: boolean;
  login: (name: string, pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "xbloom.auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restore session on first load.
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { token: string; user: StaffUser };
        setToken(saved.token);
        setUser(saved.user);
        setAuthToken(saved.token);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const login = useCallback(async (name: string, pin: string) => {
    const res = await api.login(name, pin);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Sign out automatically when the API reports an expired/invalid token.
  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener("auth:401", onUnauthorized);
    return () => window.removeEventListener("auth:401", onUnauthorized);
  }, [logout]);

  const value = useMemo<AuthState>(
    () => ({ user, token, isAdmin: user?.role === "admin", login, logout }),
    [user, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
