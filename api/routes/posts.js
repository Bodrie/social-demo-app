import express from "express";
import { getPost } from "../controllers/post.js";

const router = express.Router();

router.post("/", getPost);

export default router;
