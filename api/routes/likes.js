import express from "express";
import { addLike, removeLike } from "../controllers/like.js";

const router = express.Router();

router.post("/like", addLike);
router.post("/dislike", removeLike);

export default router;