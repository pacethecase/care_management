// src/components/PrivateRoute.tsx
import React, { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { RootState } from "../redux/store";
interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, authLoaded } = useSelector((state: RootState) => state.user);

  if (!authLoaded) return <p>Loading session...</p>; // Or a spinner

  if (!user) return <Navigate to="/" replace />;

  return children;
};


export default PrivateRoute;
