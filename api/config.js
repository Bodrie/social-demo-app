import { config } from "dotenv";

config({ path: "./.env.local" });

process.argv.forEach((val, idx, arr) => {
  if (idx === 2) console.log(val, " : ", idx);
});

export const {
  HOST,
  USER,
  PASSWORD,
  DB,
  KEY,
  PORT,
  SOCKET,
  DOMAINS,
  NODE_ENV,
} = process.env;
