import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth.store';
import type { AuthUser } from '../../types/auth';

const mockUser: AuthUser = {
  id: '1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  roles: ['SUPER_ADMIN'],
  perms: ['course.read', 'course.create', 'user.update', 'audit.read'],
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({ user: null });
  });

  it('initializes with null user', () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setUser stores the user', () => {
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('setUser with null clears the user', () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  describe('hasPermission', () => {
    it('returns false when no user is set', () => {
      expect(useAuthStore.getState().hasPermission('course.read')).toBe(false);
    });

    it('returns true for a permission the user has', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().hasPermission('course.read')).toBe(true);
      expect(useAuthStore.getState().hasPermission('audit.read')).toBe(true);
    });

    it('returns false for a permission the user does not have', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().hasPermission('report.export')).toBe(false);
    });

    it('returns false for empty permission string', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().hasPermission('')).toBe(false);
    });

    it('is case-sensitive', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().hasPermission('Course.Read')).toBe(false);
    });
  });
});
