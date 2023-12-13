import { db } from "../connect.js";
import { NODE_ENV, KEY } from "../config.js";
import jwt from "jsonwebtoken";

export const getUser = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token && NODE_ENV === "prod")
    return res.status(401).send("401 Unauthorized");

  jwt.verify(token, KEY, (err, user) => {
    if (err && NODE_ENV === "prod")
      return res.status(403).send("Invalid token!");

    const q = `SELECT * FROM users WHERE id = ?`;
    db.query(q, [req.params.userId], (err, data) => {
      if (err) {
        console.log("[SERVER LOG] User GET Error!");
        console.log(err);
        return res.status(500).send(err);
      }
      if (data.length === 0) {
        console.log("[SERVER LOG] User not found!\n");
        return res.status(404).send("User not found!");
      }
      return res.status(200).send(data);
    });
  });
};

export const getAllUsers = (req, res) => {
  const q = `SELECT u.* FROM users AS u ORDER BY u.id DESC`;

  db.query(q, (err, data) => {
    if (err) {
      console.log("[SERVER LOG] User GET Error!");
      console.log(err);
      return res.status(500).send(err);
    }
    return res.status(200).send(data);
  });
};
