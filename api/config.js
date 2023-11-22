import { config } from "dotenv";

config({ path: "./.env.local" });
export const { HOST, USER, PASSWORD, DB, KEY, PORT } = process.env;