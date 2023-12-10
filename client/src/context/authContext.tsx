import { createContext, useEffect, useState } from "react";
import { User, AuthContextT, Login } from "../types";
import { login, logout } from "../services/axios";

type AuthContextProps = {
  children: string | JSX.Element | JSX.Element[];
};

export const AuthContext = createContext<AuthContextT>(null);

export const AuthContextProvider = ({ children }: AuthContextProps) => {
  const [currentUser, setCurrentUser] = useState<User>(
    JSON.parse(localStorage.getItem("user") as string) || null
  );

  const ctxLogin = ({ email, password }: Login) => {
    const loginRes = login({ email, password }).then((res) => {
      setCurrentUser(res.data);
      return "ready";
    });
    return loginRes;
  };

  const ctxLogout = () => {
    logout();
    setCurrentUser(null)
  };

  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(currentUser));
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ user: currentUser, ctxLogin, ctxLogout }}>
      {children}
    </AuthContext.Provider>
  );
};
