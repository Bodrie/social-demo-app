import { db } from "../connect.js";
import { KEY } from "../config.js";
import jwt from "jsonwebtoken";

export const getUser = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).send("401 Unauthorized");

  jwt.verify(token, KEY, (err, user) => {
    if (err) return res.status(403).send("Invalid token!");

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

export const updateUser = (req, res) => {
  // TO DO: Find a way to create query only for the changed fields;

  const q = `
    UPDATE users SET
      username = ?,
      name = ?,
      email = ?,
      profile_picture = ?,
      cover_picture = ?,
      city = ?
    WHERE id = ?`;

  // TO DO: Find a way to pass only the changed fields;

  const values = [
    req.body.username,
    req.body.name,
    req.body.email,
    req.body.profile_picture,
    req.body.cover_picture,
    req.body.city,
    req.body.id,
  ];

  db.query(q, [...values], (err, data) => {
    if (err) {
      console.log("[SERVER LOG] User UPDATE Error!");
      console.log(err);
      return res.status(500).send(err);
    }
    return res.status(200).send(data);
  });
};
