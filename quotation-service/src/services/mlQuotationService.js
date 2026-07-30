const {
  normalizeMlEquipmentName,
  resolveEquipmentByName,
} = require("./equipmentMapping");

function buildRecommendedEquipmentItems(payload = {}) {
  if (Array.isArray(payload.recommendedEquipment) && payload.recommendedEquipment.length > 0) {
    return payload.recommendedEquipment.map((item) => ({
      equipmentName: normalizeMlEquipmentName(item.equipmentName || item.name || item.item),
      quantity: Number(item.quantity || item.qty || 1),
    }));
  }

  const officeRecommendations = Array.isArray(payload.equipment_recommendations)
    ? payload.equipment_recommendations
    : [];

  if (officeRecommendations.length > 0) {
    return officeRecommendations.map((item) => ({
      equipmentName: normalizeMlEquipmentName(item.item || item.name || item.equipmentName),
      quantity: Number(item.qty || item.quantity || 1),
    }));
  }

  const detections = Array.isArray(payload.detections) ? payload.detections : [];
  const counts = new Map();

  detections.forEach((detection) => {
    const equipmentName = normalizeMlEquipmentName(String(detection?.type || ""));

    if (!equipmentName) {
      return;
    }

    counts.set(equipmentName, (counts.get(equipmentName) || 0) + 1);
  });

  return Array.from(counts.entries()).map(([equipmentName, quantity]) => ({
    equipmentName,
    quantity,
  }));
}

async function buildNormalizedQuotationPayload(payload = {}) {
  const derivedItems = buildRecommendedEquipmentItems(payload);

  if (!Array.isArray(derivedItems) || derivedItems.length === 0) {
    return {
      success: false,
      items: [],
      message: "No recommended equipment could be derived from the ML result",
    };
  }

  const equipmentNames = derivedItems.map((item) => item.equipmentName);
  const equipmentList = await resolveEquipmentByName(equipmentNames);
  
  console.log("Equipment names from ML:", equipmentNames);
  console.log("Equipment found in DB:", equipmentList);

  const equipmentByName = new Map(
    equipmentList.map((equipment) => [equipment.name, equipment])
  );

  const normalizedItems = derivedItems.map((item) => {
    const equipment = equipmentByName.get(item.equipmentName);

    return {
      equipmentName: item.equipmentName,
      quantity: Number(item.quantity || 1),
      equipmentId: equipment ? equipment.id : null,
      unitPrice: equipment ? equipment.price : null,
    };
  });

  return {
    success: true,
    items: normalizedItems,
    source: payload,
  };
}

module.exports = {
  buildNormalizedQuotationPayload,
  buildRecommendedEquipmentItems,
};
