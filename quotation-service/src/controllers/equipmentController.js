const prisma = require("../config/prisma");

async function getEquipment(req, res) {
  try {
    const equipment = await prisma.equipment.findMany({
      orderBy: {
        id: "asc",
      },
    });

    res.json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    console.error("=== Equipment API Error ===");
    console.error(error);
    console.error("===========================");
    res.status(500).json({
      success: false,
      message: "Failed to fetch equipment",
      error: error.message,
    });
  }
}

async function createEquipment(req, res) {
  try {
    const { name, type, price, quantity } = req.body;

    if (!name || !type || Number(price) <= 0 || Number(quantity) < 0) {
      return res.status(400).json({
        success: false,
        message: "name, type, positive price, and quantity are required",
      });
    }

    const equipment = await prisma.equipment.create({
      data: {
        name,
        type,
        price: Number(price),
        quantity: Number(quantity),
      },
    });

    res.status(201).json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    console.error("=== Equipment API Error ===");
    console.error(error);
    console.error("===========================");
    res.status(500).json({
      success: false,
      message: "Failed to create equipment",
      error: error.message,
    });
  }
}

module.exports = {
  createEquipment,
  getEquipment,
};
