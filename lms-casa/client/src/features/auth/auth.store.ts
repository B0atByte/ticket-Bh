import { create } from 'zustand';
import type { AuthUser } from '../../types/auth';

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  hasPermission: (permission) => get().user?.perms.includes(permission) ?? false,
}));
