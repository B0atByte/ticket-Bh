export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  perms: string[];
}

export interface AuthSession {
  user: AuthUser;
}
