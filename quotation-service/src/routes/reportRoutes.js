const express = require("express");
const {
  createReport,
  downloadFireSafetyAssessmentPdf,
  getReports,
} = require("../controllers/reportController");

const router = express.Router();

router.get("/", getReports);
router.post("/", createReport);
router.get("/:id/pdf", downloadFireSafetyAssessmentPdf);

module.exports = router;
