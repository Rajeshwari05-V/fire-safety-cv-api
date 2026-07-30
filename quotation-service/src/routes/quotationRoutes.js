const express = require("express");
const {
  calculateQuotationPreview,
  createQuotation,
  downloadQuotationPdf,
  getQuotationById,
  getQuotations,
} = require("../controllers/quotationController");

const router = express.Router();

router.post("/calculate", calculateQuotationPreview);
router.post("/", createQuotation);

router.get("/", getQuotations);

router.get("/:id/pdf", downloadQuotationPdf);


router.get("/:id", getQuotationById);

module.exports = router;

module.exports = router;
