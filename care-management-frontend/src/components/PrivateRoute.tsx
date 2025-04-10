// src/components/PrivateRoute.tsx
import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { RootState } from "../redux/store";

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { user, authLoaded } = useSelector((state: RootState) => state.user);

  if (!authLoaded) return <p>Loading session...</p>; // Or a spinner

  if (!user) return <Navigate to="/login" replace />;

  return children;
};


export default PrivateRoute;
