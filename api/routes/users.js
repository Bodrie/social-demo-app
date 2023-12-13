import express from "express";
import { getUser, getAllUsers } from "../controllers/user.js";

const router = express.Router();

router.get("/:userId", getUser);
router.get("/all", getAllUsers);

export default router;
