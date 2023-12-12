import { db } from "../connect.js";
import { NODE_ENV, KEY } from "../config.js";
import jwt from "jsonwebtoken";
import moment from "moment";

export const getComments = (req, res) => {
  const q = `SELECT 
                  c.*,
                  created_at AS createdAt,
                  user_id AS userId,
                  description AS content,
                  u.name,
                  profile_picture AS profilePic
              FROM comments AS c
              JOIN users AS u
              ON u.id = c.user_id
              WHERE c.post_id = ?
              ORDER BY c.created_at DESC`;

  db.query(q, [req.params.postId], (err, data) => {
    if (err) {
      console.log("[SERVER LOG] Comments GET Error!");
      console.log(err);
      return res.status(500).send(err);
    }
    return res.status(200).send(data);
  });
};

export const addComment = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token && NODE_ENV === "prod")
    return res.status(401).send("401 Unauthorized");

  jwt.verify(token, KEY, (err, user) => {
    if (err && NODE_ENV === "prod")
      return res.status(403).send("Invalid token!");

    const q = `INSERT INTO comments (description, created_at, user_id, post_id) VALUES (?)`;

    const userId = NODE_ENV === "prod" ? user.id : 8;

    const values = [
      req.body.content,
      moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
      userId,
      req.body.postId,
    ];

    db.query(q, [values], (err, data) => {
      if (err) return res.status(500).send(err);
      return res.status(200).send("Comment created!");
    });
  });
};

export const getCommentsCount = (req, res) => {
  const q = `SELECT comments.post_id AS postId FROM comments`;

  db.query(q, (err, data) => {
    if (err) {
      console.log("[SERVER LOG] Comments GET Error!");
      console.log(err);
      return res.status(500).send(err);
    }

    const count = {};
    const postIdsToArray = data.map((comment) => comment.postId);
    postIdsToArray.forEach((id) => {
      count[id] = (count[id] || 0) + 1;
    });

    return res.status(200).send(count);
  });
};
