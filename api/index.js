import { Express } from "express";

const app = Express();
const PORT = 8000;

app.listen(PORT, () => {
  console.log(`[SERVER LOG] API is running on port ${PORT}`);
});
