import { db } from "../connect.js";

export const getUser = (req, res) => {
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
};
