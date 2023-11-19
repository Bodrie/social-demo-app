import React from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import LoginForm from "../pages/Login/Login";
import RegisterForm from "../pages/Register/Register";

const RouterComponent = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <LoginForm />,
    },
    {
      path: "/login",
      element: <LoginForm />,
    },
    {
      path: "/register",
      element: <RegisterForm />,
    },
    {
      path: "/profile",
      element: (
        <ProtectedRoute>
          <div>Profile page</div>
        </ProtectedRoute>
      ),
    },
  ]);
  return <RouterProvider router={router} />;
};

export default RouterComponent;
