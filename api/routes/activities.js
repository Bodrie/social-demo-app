import express from "express";
import { getActivities, addActivity } from "../controllers/activity.js";

const router = express.Router();

router.get("/:userId", getActivities);
router.post("/", addActivity);

export default router;
