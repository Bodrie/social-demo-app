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
import { PORT, SOCKET, DOMAIN, NODE_ENV } from "./config.js";
import { socketInit } from "./socket.js";

const options =
  NODE_ENV === "prod"
    ? {
        key: fs.readFileSync("ssl/privkey.pem"),
        cert: fs.readFileSync("ssl/cert.pem"),
      }
    : {};

const app = express();

socketInit(app, options, SOCKET, NODE_ENV);

app.use(
  cors({
    credentials: true,
    origin: [DOMAIN],
  })
);

if (NODE_ENV === "dev") {
  http.createServer(app).listen(PORT, () => {
    console.log(
      `\n[SERVER LOG] DEVELOPMENT ENV.\n[SERVER LOG] API is running on port ${PORT}\n`
    );
  });
} else if (NODE_ENV === "prod") {
  https.createServer(options, app).listen(PORT, () => {
    console.log(
      `\n[SERVER LOG] PRODUCTION ENV.\n[SERVER LOG] API is running on port ${PORT}\n`
    );
  });
}

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  if (NODE_ENV === "dev") res.header("Access-Control-Allow-Origin", DOMAIN);
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
