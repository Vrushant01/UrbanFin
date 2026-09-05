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

  // MasterAdmin has top-level superuser privileges across management routes
  const effectiveAllowedRoles = [...allowedRoles];
  if (
    allowedRoles.includes(Role.Administrator) ||
    allowedRoles.includes(Role.SubAdmin) ||
    allowedRoles.includes(Role.Accountant)
  ) {
    effectiveAllowedRoles.push(Role.MasterAdmin);
  }

  if (!effectiveAllowedRoles.includes(role)) {
    if (role === Role.Vendor) {
      return <Navigate to="/vendor-portal" replace />;
    }
    if (role === Role.User) {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
