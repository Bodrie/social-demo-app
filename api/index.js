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
import chalk from "chalk";
import { PORT_PROD, PORT_DEV, NODE_ENV } from "./config.js";

const options =
  NODE_ENV === "prod"
    ? {
        key: fs.readFileSync("ssl/pk.pem"),
        cert: fs.readFileSync("ssl/s.pem"),
      }
    : {};

const PORT = NODE_ENV === "prod" ? PORT_PROD : PORT_DEV;

const app = express();

if (NODE_ENV === "dev") {
  http.createServer(app).listen(PORT, () => {
    console.log(
      chalk.blue(
        `\n[SERVER LOG] DEVELOPMENT ENV.\n[SERVER LOG] API is running on port ${PORT}\n`
      )
    );
  });
} else if (NODE_ENV === "prod") {
  https.createServer(options, app).listen(PORT, () => {
    console.log(
      chalk.blue(
        `\n[SERVER LOG] PRODUCTION ENV.\n[SERVER LOG] API is running on port ${PORT}\n`
      )
    );
  });
}

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  next();
});
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: ["https://social-demo-app.vercel.app", "http://localhost:3000"],
    exposedHeaders: ["set-cookie"],
  })
);
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/likes", likeRoutes);
