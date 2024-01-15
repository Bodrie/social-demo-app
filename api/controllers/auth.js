import { db, createTenantConnection } from "../connect.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { KEY } from "../config.js";
import moment from "moment";
import { emailValidation } from "../utils/utils.js";

export const login = (req, res) => {
  console.log(
    `[SERVER LOG] User LOGIN initiated! ${moment(Date.now()).format(
      "HH:mm / DD-MM-YYYY"
    )}`
  );
  console.log(req);
  console.log(req.header('Origin'));
  console.log(req.headers.origin);
  console.log(req.subdomains);
  console.log(req.subdomains[0]);

  const db2 = createTenantConnection(req.subdomains[0]);
  const q = "SELECT * FROM users WHERE email = ?";

  let fields = {};

  db2.query(q, [req.body.email], (err, data) => {
    if (err) {
      console.log("[SERVER LOG] User LOGIN Error!");
      console.log(err);
      return res.status(500).send(err);
    }

    if (data.length === 0) {
      console.log("[SERVER LOG] User LOGIN Error!");
      console.log("[SERVER LOG] User not found!\n");
      fields.email = "User not found!";
    }

    if (!req.body.email.length) fields.email = "Email is required!";

    if (!req.body.password.length) fields.password = "Password is required!";

    if (Object.keys(fields).length) {
      return res.status(400).send(fields);
    }

    const checkPassword = bcrypt.compareSync(
      req.body.password,
      data[0].password
    );

    if (!checkPassword) {
      console.log("[SERVER LOG] User LOGIN Error!");
      console.log("[SERVER LOG] Wrong password or email!\n");
      fields.password = "Wrong password!";
      return res.status(400).send(fields);
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
        expires: new Date(Date.now() + oneWeek),
      })
      .send(user);
  });
};

export const register = (req, res) => {
  console.log(req);
  console.log(req.header('Origin'));
  console.log(req.headers.origin);
  console.log(req.subdomains);
  console.log(req.subdomains[0]);

  const db2 = createTenantConnection(req.subdomains[0]);
  const q = "SELECT * FROM users WHERE email = ?";
  let fields = {};
  db2.query(q, [req.body.email], (err, data) => {
    if (err) return res.status(500).send({ error: err, code: 500 });

    if (data.length) fields.email = "User already registred!";

    if (!emailValidation(req.body.email))
      fields.email = "This email does not look right.";

    if (!req.body.email.length) fields.email = "Email is required!";

    if (!req.body.username.length) fields.username = "Username is required!";

    if (!req.body.name.length) fields.name = "Name is required!";

    if (req.body.password.length < 6)
      fields.password = "Password must be at least 6 characters long!";

    if (Object.keys(fields).length) {
      return res.status(400).send(fields);
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(req.body.password, salt);

    const values = [
      req.body.username,
      req.body.email,
      hashedPassword,
      req.body.name,
    ];

    const q = "INSERT INTO users (username, email, password, name) VALUE (?)";
    db2.query(q, [values], (err, data) => {
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
