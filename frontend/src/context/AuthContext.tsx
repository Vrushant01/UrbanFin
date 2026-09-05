import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, type User, type OmitPassword } from '../types';
import { mockDb } from '../mock/db';

interface AuthResult {
  success: boolean;
  message?: string;
}

interface AuthContextType {
  currentUser: OmitPassword<User> | null;
  role: Role | null;
  login: (loginId: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  signup: (userData: Omit<User, 'id'> & { phone?: string }) => Promise<AuthResult>;
  createUser: (userData: Omit<User, 'id'> & { phone?: string }) => Promise<boolean>;
  getAllUsers: () => Promise<User[]>;
  toggleSuspendUser: (userId: string) => Promise<{ success: boolean; message?: string }>;
  deleteUser: (userId: string) => Promise<boolean>;
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

  const login = async (loginId: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: loginId.trim(), password }),
      });
      const data = await res.json();

      if (res.ok) {
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
            isSuspended: data.user.isSuspended,
            isMasterAdmin: data.user.isMasterAdmin,
          };
          setCurrentUser(userSession);
          mockDb.setSession(userSession);
          await mockDb.syncWithBackend();
          return { success: true };
        }
      } else {
        return { success: false, message: data.message || 'Invalid Login ID or Password' };
      }
    } catch (e) {
      console.warn('[Auth] Remote login failed, attempting local fallback', e);
    }

    const users = mockDb.getUsers();
    const cleanId = loginId.trim().toLowerCase();
    const user = users.find(
      (u) => (u.loginId.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) && u.password === password
    );

    if (user) {
      if (user.isSuspended) {
        return {
          success: false,
          message: 'Your account has been suspended by the Master Administrator. Please contact support.',
        };
      }
      const { password: _, ...userWithoutPassword } = user;
      setCurrentUser(userWithoutPassword);
      mockDb.setSession(userWithoutPassword);
      return { success: true };
    }
    return { success: false, message: 'Invalid Login ID or Password' };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('urbanfin_jwt_token');
    mockDb.clearSession();
  };

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener('auth_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth_unauthorized', handleUnauthorized);
  }, []);

  const signup = async (userData: Omit<User, 'id'> & { phone?: string }): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (res.ok) {
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
            isSuspended: data.user.isSuspended,
            isMasterAdmin: data.user.isMasterAdmin,
          };
          setCurrentUser(userSession);
          mockDb.setSession(userSession);
          await mockDb.syncWithBackend();
          return { success: true };
        }
      } else {
        return { success: false, message: data.message || 'Failed to sign up' };
      }
    } catch (e) {
      console.warn('[Auth] Remote signup failed, falling back locally', e);
    }

    if (!mockDb.checkUnique('loginId', userData.loginId) || !mockDb.checkUnique('email', userData.email)) {
      return { success: false, message: 'Login ID or Email is already taken.' };
    }
    const newUser = mockDb.addUser({ ...userData, role: userData.role || Role.Accountant });
    const { password: _, ...userWithoutPassword } = newUser;
    setCurrentUser(userWithoutPassword);
    mockDb.setSession(userWithoutPassword);
    return { success: true };
  };

  const createUser = async (userData: Omit<User, 'id'> & { phone?: string }): Promise<boolean> => {
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

  const getAllUsers = async (): Promise<User[]> => {
    try {
      const token = localStorage.getItem('urbanfin_jwt_token');
      const res = await fetch('/api/auth/users', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const users = await res.json();
        return users;
      }
    } catch (e) {
      console.warn('[Auth] Remote getAllUsers failed', e);
    }
    return mockDb.getUsers();
  };

  const toggleSuspendUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = localStorage.getItem('urbanfin_jwt_token');
      const res = await fetch(`/api/auth/users/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to update user status' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error' };
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('urbanfin_jwt_token');
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || null,
        login,
        logout,
        signup,
        createUser,
        getAllUsers,
        toggleSuspendUser,
        deleteUser,
      }}
    >
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
