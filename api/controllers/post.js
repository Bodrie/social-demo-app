import { db } from "../connect.js";

export const getPost = (req, res) => {
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
            ON u.id = p.user_id`;

  db.query(q, (err, data) => {
    if (err) {
      console.log("[SERVER LOG] Posts GET Error!");
      console.log(err);
      return res.status(500).send(err);
    }
    return res.status(200).send(data);
  });
};
