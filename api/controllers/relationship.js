import { db } from "../connect.js";

export const getRelationships = (req, res) => {
  const q = `SELECT DISTINCT`;

  db.query(q, (err, data) => {
    if (err) {
      console.log("[SERVER LOG] Relationships GET Error!");
      console.log(err);
      return res.status(500).send(err);
    }
    return res.status(200).send(data);
  });
};

export const addRelationship = (req, res) => {
  const q = `INSERT INTO relationships () VALUES (?)`;

  const values = [req.body, req.body, userId];

  db.query(q, [values], (err, data) => {
    if (err) return res.status(500).send(err);
    return res.status(200).send("Relationship created!");
  });
};
