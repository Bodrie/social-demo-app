import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";
import { useCookies } from "react-cookie";

type ProtectedRouteProps = {
  children: JSX.Element | null;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [cookies, setCookie, removeCookie] = useCookies();
  console.log(cookies);

  const context = useContext(AuthContext);
  if (!context?.user || !cookies) {
    return <Navigate to={"/login"} />;
  }

  return children;
};

export default ProtectedRoute;
