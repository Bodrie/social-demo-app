
import { io } from "socket.io-client";

const SOCKET = process.env.REACT_APP_SOCKET || "http://localhost:10001";
const URL =
  process.env.NODE_ENV === "production" ? SOCKET : "http://localhost:10001";

export const socket = io(URL, { autoConnect: false });

socket.onAny((event, ...args) => {
  // console.log(event, args);
});
