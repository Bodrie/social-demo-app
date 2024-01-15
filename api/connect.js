import mysql from "mysql2";
import { HOST, USER, PASSWORD, DB } from "./config.js";

export const db = mysql.createConnection({
  host: HOST,
  user: USER,
  password: PASSWORD,
  database: DB,
});

export const createTenantConnection = (tenantID) => {
  console.log(tenantID, 'createTenantConnection FUNC');
  const db2 = mysql.createConnection({
    host: HOST,
    user: USER,
    password: PASSWORD,
    database: tenantID,
  });

  return db2
};
