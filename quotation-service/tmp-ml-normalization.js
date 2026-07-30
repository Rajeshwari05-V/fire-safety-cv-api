const { buildNormalizedQuotationPayload } = require('./src/services/mlQuotationService');

(async () => {
  const result = await buildNormalizedQuotationPayload({
    projectName: 'Office Demo',
    equipment_recommendations: [
      { item: 'emergency_light', qty: 4 },
      { item: 'smoke_detector', qty: 2 },
      { item: 'fire_extinguisher_dry_powder', qty: 1 },
    ],
  });
  console.log(JSON.stringify(result, null, 2));
})();
