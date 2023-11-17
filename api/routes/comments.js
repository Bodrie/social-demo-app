import express from "express";
import { getComment } from "../controllers/comment.js";

const router = express.Router();

router.get("/:commentId", getComment);

export default router;