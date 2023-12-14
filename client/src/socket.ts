//@ts-nocheck
import { io } from "socket.io-client";

// "undefined" means the URL will be computed from the `window.location` object
const SOCKET = process.env.REACT_APP_SOCKET;
const URL = process.env.NODE_ENV === 'production' ? SOCKET : 'http://localhost:10001';

export const socket = io(URL);
