import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";

type ProtectedRouteProps = {
  children: string | JSX.Element | JSX.Element[];
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const context = useContext(AuthContext);
  if (!context?.user) {
    return <Navigate to={"/login"} />;
  }

  return children;
};

export default ProtectedRoute;
