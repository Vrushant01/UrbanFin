import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface RoleGuardProps {
  allowedRoles: Role[];
}

export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { currentUser, role } = useAuth();

  if (!currentUser || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role)) {
    // If a User tries to access Admin/Accountant areas
    if (role === Role.User) {
      return <Navigate to="/portal" replace />;
    }
    // If Accountant tries to access Admin areas (like create user)
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
