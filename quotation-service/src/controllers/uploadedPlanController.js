const prisma = require("../config/prisma");

async function getUploadedPlans(req, res) {
  try {
    const uploadedPlans = await prisma.uploadedPlan.findMany({
      orderBy: {
        uploadedAt: "desc",
      },
    });

    res.json({
      success: true,
      data: uploadedPlans,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch uploaded plans",
      error: error.message,
    });
  }
}

async function createUploadedPlan(req, res) {
  try {
    const { fileName, quotationId } = req.body;
    const uploadedFile = req.file;

    if (!uploadedFile && (!fileName || typeof fileName !== "string" || fileName.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "A plan file or fileName is required",
      });
    }

    const normalizedQuotationId = quotationId ? Number(quotationId) : null;

    if (quotationId !== undefined && quotationId !== null && quotationId !== "" && !Number.isInteger(normalizedQuotationId)) {
      return res.status(400).json({
        success: false,
        message: "quotationId must be a valid integer",
      });
    }

    const storedFileName = uploadedFile
      ? uploadedFile.filename
      : fileName;

    const uploadedPlan = await prisma.uploadedPlan.create({
      data: {
        fileName: storedFileName,
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
      data: {
        ...uploadedPlan,
        uploadedFile: uploadedFile
          ? {
              originalName: uploadedFile.originalname,
              storedName: uploadedFile.filename,
              size: uploadedFile.size,
              path: uploadedFile.path,
            }
          : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create uploaded plan",
      error: error.message,
    });
  }
}

module.exports = {
  createUploadedPlan,
  getUploadedPlans,
};
