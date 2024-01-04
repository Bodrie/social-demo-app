import { db } from "../connect.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { KEY } from "../config.js";
import moment from "moment";

export const login = (req, res) => {
  console.log(
    `[SERVER LOG] User LOGIN initiated! ${moment(Date.now()).format(
      "HH:mm / DD-MM-YYYY"
    )}`
  );
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
      return res.status(404).send({ error: "User not found!", code: 404 });
    }

    const checkPassword = bcrypt.compareSync(
      req.body.password,
      data[0].password
    );

    if (!checkPassword) {
      console.log("[SERVER LOG] User LOGIN Error!");
      console.log("[SERVER LOG] Wrong password or email!\n");
      return res
        .status(400)
        .send({ error: "Wrong password or email!", code: 400 });
    }

    const token = jwt.sign({ id: data[0].id }, KEY);

    const { password, ...user } = data[0];

    console.log("[SERVER LOG] User LOGIN successful!\n");

    const oneWeek = 7 * 24 * 3600 * 1000;
    res
      .status(200)
      .cookie("accessToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none", // For now, but unsafe...
        expires: new Date(Date.now() + oneWeek),
      })
      .send(user);
  });
};

export const register = (req, res) => {
  const q = "SELECT * FROM users WHERE username = ?";
  db.query(q, [req.body.username], (err, data) => {
    if (err) return res.status(500).send({ error: err, code: 500 });
    if (data.length)
      return res
        .status(409)
        .send({ error: "User already registred!", code: 409 });

    if (req.body.password.length < 6)
      return res
        .status(400)
        .send({ error: "Password must be at least 6 characters long!", code: 400 });

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
      if (err) return res.status(500).send({ error: err, code: 500 });
      console.log(
        `[SERVER LOG] User REGISTER ${moment(Date.now()).format(
          "HH:mm / DD-MM-YYYY"
        )}`
      );
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
