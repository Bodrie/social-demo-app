import axios, { AxiosResponse } from "axios";
import { Register, Login } from "../types";

const API = process.env.REACT_APP_API;

const axiosInstance = axios.create({
  baseURL: API,
});

export const register = async (
  e: React.MouseEvent<HTMLButtonElement>,
  registerData: Register
) => {
  e.preventDefault();

  const response = await axiosInstance
    .post("/auth/register", registerData)
    .then((res: AxiosResponse) => {
      return res;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

// export const login = async (loginData: Login) => {
//   const response = await axios.post("/auth/login", loginData, {
//     withCredentials: true,
//   });

//   return response;
// };
