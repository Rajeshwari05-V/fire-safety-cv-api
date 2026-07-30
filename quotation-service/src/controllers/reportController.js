const PDFDocument = require("pdfkit");
const prisma = require("../config/prisma");
const { buildReportDescription, extractReportMetadata } = require("../services/reportService");
const { writeFireSafetyAssessmentPdf } = require("../services/pdfService");
const { parseIdParam } = require("../utils/validation");

async function getReports(req, res) {
  try {
    const reports = await prisma.report.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message,
    });
  }
}

async function createReport(req, res) {
  try {
    const { reportName, description, quotationId } = req.body;

    if (!reportName || typeof reportName !== "string" || reportName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "reportName is required",
      });
    }

    if (!description || typeof description !== "string" || description.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "description is required",
      });
    }

    const normalizedQuotationId = quotationId ? Number(quotationId) : null;

    if (quotationId !== undefined && quotationId !== null && quotationId !== "" && !Number.isInteger(normalizedQuotationId)) {
      return res.status(400).json({
        success: false,
        message: "quotationId must be a valid integer",
      });
    }

    const report = await prisma.report.create({
      data: {
        reportName,
        description,
        ...(normalizedQuotationId
          ? {
              quotation: {
                connect: {
                  id: normalizedQuotationId,
                },
              },
            }
          : {}),
      },
    });

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create report",
      error: error.message,
    });
  }
}

async function downloadFireSafetyAssessmentPdf(req, res) {
  try {
    const reportId = parseIdParam(req.params.id);

    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Valid report id is required",
      });
    }

    const report = await prisma.report.findUnique({
      where: {
        id: reportId,
      },
      include: {
        quotation: true,
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const metadataPayload = extractReportMetadata(report.description || "");
    const assessmentPayload = metadataPayload?.mlPayload || metadataPayload || report.quotation || {};

    const structuredReport = buildReportDescription(report.quotation || {}, {
      projectName: assessmentPayload.projectName || report.quotation?.projectName || report.reportName,
      client_id: assessmentPayload.client_id || assessmentPayload.clientId || report.quotationId || report.id,
      building_type: assessmentPayload.building_type || assessmentPayload.buildingType || null,
      compliance_standard: assessmentPayload.compliance_standard || assessmentPayload.complianceStandard || null,
      rules_configured: assessmentPayload.rules_configured || assessmentPayload.rulesConfigured || [],
      compliance_score: assessmentPayload.compliance_score || assessmentPayload.complianceScore || null,
      reportDate: assessmentPayload.reportDate || report.createdAt,
      equipment_recommendations: assessmentPayload.equipment_recommendations || assessmentPayload.equipmentRecommendations || [],
      review_flags: assessmentPayload.review_flags || assessmentPayload.reviewFlags || [],
      rule_refs: assessmentPayload.rule_refs || assessmentPayload.ruleReferences || assessmentPayload.rule_references || [],
      engineerRemarks: assessmentPayload.engineerRemarks || `Assessment prepared for ${report.quotation?.projectName || report.reportName}. Review the proposed equipment coverage before final approval.`,
      mlPayload: assessmentPayload,
    });

    const downloadTimestamp = Date.now();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=fire-safety-assessment-${report.id}-${downloadTimestamp}.pdf`
    );

    const doc = new PDFDocument({
      margin: 50,
      bufferPages: true,
    });
    let streamStarted = false;

    doc.on("pipe", () => {
      streamStarted = true;
    });

    doc.pipe(res);

    try {
      writeFireSafetyAssessmentPdf(doc, structuredReport);
      doc.end();
    } catch (error) {
      if (!streamStarted) {
        return res.status(500).json({
          success: false,
          message: "Failed to generate fire safety assessment PDF",
          error: error.message,
        });
      }
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate fire safety assessment PDF",
      error: error.message,
    });
  }
}

module.exports = {
  createReport,
  downloadFireSafetyAssessmentPdf,
  getReports,
};
