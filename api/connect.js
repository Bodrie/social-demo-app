import mysql from "mysql2";
import { HOST, USER, PASSWORD, DB } from "./config.js";

export const db = mysql.createConnection({
  host: HOST,
  user: USER,
  password: PASSWORD,
  database: DB,
});
