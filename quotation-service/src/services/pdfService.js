function formatCurrency(value) {
  const numericValue = Number(value ?? 0);
  return `Rs. ${numericValue.toFixed(2)}`;
}

function parseCurrency(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.replace(/[₹Rs.,]/gi, "").trim();
    return Number(normalizedValue) || 0;
  }

  return Number(value) || 0;
}

function parseBreakdownFromDescription(description) {
  if (typeof description !== "string" || description.trim() === "") {
    return [];
  }

  const lines = description.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim().startsWith("3. Itemized Equipment Cost"));

  if (startIndex === -1) {
    return [];
  }

  const breakdown = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmedLine = lines[index].trim();
    if (trimmedLine === "" || trimmedLine.startsWith("4.")) {
      break;
    }

    const match = trimmedLine.match(/^- (.+) \| Qty: (\d+) \| Unit Price: (.+) \| Total: (.+)$/);
    if (match) {
      breakdown.push({
        name: match[1],
        quantity: Number(match[2]),
        unitPrice: parseCurrency(match[3]),
        itemTotal: parseCurrency(match[4]),
      });
    }
  }

  return breakdown;
}

function buildQuotationBreakdownRows(quotation) {
  const rows = [];
  const breakdown = Array.isArray(quotation.breakdown) && quotation.breakdown.length > 0
    ? quotation.breakdown
    : parseBreakdownFromDescription(quotation.description || "");

  if (breakdown.length > 0) {
    breakdown.forEach((item) => {
      rows.push({
        type: "item",
        title: item.name,
        detail: `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
        amount: item.itemTotal,
      });
    });
  }

  rows.push(
  {
    type: "subtotal",
    title: "Equipment Subtotal",
    amount: quotation.equipmentCost,
  },

  {
    type: "section",
    title: "Tax & Additional Charges",
  },

  {
    type: "summary",
    title: "Installation Cost (10%)",
    amount: quotation.installationCost,
  },

  {
    type: "summary",
    title: "Maintenance Cost (5%)",
    amount: quotation.maintenanceCost,
  },

  {
    type: "summary",
    title: "GST (18%)",
    amount: quotation.gst,
  },

  {
    type: "total",
    title: "Grand Total",
    amount: quotation.totalCost,
  }
);

  return rows;
}

function writeQuotationPdf(doc, quotation) {
  const pageWidth = doc.page.width;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  doc.y = 50;
  doc.font("Helvetica").fontSize(10).fillColor("#374151");
  doc.text("Quotation PDF generation removed.", margin, doc.y);
  renderFooters(doc, margin, contentWidth);
}

function getFieldValue(source, keys) {
  const values = Array.isArray(keys) ? keys : [keys];

  for (const key of values) {
    if (typeof key !== "string") {
      continue;
    }

    if (key.includes(".")) {
      const parts = key.split(".");
      let current = source;
      let found = true;

      for (const part of parts) {
        if (current && Object.prototype.hasOwnProperty.call(current, part)) {
          current = current[part];
        } else {
          found = false;
          break;
        }
      }

      if (found && current !== undefined && current !== null && current !== "") {
        return current;
      }

      continue;
    }

    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return undefined;
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined && item !== "");
  }

  if (value === null || value === undefined || value === "") {
    return [];
  }

  return [value];
}

function normalizeRecommendations(value) {
  return normalizeArray(value).map((item) => {
    if (typeof item === "string") {
      return {
        item,
        qty: 1,
        zone: "Not specified",
        rule_refs: [],
        name: item,
        quantity: 1,
      };
    }

    if (!item || typeof item !== "object") {
      return null;
    }

    const quantity = Number(getFieldValue(item, ["qty", "quantity", "count", "recommendedQuantity"]) || 1);
    const equipmentName = getFieldValue(item, ["item", "name", "equipmentName", "equipment", "itemName"]) || "Equipment";
    const zone = getFieldValue(item, ["zone", "equipmentZone", "location", "zoneName"]) || "Not specified";
    const ruleRefs = normalizeArray(getFieldValue(item, ["rule_refs", "ruleRefs", "ruleReferences", "rules"]) || []);

    return {
      item: equipmentName,
      qty: quantity,
      zone,
      rule_refs: ruleRefs,
      name: equipmentName,
      quantity,
    };
  }).filter(Boolean);
}

function normalizeFlags(value) {
  return normalizeArray(value).map((flag) => {
    if (typeof flag === "string") {
      return {
        severity: "Medium",
        reason: flag,
      };
    }

    if (!flag || typeof flag !== "object") {
      return null;
    }

    return {
      severity: getFieldValue(flag, ["severity", "level"]) || "Medium",
      reason: getFieldValue(flag, ["reason", "detail", "message", "description"]) || "Needs review",
    };
  }).filter(Boolean);
}

function normalizeRuleReferences(value) {
  return normalizeArray(value).map((rule) => {
    if (typeof rule === "string") {
      return {
        equipment: "General",
        code: rule,
        title: rule,
        reference: rule,
      };
    }

    if (!rule || typeof rule !== "object") {
      return null;
    }

    return {
      equipment: getFieldValue(rule, ["equipment", "equipmentName", "zone", "target"]) || "General",
      code: getFieldValue(rule, ["code", "referenceCode"]) || getFieldValue(rule, ["reference", "title"]) || "Reference",
      title: getFieldValue(rule, ["title", "name"]) || getFieldValue(rule, ["reference", "code"]) || "Reference",
      reference: getFieldValue(rule, ["reference", "detail"]) || getFieldValue(rule, ["code", "title"]) || "Reference",
    };
  }).filter(Boolean);
}

function ensureSpace(doc, requiredHeight, marginBottom = 70) {
  const pageHeight = doc.page.height;
  return doc.y + requiredHeight > pageHeight - marginBottom;
}

function beginSection(doc, requiredHeight, margin, contentWidth, marginBottom = 70) {
  if (ensureSpace(doc, requiredHeight, marginBottom)) {
    doc.addPage();
    doc.y = 50;
  }
}

function drawFooter(doc, margin, contentWidth) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  doc.moveTo(margin, pageHeight - 55)
    .lineTo(pageWidth - margin, pageHeight - 55)
    .strokeColor("#d1d5db")
    .lineWidth(1)
    .stroke();

  doc.font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text(
      "Generated by Fire Safety Planning Quotation System",
      margin,
      pageHeight - 40,
      {
        align: "center",
        width: contentWidth,
      }
    );
}

function renderFooters(doc, margin, contentWidth) {
  if (typeof doc.bufferedPageRange === "function") {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      drawFooter(doc, margin, contentWidth);
    }
    return;
  }

  drawFooter(doc, margin, contentWidth);
}

function formatEquipmentName(name) {
  return String(name)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function drawTable(doc, headers, rows, columnWidths, options = {}) {
  const margin = options.margin || 50;
  const rowHeight = options.rowHeight || 24;
  const pageHeight = doc.page.height;
  const bottomPadding = options.bottomPadding || 70;
  const contentWidth = options.contentWidth || doc.page.width - margin * 2;
  const headerFill = options.headerFill || "#e2e8f0";
  const borderColor = options.borderColor || "#d1d5db";
  const textColor = options.textColor || "#111827";

  let currentY = doc.y;
  const columnX = [];
  let runningX = margin;

  columnWidths.forEach((width) => {
    columnX.push(runningX);
    runningX += width;
  });

  function drawHeader() {
    let x = margin;

    headers.forEach((header, index) => {
      const width = columnWidths[index];
      doc.fillColor(headerFill).rect(x, currentY, width, rowHeight).fill();
      doc.strokeColor(borderColor).rect(x, currentY, width, rowHeight).stroke();
      doc.fillColor(textColor).font("Helvetica-Bold").fontSize(10).text(String(header), x + 6, currentY + 6, {
        width: width - 12,
        align: "left",
      });
      x += width;
    });

    currentY += rowHeight;
  }

  if (ensureSpace(doc, rowHeight * 2, bottomPadding)) {
    doc.addPage();
    doc.y = 50;
    currentY = doc.y;
  }

  drawHeader();

  rows.forEach((row) => {
    if (currentY + rowHeight > pageHeight - bottomPadding) {
      doc.addPage();
      currentY = 50;
      doc.y = currentY;
      drawHeader();
    }

    let x = margin;
    row.forEach((cell, index) => {
      const width = columnWidths[index];
      doc.fillColor("#ffffff").rect(x, currentY, width, rowHeight).fill();
      doc.strokeColor(borderColor).rect(x, currentY, width, rowHeight).stroke();
      doc.fillColor(textColor).font("Helvetica").fontSize(9).text(cell != null ? String(cell) : "", x + 6, currentY + 6, {
        width: width - 12,
        align: "left",
      });
      x += width;
    });

    currentY += rowHeight;
  });

  doc.y = currentY + 12;
}

function writeQuotationPdf(doc, quotation) {
  const pageWidth = doc.page.width;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const rows = buildQuotationBreakdownRows(quotation);
  const createdAt = quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString() : "N/A";

  doc.y = 50;

  beginSection(doc, 110, margin, contentWidth);
  const headerTop = doc.y;
  doc.roundedRect(margin, headerTop, contentWidth, 92, 8).fillAndStroke("#f8fafc", "#dbe3ea");
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#0f4c81").text("QUOTATION", margin + 18, headerTop + 18);
  doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text("Fire Safety Planning Quotation System", margin + 18, headerTop + 54);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("Professional Fire Safety Cost Estimate", margin + 18, headerTop + 72);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Quotation No: ${quotation.id}`, margin + 18, headerTop + 92);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Project: ${quotation.projectName || "Unnamed Project"}`, margin + 270, headerTop + 54);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Date: ${createdAt}`, margin + 270, headerTop + 72);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text("Status: Draft", margin + 270, headerTop + 92);
  doc.y = headerTop + 118;

  beginSection(doc, 90, margin, contentWidth);
  const projectTop = doc.y;
  doc.roundedRect(margin, projectTop, contentWidth, 84, 8).fillAndStroke("#f9fbfd", "#dbe3ea");
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("Project Details", margin + 16, projectTop + 14);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Client / Site: ${quotation.projectName || "Unnamed Project"}`, margin + 16, projectTop + 38);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Reference ID: ${quotation.id}`, margin + 16, projectTop + 56);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Issued On: ${createdAt}`, margin + 280, projectTop + 38);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text("Prepared For: Fire Safety Planning Team", margin + 280, projectTop + 56);
  doc.y = projectTop + 96;

  beginSection(doc, 90, margin, contentWidth);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text("Quotation Table", margin, doc.y);
  doc.moveDown(0.5);
  drawTable(
    doc,
    ["Item / Description", "Amount"],
    rows.map((row) => {
      if (row.type === "item") {
        return [row.title, formatCurrency(row.amount)];
      }
      if (row.type === "section") {
        return [row.title, ""];
      }
      return [row.title, formatCurrency(row.amount)];
    }),
    [contentWidth * 0.72, contentWidth * 0.28],
    {
      margin,
      contentWidth,
      bottomPadding: 60,
    }
  );

  beginSection(doc, 110, margin, contentWidth);
  const totalTop = doc.y;
  doc.roundedRect(margin, totalTop, contentWidth, 92, 8).fillAndStroke("#fcfdff", "#e5e7eb");
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("Cost Summary", margin + 16, totalTop + 14);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Equipment Subtotal: ${formatCurrency(quotation.equipmentCost)}`, margin + 16, totalTop + 38);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Installation Cost: ${formatCurrency(quotation.installationCost)}`, margin + 16, totalTop + 56);
  doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Maintenance Cost: ${formatCurrency(quotation.maintenanceCost)}`, margin + 16, totalTop + 74);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f4c81").text(`Grand Total: ${formatCurrency(quotation.totalCost)}`, margin + 280, totalTop + 56);
  doc.y = totalTop + 104;

  beginSection(doc, 120, margin, contentWidth);
  const notesTop = doc.y;
  doc.roundedRect(margin, notesTop, contentWidth, 118, 8).fillAndStroke("#fcfdff", "#e5e7eb");
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("Notes", margin + 16, notesTop + 14);
  doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text("This quotation is prepared based on the requested scope and may be revised if project requirements change.", margin + 16, notesTop + 40, { width: contentWidth - 32 });
  doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text("Thank you for choosing Fire Safety Planning Quotation System.", margin + 16, notesTop + 62, { width: contentWidth - 32 });
  doc.strokeColor("#d1d5db").lineWidth(1);
  doc.moveTo(margin + 24, notesTop + 92).lineTo(margin + 180, notesTop + 92).stroke();
  doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Authorized Signature", margin + 24, notesTop + 100);
  doc.moveTo(pageWidth - margin - 180, notesTop + 92).lineTo(pageWidth - margin - 24, notesTop + 92).stroke();
  doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Client Confirmation", pageWidth - margin - 180, notesTop + 100);
  doc.y = notesTop + 128;

  //renderFooters(doc, margin, contentWidth);
}

