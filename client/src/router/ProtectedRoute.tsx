import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";

type ProtectedRouteProps = {
  children: JSX.Element | null;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const context = useContext(AuthContext);
  if (!context?.user) {
    return <Navigate to={"/login"} />;
  }

  return children;
};

export default ProtectedRoute;
