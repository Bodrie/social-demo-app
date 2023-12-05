import { Login } from "./login";

export type User = {
  id: number;
  username: string;
  email: string;
  name: string;
  cover_picture: string;
  profile_picture: string;
  city: null | string;
} | null;

export type AuthContextT = {
  user: User;
  ctxLogin: (data: Login) => Promise<string>;
} | null;
