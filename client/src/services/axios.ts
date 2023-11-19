import axios, { AxiosResponse } from "axios";
import { Register, Login } from "../types";

const API = process.env.REACT_APP_API;

const axiosInstance = axios.create({
  baseURL: API,
});

export const register = (
  e: React.MouseEvent<HTMLButtonElement>,
  registerData: Register
) => {
  e.preventDefault();

  const response = axiosInstance
    .post("/auth/register", registerData)
    .then((res: AxiosResponse) => {
      return res;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const login = (loginData: Login) => {
  const response = axiosInstance
    .post("/auth/login", loginData, {
      withCredentials: true,
    })
    .then((res: AxiosResponse) => {
      return res;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};
