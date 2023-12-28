import express from "express";
import { getUser, getAllUsers, updateUser } from "../controllers/user.js";

const router = express.Router();

router.get("/all", getAllUsers);
router.get("/:userId", getUser);
router.patch("/", updateUser)

export default router;