function writeFireSafetyAssessmentPdf(doc, report = {}) {
  const margin = 50;
  const contentWidth = doc.page.width - margin * 2;
  const reportData = report && typeof report === "object" ? report : {};
  const mlData = reportData.mlJson || reportData.mlData || reportData.mlPayload || reportData.rawData || {};
  const fallbackSource = { ...reportData, ...mlData };

  const projectName = getFieldValue(fallbackSource, ["projectName", "project_name"]) || "Unnamed Project";
  const clientId = getFieldValue(fallbackSource, ["clientId", "client_id", "client"]) || "N/A";
  const buildingType = getFieldValue(fallbackSource, ["buildingType", "building_type"]) || "Not specified";
  const complianceStandard = getFieldValue(fallbackSource, ["complianceStandard", "compliance_standard"]) || "Not specified";
  const complianceScore = getFieldValue(fallbackSource, ["complianceScore", "compliance_score"]) ?? "N/A";
  const rulesConfigured = normalizeArray(getFieldValue(fallbackSource, ["rulesConfigured", "rules_configured", "rules"]) || []);
  const equipmentRows = normalizeRecommendations(getFieldValue(fallbackSource, ["equipmentRecommendations", "equipment_recommendations", "recommendedEquipment", "derivedEquipment"]) || []);
  const reviewRows = normalizeFlags(getFieldValue(fallbackSource, ["reviewFlags", "review_flags"]) || []);
  const ruleReferences = normalizeRuleReferences(getFieldValue(fallbackSource, ["ruleReferences", "rule_refs", "rule_references"]) || []);
  const engineerRemarks = getFieldValue(fallbackSource, ["engineerRemarks", "engineer_remarks"]) || `Assessment prepared for ${projectName}. Review the proposed scope and code requirements before approval.`;
  const reportDate = getFieldValue(fallbackSource, ["reportDate", "report_date"]) || new Date().toISOString();
  const formattedDate = reportDate ? new Date(reportDate).toLocaleDateString() : "N/A";

  doc.y = 50;
  doc.font("Helvetica").fontSize(10).fillColor("#374151");

  beginSection(doc, 90, margin, contentWidth);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Fire Safety Planning Quotation System", margin, doc.y);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#0f4c81").text("Fire Safety Assessment Report", margin, doc.y);
  doc.moveDown(1.2);

  beginSection(doc, 170, margin, contentWidth);
  const overviewTop = doc.y;
  doc.roundedRect(margin, overviewTop, contentWidth, 150, 8).fillAndStroke("#f8fafc", "#dbe3ea");
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#0f4c81").text("Project Overview", margin + 18, overviewTop + 16);
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(projectName, margin + 18, overviewTop + 48, { width: contentWidth - 36 });
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text(`Client ID: ${clientId}`, margin + 18, overviewTop + 82);
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text(`Building Type: ${buildingType}`, margin + 18, overviewTop + 104);
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text(`Report Date: ${formattedDate}`, margin + 18, overviewTop + 126);
  doc.y = overviewTop + 160;

  beginSection(doc, 120, margin, contentWidth);
  const infoTop = doc.y;
  doc.roundedRect(margin, infoTop, contentWidth, 108, 8).fillAndStroke("#f9fbfd", "#dbe3ea");
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text("Building Information", margin + 18, infoTop + 16);
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text(`Compliance Standard: ${complianceStandard}`, margin + 18, infoTop + 46);
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text(`Rules Configured: ${rulesConfigured.length > 0 ? rulesConfigured.join(", ") : "Not specified"}`, margin + 18, infoTop + 68);
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text(`Compliance Score: ${complianceScore}`, margin + 18, infoTop + 90);
  doc.y = infoTop + 120;

  if (equipmentRows.length > 0) {
    beginSection(doc, 90, margin, contentWidth);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Equipment Recommendations", margin, doc.y);
    doc.moveDown(0.5);
    drawTable(
      doc,
      ["Equipment", "Zone", "Quantity"],
      equipmentRows.map((row) => [formatEquipmentName(row.item || row.name), row.zone || "Not specified", row.qty ?? row.quantity ?? 0]),
      [contentWidth * 0.60, contentWidth * 0.24, contentWidth * 0.16],
      {
        margin,
        contentWidth,
        bottomPadding: 70,
      }
    );
  }

  if (reviewRows.length > 0) {
    beginSection(doc, 90, margin, contentWidth);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Review Flags", margin, doc.y);
    doc.moveDown(0.5);
    drawTable(
      doc,
      ["Severity", "Reason"],
      reviewRows.map((row) => [row.severity, row.reason]),
      [contentWidth * 0.22, contentWidth * 0.78],
      {
        margin,
        contentWidth,
        bottomPadding: 70,
      }
    );
  } else {
    beginSection(doc, 70, margin, contentWidth);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Review Flags", margin, doc.y);
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10).fillColor("#374151").text("No review flags detected.", margin, doc.y);
  }

  if (ruleReferences.length > 0) {
    beginSection(doc, 90, margin, contentWidth);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Rule References", margin, doc.y);
    doc.moveDown(0.5);

    const groupedRuleReferences = new Map();
    ruleReferences.forEach((rule) => {
      const equipmentName = rule.equipment || "General";
      if (!groupedRuleReferences.has(equipmentName)) {
        groupedRuleReferences.set(equipmentName, []);
      }
      groupedRuleReferences.get(equipmentName).push(rule);
    });

    groupedRuleReferences.forEach((rules, equipmentName) => {
      beginSection(doc, 24, margin, contentWidth);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(equipmentName, margin + 8, doc.y);
      doc.moveDown(0.4);
      rules.forEach((rule) => {
        beginSection(doc, 14, margin, contentWidth);
        doc.font("Helvetica").fontSize(9).fillColor("#374151").text(`- ${rule.code || rule.reference || "Reference"}`, margin + 16, doc.y);
        doc.moveDown(0.25);
      });
    });
  }

  if (engineerRemarks) {
    beginSection(doc, 120, margin, contentWidth);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Engineer Remarks", margin, doc.y);
    doc.moveDown(0.5);
    const remarksTop = doc.y;
    doc.roundedRect(margin, remarksTop, contentWidth, 98, 6).fillAndStroke("#ffffff", "#dbe3ea");
    doc.font("Helvetica").fontSize(10).fillColor("#374151").text(engineerRemarks, margin + 12, remarksTop + 14, { width: contentWidth - 24, align: "left" });
    doc.y = remarksTop + 108;
  }

  //renderFooters(doc, margin, contentWidth);
}

module.exports = {
  buildQuotationBreakdownRows,
  parseBreakdownFromDescription,
  writeQuotationPdf,
  writeFireSafetyAssessmentPdf,
};