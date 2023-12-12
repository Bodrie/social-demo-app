import { db } from "../connect.js";
import jwt from "jsonwebtoken";
import moment from "moment";
import { KEY, NODE_ENV } from "../config.js";

export const getPosts = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token && NODE_ENV === "prod")
    return res.status(401).send("401 Unauthorized");

  jwt.verify(token, KEY, (err, user) => {
    if (err && NODE_ENV === "prod")
      return res.status(403).send("Invalid token!");

    const q = `
      SELECT DISTINCT
        p.id,
        created_at AS createdAt,
        user_id AS userId,
        image AS contentImg,
        description AS content,
        likes,
        u.name,
        profile_picture AS profilePic
      FROM posts AS p
      JOIN users AS u
      ON u.id = p.user_id
      LEFT JOIN relationships AS r
      ON p.user_id = r.followed_user_id
      WHERE r.follower_user_id = ? OR p.user_id = ?
      ORDER BY p.created_at DESC`;

    const userId = NODE_ENV === "prod" ? user.id : 8;

    db.query(q, [userId, userId], (err, data) => {
      if (err) {
        console.log("[SERVER LOG] Posts GET Error!");
        console.log(err);
        return res.status(500).send(err);
      }
      return res.status(200).send(data);
    });
  });
};

export const addPost = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token && NODE_ENV === "prod")
    return res.status(401).send("401 Unauthorized");

  jwt.verify(token, KEY, (err, user) => {
    if (err && NODE_ENV === "prod")
      return res.status(403).send("Invalid token!");

    const q = `INSERT INTO posts (description, image, user_id, created_at, likes) VALUES (?)`;

    const userId = NODE_ENV === "prod" ? user.id : 8;

    const values = [
      req.body.content,
      req.body.contentImg,
      userId,
      moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
      "",
    ];

    db.query(q, [values], (err, data) => {
      if (err) return res.status(500).send(err);
      return res.status(200).send("Post created!");
    });
  });
};

export const getUserPosts = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token && NODE_ENV === "prod")
    return res.status(401).send("401 Unauthorized");

  jwt.verify(token, KEY, (err, user) => {
    if (err && NODE_ENV === "prod")
      return res.status(403).send("Invalid token!");

    const q = `
      SELECT
        p.id,
        description AS content,
        image AS contentImg,
        likes,
        user_id as userId,
        created_at AS createdAt,
        profile_picture AS profilePic
      FROM posts AS p
      JOIN users AS u
      ON u.id = p.user_id
      WHERE user_id = ?
      ORDER BY p.created_at DESC`;

    db.query(q, [req.params.userId], (err, data) => {
      if (err) {
        console.log("[SERVER LOG] User Posts GET Error!");
        console.log(err);
        return res.status(500).send(err);
      }
      return res.status(200).send(data);
    });
  });
};
