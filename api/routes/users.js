import express from "express";
import {
  getUser,
  getAllUsers,
  updateUser,
  getSuggestions,
} from "../controllers/user.js";

const router = express.Router();

router.get("/suggestions", getSuggestions);
router.get("/all", getAllUsers);
router.get("/:userId", getUser);
router.patch("/", updateUser);

export default router;
