import { createContext, useEffect, useState } from "react";
import { User, AuthContextT } from "../types/user";

type AuthContextProps = {
  children: string | JSX.Element | JSX.Element[];
};

export const AuthContext = createContext<AuthContextT>(null);

export const AuthContextProvider = ({ children }: AuthContextProps) => {
  const [currentUser, setCurrentUser] = useState<User>(
    JSON.parse(localStorage.getItem("user") as string) || null
  );

  const login = () => {
    // to do
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
