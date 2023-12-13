import express from "express";
import {
  getRelationships,
  addRelationship,
} from "../controllers/relationship.js";

const router = express.Router();

router.get("/", getRelationships);
router.post("/", addRelationship);

export default router;
