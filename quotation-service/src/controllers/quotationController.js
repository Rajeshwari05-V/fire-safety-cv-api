const PDFDocument = require("pdfkit");
const prisma = require("../config/prisma");
const { calculateQuotation } = require("../services/pricingService");
const {
  parseBreakdownFromDescription,
  writeQuotationPdf,
  writeTaxInvoicePdf,
} = require("../services/pdfService");
const { buildReportDescription, buildReportMetadata, buildReportTextDescription } = require("../services/reportService");
const { parseIdParam, validateItems } = require("../utils/validation");

async function createQuotationRecord({ projectName, totals, mlPayload }) {
  const quotation = await prisma.$transaction(async (tx) => {
    const createdQuotation = await tx.quotation.create({
      data: {
        projectName,
        equipmentCost: totals.equipmentCost,
        installationCost: totals.installationCost,
        gst: totals.gst,
        maintenanceCost: totals.maintenanceCost,
        totalCost: totals.totalCost,
        breakdown: totals.breakdown,
      },
    });

    const reportData = buildReportDescription(
      {
        ...createdQuotation,
        projectName,
        breakdown: totals.breakdown,
      },
      {
        projectName,
        clientId: mlPayload?.client_id || mlPayload?.clientId || createdQuotation.id,
        buildingType: mlPayload?.building_type || mlPayload?.buildingType || null,
        complianceStandard: mlPayload?.compliance_standard || mlPayload?.complianceStandard || null,
        rulesConfigured: mlPayload?.rules_configured || mlPayload?.rulesConfigured || [],
        complianceScore: mlPayload?.compliance_score || mlPayload?.complianceScore || null,
        reportDate: mlPayload?.reportDate || createdQuotation.createdAt,
        equipmentRecommendations: mlPayload?.equipment_recommendations || mlPayload?.equipmentRecommendations || [],
        reviewFlags: mlPayload?.review_flags || mlPayload?.reviewFlags || [],
        ruleReferences: mlPayload?.rule_refs || mlPayload?.ruleReferences || [],
        engineerRemarks: mlPayload?.engineerRemarks || `Assessment prepared for ${projectName}. Review the proposed equipment coverage before final approval.`,
      }
    );

    await tx.report.create({
      data: {
        reportName: `Quotation Report - ${projectName}`,
        description: `${buildReportTextDescription(reportData)}\n${buildReportMetadata(reportData)}`,
        quotation: {
          connect: {
            id: createdQuotation.id,
          },
        },
      },
    });

    return createdQuotation;
  });

  const report = await prisma.report.findFirst({
    where: {
      quotationId: quotation.id,
    },
  });

  return {
    quotation,
    report,
    breakdown: totals.breakdown,
  };
}

async function calculateQuotationPreview(req, res) {
  try {
    const { projectName, items } = req.body;

    if (!projectName || typeof projectName !== "string" || projectName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "projectName is required",
      });
    }

    const validationError = validateItems(items);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const quotation = await calculateQuotation(items);

    res.json({
      success: true,
      data: {
        projectName,
        ...quotation,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function createQuotation(req, res) {
  try {
    const { projectName, items } = req.body;

    if (!projectName || typeof projectName !== "string" || projectName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "projectName is required",
      });
    }

    const validationError = validateItems(items);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const totals = await calculateQuotation(items);
    const persistedQuotation = await createQuotationRecord({ projectName, totals });

    res.status(201).json({
      success: true,
      data: persistedQuotation,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function getQuotations(req, res) {
  try {
    const quotations = await prisma.quotation.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: quotations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotations",
      error: error.message,
    });
  }
}

async function getQuotationById(req, res) {
  try {
    const quotationId = parseIdParam(req.params.id);

    if (!quotationId) {
      return res.status(400).json({
        success: false,
        message: "Valid quotation id is required",
      });
    }

    const quotation = await prisma.quotation.findUnique({
      where: {
        id: quotationId,
      },
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    res.json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotation",
      error: error.message,
    });
  }
}

async function downloadQuotationPdf(req, res) {
  try {
    const quotationId = parseIdParam(req.params.id);

    if (!quotationId) {
      return res.status(400).json({
        success: false,
        message: "Valid quotation id is required",
      });
    }

    const quotation = await prisma.quotation.findUnique({
      where: {
        id: quotationId,
      },
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    const downloadTimestamp = Date.now();

    const report = await prisma.report.findFirst({
      where: {
        quotationId,
      },
    });

    const breakdown = Array.isArray(quotation.breakdown) && quotation.breakdown.length > 0
      ? quotation.breakdown
      : report?.description
        ? parseBreakdownFromDescription(report.description)
        : [];

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=quotation-${quotation.id}-${downloadTimestamp}.pdf`
    );

    const doc = new PDFDocument({
      margin: 50,
      bufferPages: true,
  });
    doc.pipe(res);
    writeQuotationPdf(doc, {
      ...quotation,
      breakdown,
    });
    doc.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
}
module.exports = {
  calculateQuotationPreview,
  createQuotation,
  createQuotationRecord,
  downloadQuotationPdf,
  getQuotationById,
  getQuotations,
};
