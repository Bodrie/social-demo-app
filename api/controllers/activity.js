import { db } from "../connect.js";
import moment from "moment";

export const getActivities = (req, res) => {
  const q = `
    SELECT
        la.user,
        la.activity,
        la.profile_picture AS profilePic,
        la.created_at AS createdAt
    FROM latest_activities AS la
    JOIN relationships AS r
    ON la.user_id = r.followed_user_id
    WHERE r.follower_user_id = ?
    ORDER BY la.created_at DESC`;

  db.query(q, [req.params.userId], (err, data) => {
    if (err) {
      console.log("[SERVER LOG] Activities GET Error!");
      console.log(err);
      return res.status(500).send(err);
    }
    return res.status(200).send(data);
  });
};

export const addActivity = (req, res) => {
  const q = `INSERT INTO latest_activities (user, profile_picture, activity, created_at, user_id) VALUES (?)`;

  const values = [
    req.body.user,
    req.body.profilePic,
    req.body.activity,
    moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
    req.body.userId,
  ];

  db.query(q, [values], (err, data) => {
    if (err) return res.status(500).send(err);
    return res.status(200).send("Activity created!");
  });
};
