import { db } from "../connect.js";

export const addLike = (req, res) => {
  const q = "UPDATE posts SET likes=CONCAT(likes,'?,') WHERE id = ?";

  db.query(q, [req.body.userId, req.body.postId], (err, data) => {
    if (err) return res.status(500).send(err);
    return res.status(200).send(data);
  });
};

export const removeLike = (req, res) => {
  const q = "UPDATE posts SET likes=REPLACE(likes, '?,', '') WHERE id = ?";

  db.query(q, [req.body.userId, req.body.postId], (err, data) => {
    if (err) return res.status(500).send(err);
    return res.status(200).send(data);
  });
};
