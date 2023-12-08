import { db } from "../connect.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { KEY } from "../config.js";

export const login = (req, res) => {
  console.log("[SERVER LOG] User LOGIN initiated!");
  const q = "SELECT * FROM users WHERE email = ?";
  db.query(q, [req.body.email], (err, data) => {
    if (err) {
      console.log("[SERVER LOG] User LOGIN Error!");
      console.log(err);
      return res.status(500).send(err);
    }
    if (data.length === 0) {
      console.log("[SERVER LOG] User LOGIN Error!");
      console.log("[SERVER LOG] User not found!\n");
      return res.status(404).send("User not found!");
    }

    const checkPassword = bcrypt.compareSync(
      req.body.password,
      data[0].password
    );

    if (!checkPassword) {
      console.log("[SERVER LOG] User LOGIN Error!");
      console.log("[SERVER LOG] Wrong password or email!\n");
      return res.status(400).send("Wrong password or email!");
    }

    const token = jwt.sign({ id: data[0].id }, KEY);

    const { password, ...user } = data[0];

    console.log("[SERVER LOG] User LOGIN successful!\n");
    res
      .status(200)
      .cookie("accessToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      })
      .send({ user, token });
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
      console.log("[SERVER LOG] User REGISTER");
      return res.status(200).send("Succsessful registration");
    });
  });
};

export const logout = (req, res) => {
  console.log("[SERVER LOG] User LOGOUT");
  res
    .clearCookie("accessToken", { secure: true, sameSite: "none" })
    .status(200)
    .send("Succsessful logout!");
};
