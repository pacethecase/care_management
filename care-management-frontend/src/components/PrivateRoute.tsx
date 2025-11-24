// src/components/PrivateRoute.tsx
import React, { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { RootState } from "../redux/store";

interface PrivateRouteProps {
  children: ReactNode;
  allowedRoles?: ("global" | "super_admin" | "admin" | "staff")[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
  const { user, authLoaded } = useSelector((state: RootState) => state.user);

  if (!authLoaded) return <p>Loading session...</p>;

  if (!user) return <Navigate to="/" replace />;

  if (!allowedRoles) {
    return children;
  }

  const roleChecks = {
    global: user.has_global_access,
    super_admin: user.is_super_admin,
    admin: user.is_admin,
    staff: user.is_staff,
  };

  const hasAccess = allowedRoles.some((role) => roleChecks[role]);

  if (hasAccess) return children;

  return <Navigate to="/homepage" replace />;
};

export default PrivateRoute;
