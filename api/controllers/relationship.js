import { db } from "../connect.js";
import jwt from "jsonwebtoken";
import { KEY } from "../config.js";

export const getRelationships = (req, res) => {
  const q =
    "SELECT follower_user_id FROM relationships WHERE followed_user_id = ?";

  db.query(q, [req.params.userId], (err, data) => {
    if (err) return res.status(500).json(err);
    return res
      .status(200)
      .json(data.map((relationship) => relationship.follower_user_id));
  });
};

export const addRelationship = (req, res) => {
  const q = `INSERT INTO relationships (follower_user_id, followed_user_id) VALUES (?)`;

  const values = [req.body.currUserId, req.body.foreignUserId];

  db.query(q, [values], (err, data) => {
    if (err) return res.status(500).send(err);
    return res.status(200).send("Relationship created!");
  });
};

export const deleteRelationship = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json("Not logged in!");

  jwt.verify(token, KEY, (err, user) => {
    if (err) return res.status(403).json("Token is not valid!");

    const q =
      "DELETE FROM relationships WHERE follower_user_id = ? AND followed_user_id = ?";

    db.query(q, [user.id, req.query.id], (err, data) => {
      if (err) return res.status(500).json(err);
      return res.status(200).json("Unfollow");
    });
  });
};
