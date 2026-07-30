const express = require("express");
const {
  createEquipment,
  getEquipment,
} = require("../controllers/equipmentController");

const router = express.Router();

router.get("/", getEquipment);
router.post("/", createEquipment);

module.exports = router;
