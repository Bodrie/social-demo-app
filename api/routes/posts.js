import express from "express";
import { getPosts, addPost, getUserPosts } from "../controllers/post.js";

const router = express.Router();

router.get("/", getPosts);
router.get("/user/:userId", getUserPosts);
router.post("/", addPost);

export default router;
