import { db } from "../connect.js";
import jwt from "jsonwebtoken";
import { KEY } from "../config.js";

export const getPost = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).send("Not logged in!");
  jwt.verify(token, KEY, (err, user) => {
    if (err) return res.status(403).send("Invalid token!");

    const q = `SELECT 
                  p.id,
                  created_at AS createdAt,
                  user_id AS userId,
                  image AS contentImg,
                  description AS content,
                  u.name,
                  profile_picture AS profilePic
              FROM posts AS p
              JOIN users AS u
              ON u.id = p.user_id
              LEFT JOIN relationships AS r
              ON p.user_id = r.followed_user_id
              WHERE r.follower_user_id = ? OR p.user_id = ?
              ORDER BY p.created_at DESC`;

    db.query(q, [user.id, user.id], (err, data) => {
      if (err) {
        console.log("[SERVER LOG] Posts GET Error!");
        console.log(err);
        return res.status(500).send(err);
      }
      return res.status(200).send(data);
    });
  });
};
