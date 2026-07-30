const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const {
  createUploadedPlan,
  getUploadedPlans,
} = require("../controllers/uploadedPlanController");

const router = express.Router();
const uploadDir = path.join(__dirname, "../../uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.get("/", getUploadedPlans);
router.post("/", upload.single("planFile"), createUploadedPlan);

module.exports = router;
