const { calculateQuotation } = require("../services/pricingService");
const { buildNormalizedQuotationPayload } = require("../services/mlQuotationService");
const { createQuotationRecord } = require("./quotationController");
const { validateItems } = require("../utils/validation");

async function processMlResult(req, res) {
  try {
    const { projectName, recommendedEquipment, detections, equipment_recommendations } = req.body;

    if (!projectName || typeof projectName !== "string" || projectName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "projectName is required",
      });
    }

    const normalizedQuotation = await buildNormalizedQuotationPayload({
      projectName,
      recommendedEquipment,
      detections,
      equipment_recommendations,
    });

    if (!normalizedQuotation.success || !Array.isArray(normalizedQuotation.items) || normalizedQuotation.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: normalizedQuotation.message || "No recommended equipment could be derived from the ML result",
      });
    }

    const validationError = validateItems(
      normalizedQuotation.items.map((item) => ({
        equipmentId: item.equipmentId,
        quantity: Number(item.quantity || 1),
      }))
    );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const totals = await calculateQuotation(normalizedQuotation);
    const persistedQuotation = await createQuotationRecord({
      projectName,
      totals,
      mlPayload: {
        ...req.body,
        equipment_recommendations: equipment_recommendations || [],
        review_flags: req.body.review_flags || [],
        rule_refs: req.body.rule_refs || [],
        client_id: req.body.client_id || null,
        building_type: req.body.building_type || null,
        compliance_standard: req.body.compliance_standard || null,
        compliance_score: req.body.compliance_score || null,
        reportDate: req.body.reportDate || new Date().toISOString(),
        engineerRemarks: req.body.engineerRemarks || undefined,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        projectName,
        normalizedItems: normalizedQuotation.items,
        derivedEquipment: normalizedQuotation.items.map((item) => ({
          equipmentName: item.equipmentName,
          quantity: Number(item.quantity || 1),
        })),
        quotation: persistedQuotation.quotation,
        report: persistedQuotation.report,
        breakdown: persistedQuotation.breakdown,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process ML result",
      error: error.message,
    });
  }
}

module.exports = {
  processMlResult,
};