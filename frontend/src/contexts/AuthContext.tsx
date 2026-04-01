import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthResponse, AuthUser, getCurrentUser, loginUser, registerUser } from '@/lib/api';

interface AuthContextType {
  session: { access_token: string } | null;
  user: AuthUser | null;
  roles: string[];
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'resume_ai_auth';

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  roles: [],
  isAdmin: false,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const persistAuth = (payload: AuthResponse) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    setSession({ access_token: payload.access_token });
    setUser(payload.user);
    setRoles([payload.user.role]);
  };

  useEffect(() => {
    const restoreSession = async () => {
      const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!storedValue) {
        setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(storedValue) as AuthResponse;
        const freshUser = await getCurrentUser(parsed.access_token);
        persistAuth({ ...parsed, user: freshUser });
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setSession(null);
        setUser(null);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await loginUser({ email, password });
    persistAuth(response);
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    const response = await registerUser({ full_name: fullName, email, password });
    persistAuth(response);
  };

  const signOut = async () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
    setUser(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        roles,
        isAdmin: roles.includes('admin'),
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
