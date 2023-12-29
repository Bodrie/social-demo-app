import express from "express";
import https from "https";
import http from "http";
import fs from "fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import commentRoutes from "./routes/comments.js";
import likeRoutes from "./routes/likes.js";
import uploadRoutes from "./routes/uploads.js";
import activitiesRoutes from "./routes/activities.js";
import relationshipsRoutes from "./routes/relationships.js";
import chalk from "chalk";
import {
  PORT_PROD,
  PORT_DEV,
  SOCKET_DEV,
  SOCKET_PROD,
  NODE_ENV,
} from "./config.js";
import { socketInit } from "./socket.js";

const PORT = NODE_ENV === "prod" ? PORT_PROD : PORT_DEV;
const SOCKET = NODE_ENV === "prod" ? SOCKET_PROD : SOCKET_DEV;

const options =
  NODE_ENV === "prod"
    ? {
        key: fs.readFileSync("ssl/pk.pem"),
        cert: fs.readFileSync("ssl/s.pem"),
      }
    : {};

const app = express();

socketInit(app, options, SOCKET, NODE_ENV);

app.use(
  cors({
    credentials: true,
    origin:
      NODE_ENV === "prod"
        ? "https://the-mesh.eu"
        : ["http://localhost:3000", "http://192.168.0.146:3000"],
  })
);

if (NODE_ENV === "dev") {
  http.createServer(app).listen(PORT, () => {
    console.log(
      chalk.blue(
        `\n[SERVER LOG] DEVELOPMENT ENV.\n[SERVER LOG] API is running on port ${PORT}\n`
      )
    );
  });
} else if (NODE_ENV === "prod") {
  https.createServer(app).listen(PORT, () => {
    console.log(
      chalk.blue(
        `\n[SERVER LOG] PRODUCTION ENV.\n[SERVER LOG] API is running on port ${PORT}\n`
      )
    );
  });
}

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  if (NODE_ENV === "dev")
    res.header(
      "Access-Control-Allow-Origin",
      "http://localhost:3000",
      "http://192.168.0.146:3000"
    );
  next();
});

app.use(express.json());

app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/relationships", relationshipsRoutes);
app.use("/api/upload", uploadRoutes);
