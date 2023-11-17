import { db } from "../connect.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { KEY } from "../config.js";

export const login = (req, res) => {
  const q = "SELECT * FROM users WHERE email = ?";
  db.query(q, [req.body.email], (err, data) => {
    if (err) return res.status(500).send(err);
    if (data.length === 0) return res.status(404).send("User not found!");

    const checkPassword = bcrypt.compareSync(
      req.body.password,
      data[0].password
    );

    if (!checkPassword) return res.status(400).send("Wrong password or email!");

    const token = jwt.sign({ id: data[0].id }, KEY);

    const { password, ...rest } = data[0];

    res
      .cookie("accessToken", token, {
        httpOnly: true,
      })
      .status(200)
      .send(rest);
  });
};

export const register = (req, res) => {
  const q = "SELECT * FROM users WHERE username = ?";
  db.query(q, [req.body.username], (err, data) => {
    if (err) return res.status(500).send(err);
    if (data.length) return res.status(409).send("User already registred!");

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(req.body.password, salt);

    const q = "INSERT INTO users (username, email, password, name) VALUE (?)";
    const values = [
      req.body.username,
      req.body.email,
      hashedPassword,
      req.body.name,
    ];
    db.query(q, [values], (err, data) => {
      if (err) return res.status(500).send(err);
      return res.status(200).send("Succsessful registration");
    });
  });
};

export const logout = (req, res) => {
  res
    .clearCookie("accessToken", { secure: true, sameSite: "none" })
    .status(200)
    .send("Succsessful logout!");
};
