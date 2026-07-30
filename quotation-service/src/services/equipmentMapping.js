const prisma = require("../config/prisma");

const EQUIPMENT_MAPPING = {
  smoke_detector: "Smoke Detector",
  fire_extinguisher: "Fire Extinguisher",
  fire_extinguisher_dry_powder: "Fire Extinguisher",
  sprinkler: "Sprinkler Head",
  sprinkler_pendant_concealed: "Sprinkler Head",
  alarm: "Fire Alarm Panel",
  hose_reel: "Fire Extinguisher",

  emergency_light: "Emergency Light",
  exit_sign: "Exit Sign",
  fire_alarm_panel: "Fire Alarm Panel",
  zone_control_valve: "Zone Control Valve",
};

function normalizeMlEquipmentName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return EQUIPMENT_MAPPING[normalized] || trimmed;
}

async function resolveEquipmentByName(equipmentNames) {
  const uniqueNames = [...new Set(equipmentNames.filter(Boolean))];

  if (uniqueNames.length === 0) {
    return [];
  }

  const equipmentList = await prisma.equipment.findMany({
    where: {
      name: {
        in: uniqueNames,
      },
    },
  });

  return equipmentList;
}

module.exports = {
  EQUIPMENT_MAPPING,
  normalizeMlEquipmentName,
  resolveEquipmentByName,
};
