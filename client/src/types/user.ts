import { AxiosError, AxiosResponse } from "axios";
import { Login } from "./login";

export type User = {
  id: number;
  username: string;
  email: string;
  name: string;
  cover_picture: string;
  profile_picture: string;
  city: null | string;
};

export type AuthContextT = {
  user: User;
  ctxLogin: (data: Login) => Promise<AxiosResponse<User, any> | AxiosError<Login>>;
  ctxLogout: () => void;
  setCurrentUser: (user: User) => void;
};

export type UserChat<T> = {
  socketId: string;
  name: string;
  profilePic: string;
  userId: number;
  messages: T[];
};

export type Messages = {
  from: string;
  content: string;
};
