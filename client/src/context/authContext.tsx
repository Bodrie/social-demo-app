import { createContext, useEffect, useState } from "react";
import { User, AuthContextT, Login } from "../types";
import { login } from "../services/axios";
import { useCookies } from "react-cookie";

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
      setCurrentUser(res.data.user);
      return "ready";
    });
    return loginRes;
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
