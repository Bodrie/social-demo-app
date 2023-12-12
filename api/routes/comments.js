import express from "express";
import {
  getComments,
  addComment,
  getCommentsCount,
} from "../controllers/comment.js";

const router = express.Router();

router.get("/count", getCommentsCount);
router.get("/:postId", getComments);
router.post("/", addComment);

export default router;
