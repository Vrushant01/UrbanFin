import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, type User, type OmitPassword } from '../types';
import { mockDb } from '../mock/db';

interface AuthContextType {
  currentUser: OmitPassword<User> | null;
  role: Role | null;
  login: (loginId: string, password: string) => Promise<boolean>;
  logout: () => void;
  signup: (userData: Omit<User, 'id' | 'role'>) => Promise<boolean>;
  createUser: (userData: Omit<User, 'id'>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<OmitPassword<User> | null>(() => {
    return mockDb.getSession();
  });

  useEffect(() => {
    if (currentUser) {
      mockDb.syncWithBackend();
    }
  }, []);

  const login = async (loginId: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: loginId.trim(), password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('urbanfin_jwt_token', data.token);
        }
        if (data.user) {
          const userSession = {
            id: data.user.id || data.user._id,
            name: data.user.name,
            loginId: data.user.loginId,
            email: data.user.email,
            role: data.user.role,
            contactId: data.user.contactId,
          };
          setCurrentUser(userSession);
          mockDb.setSession(userSession);
          await mockDb.syncWithBackend();
          return true;
        }
      }
    } catch (e) {
      console.warn('[Auth] Remote login failed, attempting local fallback', e);
    }

    const users = mockDb.getUsers();
    const cleanId = loginId.trim().toLowerCase();
    const user = users.find(
      u => (u.loginId.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) && u.password === password
    );
    
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      setCurrentUser(userWithoutPassword);
      mockDb.setSession(userWithoutPassword);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('urbanfin_jwt_token');
    mockDb.clearSession();
  };

  const signup = async (userData: Omit<User, 'id' | 'role'>): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('urbanfin_jwt_token', data.token);
        }
        if (data.user) {
          const userSession = {
            id: data.user.id || data.user._id,
            name: data.user.name,
            loginId: data.user.loginId,
            email: data.user.email,
            role: data.user.role,
            contactId: data.user.contactId,
          };
          setCurrentUser(userSession);
          mockDb.setSession(userSession);
          await mockDb.syncWithBackend();
          return true;
        }
      }
    } catch (e) {
      console.warn('[Auth] Remote signup failed, falling back locally', e);
    }

    if (!mockDb.checkUnique('loginId', userData.loginId) || !mockDb.checkUnique('email', userData.email)) {
      return false;
    }
    const newUser = mockDb.addUser({ ...userData, role: Role.Accountant });
    const { password: _, ...userWithoutPassword } = newUser;
    setCurrentUser(userWithoutPassword);
    mockDb.setSession(userWithoutPassword);
    return true;
  };

  const createUser = async (userData: Omit<User, 'id'>): Promise<boolean> => {
    if (currentUser?.role !== Role.Administrator) return false;
    
    try {
      const token = localStorage.getItem('urbanfin_jwt_token');
      const res = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(userData),
      });
      if (res.ok) {
        await mockDb.syncWithBackend();
        return true;
      }
    } catch (e) {
      console.warn('[Auth] Remote createUser failed, falling back locally', e);
    }

    if (!mockDb.checkUnique('loginId', userData.loginId) || !mockDb.checkUnique('email', userData.email)) {
      return false;
    }
    mockDb.addUser(userData);
    return true;
  };

  return (
    <AuthContext.Provider value={{ currentUser, role: currentUser?.role || null, login, logout, signup, createUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
