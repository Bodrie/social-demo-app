import React from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

const RouterComponent = () => {
  const router = createBrowserRouter([
    {
      path: "/login",
      element: <div>Login page</div>,
    },
    {
      path: "/register",
      element: <div>Register page</div>,
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
