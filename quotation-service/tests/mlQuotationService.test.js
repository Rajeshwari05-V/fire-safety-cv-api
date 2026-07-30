const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRecommendedEquipmentItems } = require("../src/services/mlQuotationService");

test("buildRecommendedEquipmentItems maps ML detections into quotation items", () => {
  const items = buildRecommendedEquipmentItems({
    projectName: "Test Project",
    detections: [
      { type: "smoke_detector", confidence: 0.95 },
      { type: "fire_extinguisher", confidence: 0.91 },
      { type: "smoke_detector", confidence: 0.88 },
    ],
  });

  assert.deepEqual(items, [
    { equipmentName: "Smoke Detector", quantity: 2 },
    { equipmentName: "Fire Extinguisher", quantity: 1 },
  ]);
});

test("buildRecommendedEquipmentItems preserves explicit recommendedEquipment input", () => {
  const items = buildRecommendedEquipmentItems({
    projectName: "Test Project",
    recommendedEquipment: [
      { equipmentName: "Sprinkler System", quantity: 3 },
    ],
  });

  assert.deepEqual(items, [
    { equipmentName: "Sprinkler System", quantity: 3 },
  ]);
});
