import express from "express";
import multer from "multer";
import { uploadImage, getImage } from "../controllers/upload.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "../api/upload/images");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + file.originalname);
  },
});

const upload = multer({ storage: storage });

router.post("/", upload.single("file"), uploadImage);
router.get("/:id", getImage);

export default router;
