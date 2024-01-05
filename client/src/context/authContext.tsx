import { createContext, useEffect, useState } from "react";
import { User, AuthContextT, Login } from "../types";
import { login, logout } from "../services/axios";
import { socket } from "../socket";
import { AxiosResponse } from "axios";

type AuthContextProps = {
  children: string | JSX.Element | JSX.Element[];
};

export const AuthContext = createContext<AuthContextT>(null!);

export const AuthContextProvider = ({ children }: AuthContextProps) => {
  const [currentUser, setCurrentUser] = useState<User>(
    JSON.parse(localStorage.getItem("user")!)
  );

  const ctxLogin = ({ email, password }: Login) => {
    const loginRes = login({ email, password }).then(
      (res: AxiosResponse<User>) => {
        if (res.data) {
          setCurrentUser(res.data);
        }

        return res;
      }
    );
    return loginRes;
  };

  const ctxLogout = () => {
    logout();
    socket.emit("user_logout", currentUser);
    setCurrentUser(null!);
  };

  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(currentUser));
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{ user: currentUser, ctxLogin, ctxLogout, setCurrentUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};
