import axios, { AxiosResponse } from "axios";
import { Register, Login } from "../types";

const API = process.env.REACT_APP_API;

const makeRequest = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const register = (
  e: React.MouseEvent<HTMLButtonElement>,
  registerData: Register
) => {
  e.preventDefault();

  const response = makeRequest
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
  const response = makeRequest
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

export const logout = () => {
  const response = makeRequest
    .post("/auth/logout")
    .then((res) => {
      return res;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const getPosts = () => {
  const response = makeRequest
    .get("/posts")
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};
