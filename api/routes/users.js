import express from "express";
import { getUser, getAllUsers } from "../controllers/user.js";

const router = express.Router();

router.get("/all", getAllUsers);
router.get("/:userId", getUser);

export default router;
