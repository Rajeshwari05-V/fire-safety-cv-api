const express = require("express");
const { processMlResult } = require("../controllers/mlController");

const router = express.Router();

router.post("/process-result", processMlResult);

module.exports = router;
