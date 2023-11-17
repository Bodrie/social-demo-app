import Express from "express";
import userRoutes from "./routes/users.js";
import chalk from "chalk";

const app = Express();
const PORT = 8000;

app.listen(PORT, () => {
  console.log(chalk.blue(`\n[SERVER LOG] API is running on port ${PORT}\n`));
});

app.use("/api/users", userRoutes);
