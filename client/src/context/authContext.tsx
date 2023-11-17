import { createContext, useEffect, useState } from "react";
import { User, AuthContextT, Login } from "../types";
import axios from "axios";

type AuthContextProps = {
  children: string | JSX.Element | JSX.Element[];
};

export const AuthContext = createContext<AuthContextT>(null);

export const AuthContextProvider = ({ children }: AuthContextProps) => {
  const [currentUser, setCurrentUser] = useState<User>(
    JSON.parse(localStorage.getItem("user") as string) || null
  );

  const login = async ({ email, password }: Login) => {
    const res = await axios.post(
      "http://localhost:8000/api/auth/login",
      {
        email,
        password,
      },
      {
        withCredentials: true,
      }
    );
    setCurrentUser(res.data);
  };

  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(currentUser));
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ user: currentUser, login }}>
      {children}
    </AuthContext.Provider>
  );
};
