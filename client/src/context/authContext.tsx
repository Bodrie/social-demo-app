import { createContext, useEffect, useState } from "react";
import { User, AuthContextT, Login } from "../types";
import { login } from "../services/axios";

type AuthContextProps = {
  children: string | JSX.Element | JSX.Element[];
};

export const AuthContext = createContext<AuthContextT>(null);

export const AuthContextProvider = ({ children }: AuthContextProps) => {
  const [currentUser, setCurrentUser] = useState<User>(
    JSON.parse(localStorage.getItem("user") as string) || null
  );

  const ctxLogin = ({ email, password }: Login) => {
    login({ email, password }).then((res) => {
      setCurrentUser(res.data);
    });
  };

  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(currentUser));
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ user: currentUser, ctxLogin }}>
      {children}
    </AuthContext.Provider>
  );
};
