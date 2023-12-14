import { config } from "dotenv";

config({ path: "./.env.local" });

export const {
  HOST,
  USER,
  PASSWORD,
  DB,
  KEY,
  PORT_PROD,
  PORT_DEV,
  SOCKET_DEV,
  SOCKET_PROD,
  NODE_ENV,
} = process.env;
