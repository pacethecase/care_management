// src/components/PrivateRoute.tsx
import React, { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { RootState } from "../redux/store";
import type { UserRole } from "../redux/types";

interface PrivateRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
  const { user, authLoaded } = useSelector((state: RootState) => state.user);

  if (!authLoaded) return <p>Loading session...</p>;
  if (!user) return <Navigate to="/" replace />;

  if (!allowedRoles || allowedRoles.length === 0) return <>{children}</>;

  const hasAccess =
    (user.role === 'administration' && user.has_global_access) ||
    allowedRoles.includes(user.role);

  if (hasAccess) return <>{children}</>;

  return <Navigate to="/homepage" replace />;
};

export default PrivateRoute;