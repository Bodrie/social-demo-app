import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import commentRoutes from "./routes/comments.js";
import likeRoutes from "./routes/likes.js";
import chalk from "chalk";

const app = express();
const PORT = 8000;

app.use(express.json());
app.use(cors());
app.use(cookieParser())

app.listen(PORT, () => {
  console.log(chalk.blue(`\n[SERVER LOG] API is running on port ${PORT}\n`));
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/likes", likeRoutes);
