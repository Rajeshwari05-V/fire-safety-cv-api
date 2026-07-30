const prisma = require("../config/prisma");

const INSTALLATION_RATE = 0.1;
const MAINTENANCE_RATE = 0.05;
const GST_RATE = 0.18;

function roundMoney(value) {
  return Number(value.toFixed(2));
}

async function calculateQuotation(input) {
  const items = Array.isArray(input)
    ? input
    : Array.isArray(input?.items)
      ? input.items
      : [];

  const mergedItems = new Map();

  items.forEach((item) => {
    const equipmentId = Number(item.equipmentId ?? item.id);
    const quantity = Number(item.quantity ?? item.qty ?? 1);

    if (!Number.isFinite(equipmentId) || equipmentId <= 0) {
      return;
    }

    if (mergedItems.has(equipmentId)) {
      mergedItems.get(equipmentId).quantity += quantity;
    } else {
      mergedItems.set(equipmentId, {
        equipmentId,
        quantity,
      });
    }
  });

  const normalizedItems = Array.from(mergedItems.values());
  const equipmentIds = normalizedItems.map((item) => item.equipmentId);

  if (equipmentIds.length === 0) {
    return {
      equipmentCost: 0,
      installationCost: 0,
      maintenanceCost: 0,
      gst: 0,
      totalCost: 0,
      breakdown: [],
    };
  }

  const equipmentList = await prisma.equipment.findMany({
    where: {
      id: {
        in: equipmentIds,
      },
    },
  });

  if (equipmentList.length !== equipmentIds.length) {
    const foundIds = new Set(equipmentList.map((equipment) => equipment.id));
    const missingIds = equipmentIds.filter((id) => !foundIds.has(id));
    throw new Error(`Equipment not found for ID(s): ${missingIds.join(", ")}`);
  }

  const breakdown = normalizedItems.map((item) => {
    const equipment = equipmentList.find(
      (entry) => entry.id === item.equipmentId
    );
    const itemTotal = equipment.price * item.quantity;

    return {
      equipmentId: equipment.id,
      name: equipment.name,
      type: equipment.type,
      unitPrice: equipment.price,
      quantity: item.quantity,
      itemTotal: roundMoney(itemTotal),
    };
  });

  const equipmentCost = breakdown.reduce(
    (total, item) => total + item.itemTotal,
    0
  );
  const installationCost = equipmentCost * INSTALLATION_RATE;
  const maintenanceCost = equipmentCost * MAINTENANCE_RATE;
  const taxableAmount = equipmentCost + installationCost + maintenanceCost;
  const gst = taxableAmount * GST_RATE;
  const totalCost = taxableAmount + gst;

  return {
    equipmentCost: roundMoney(equipmentCost),
    installationCost: roundMoney(installationCost),
    maintenanceCost: roundMoney(maintenanceCost),
    gst: roundMoney(gst),
    totalCost: roundMoney(totalCost),
    breakdown,
  };
}

module.exports = {
  calculateQuotation,
};
