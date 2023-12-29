import { config } from "dotenv";

config({ path: "./.env.local" });

export const {
  HOST,
  USER,
  PASSWORD,
  DB,
  KEY,
  PORT,
  SOCKET,
  DOMAIN,
  NODE_ENV,
} = process.env;
