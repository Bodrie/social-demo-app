import { Login } from "./login";

export type User = {
  id: number;
  username: string | null;
  email: string;
  name: string;
  cover_picture: null | string;
  profile_picture: null | string;
  city: null | string;
} | null;

export type AuthContextT = {
  user: User;
  login: (data: Login) => void;
} | null;
