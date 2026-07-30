function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function normalizeStringArray(value) {
  return normalizeArray(value).map((item) => String(item));
}

function normalizeEquipmentRecommendations(value) {
  const items = normalizeArray(value);

  return items
    .map((item) => {
      if (typeof item === "string") {
        return {
          item,
          qty: 1,
          zone: "Not specified",
          rule_refs: [],
          name: item,
          quantity: 1,
          notes: "Derived from ML recommendation",
          ruleRefs: [],
        };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const quantity = toNumber(item.qty || item.quantity || item.count || item.recommendedQuantity || 1, 1);
      const ruleRefs = normalizeStringArray(
        item.ruleRefs || item.rule_refs || item.ruleReferences || item.rules || []
      );

      return {
        item: item.item || item.name || item.equipmentName || item.equipment || "Equipment",
        qty: quantity,
        zone: item.zone || item.equipmentZone || item.location || item.zoneName || "Not specified",
        rule_refs: ruleRefs,
        name: item.item || item.name || item.equipmentName || item.equipment || "Equipment",
        quantity,
        notes: item.notes || item.reason || "Derived from the assessed fire safety requirements",
        ruleRefs,
        reviewFlags: normalizeStringArray(item.reviewFlags || item.review_flags || []),
      };
    })
    .filter(Boolean);
}

function normalizeEquipmentZones(recommendations, fallbackZones) {
  const zones = normalizeArray(fallbackZones);

  if (zones.length > 0) {
    return zones.map((zone) => {
      if (typeof zone === "string") {
        return {
          zone,
          equipment: recommendations
            .filter((item) => item.zone === zone)
            .map((item) => item.name),
        };
      }

      if (zone && typeof zone === "object") {
        return {
          zone: zone.zone || zone.name || "General",
          equipment: normalizeArray(zone.equipment || zone.items || []).map((entry) => String(entry)),
        };
      }

      return { zone: "General", equipment: [] };
    });
  }

  const groupedZones = new Map();

  recommendations.forEach((recommendation) => {
    const zoneName = recommendation.zone || "General";
    if (!groupedZones.has(zoneName)) {
      groupedZones.set(zoneName, []);
    }

    groupedZones.get(zoneName).push(recommendation.name);
  });

  return Array.from(groupedZones.entries()).map(([zone, equipment]) => ({
    zone,
    equipment,
  }));
}

function normalizeReviewFlags(value, recommendations) {
  const flags = normalizeArray(value);

  if (flags.length > 0) {
    return flags.map((flag) => {
      if (typeof flag === "string") {
        return {
          severity: "Medium",
          reason: flag,
        };
      }

      if (flag && typeof flag === "object") {
        return {
          severity: flag.severity || flag.level || "Medium",
          reason: flag.reason || flag.detail || flag.message || "Needs manual review",
        };
      }

      return {
        severity: "Medium",
        reason: "Needs manual review",
      };
    });
  }

  const recommendationFlags = recommendations
    .map((recommendation) => normalizeStringArray(recommendation.reviewFlags || []))
    .flat()
    .filter(Boolean);

  if (recommendationFlags.length > 0) {
    return recommendationFlags.map((flag) => ({
      severity: "Medium",
      reason: flag,
    }));
  }

  if (recommendations.length === 0) {
    return [{
      severity: "Medium",
      reason: "Manual review recommended due to limited equipment data.",
    }];
  }

  return [];
}

function normalizeRuleReferences(value, fallbackRules, recommendations) {
  const references = normalizeArray(value);

  if (references.length > 0) {
    return references.map((reference) => {
      if (typeof reference === "string") {
        return {
          equipment: recommendations[0]?.name || "General",
          code: reference,
          title: reference,
          reference,
        };
      }

      if (reference && typeof reference === "object") {
        return {
          equipment: reference.equipment || reference.equipmentName || recommendations[0]?.name || "General",
          code: reference.code || reference.reference || reference.title || "Reference",
          title: reference.title || reference.code || reference.reference || "Reference",
          reference: reference.reference || reference.code || reference.title || "Reference",
        };
      }

      return {
        equipment: recommendations[0]?.name || "General",
        code: "Reference",
        title: "Reference",
        reference: "Reference",
      };
    });
  }

  const recommendationRuleRefs = recommendations
    .map((recommendation) => {
      const refs = normalizeStringArray(recommendation.ruleRefs || []);
      return refs.map((rule) => ({
        equipment: recommendation.name || "General",
        code: rule,
        title: rule,
        reference: rule,
      }));
    })
    .flat();

  if (recommendationRuleRefs.length > 0) {
    return recommendationRuleRefs;
  }

  return normalizeStringArray(fallbackRules).map((rule) => ({
    equipment: recommendations[0]?.name || "General",
    code: rule,
    title: rule,
    reference: rule,
  }));
}

function buildEngineerRemarks(projectName, recommendations) {
  if (recommendations.length > 0) {
    return `Assessment prepared for ${projectName}. Review recommended equipment placement and verify local code applicability before final approval.`;
  }

  return `Assessment prepared for ${projectName}. Confirm the protection scope and applicable fire safety rules before proceeding.`;
}

function buildReportMetadata(report = {}) {
  return `__REPORT_METADATA_START__${JSON.stringify(report)}__REPORT_METADATA_END__`;
}

function extractReportMetadata(description = "") {
  const match = description.match(/__REPORT_METADATA_START__(.*?)__REPORT_METADATA_END__/s);

  if (!match || !match[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    return null;
  }
}

function buildReportTextDescription(report = {}) {
  const lines = [
    "Fire Safety Assessment Report",
    `Project Name: ${report.projectName || "Unnamed Project"}`,
    `Client ID: ${report.clientId || "N/A"}`,
    `Building Type: ${report.buildingType || "Not specified"}`,
    `Compliance Standard: ${report.complianceStandard || "NFPA / Local Fire Code"}`,
    `Rules Configured: ${Array.isArray(report.rulesConfigured) ? report.rulesConfigured.join(", ") : "Not specified"}`,
    `Compliance Score: ${report.complianceScore ?? "N/A"}`,
    "Equipment Recommendations:",
  ];

  const recommendations = Array.isArray(report.equipmentRecommendations) ? report.equipmentRecommendations : [];
  recommendations.forEach((item) => {
    const equipmentName = item.item || item.name || item.equipmentName || item.equipment || "Equipment";
    const quantity = item.qty ?? item.quantity ?? item.count ?? 1;
    const zone = item.zone || item.equipmentZone || item.location || item.zoneName || "General";
    lines.push(`- ${equipmentName} | Zone: ${zone} | Qty: ${quantity}`);
  });

  lines.push("", "Review Flags:");
  const reviewFlags = Array.isArray(report.reviewFlags) ? report.reviewFlags : [];
  reviewFlags.forEach((flag) => {
    lines.push(`- ${flag.severity || "Medium"}: ${flag.reason || "Needs review"}`);
  });

  return lines.join("\n");
}

function buildReportDescription(quotation = {}, mlPayload = {}) {
  const source = quotation && typeof quotation === "object" ? quotation : {};
  const mlData = mlPayload && typeof mlPayload === "object" ? mlPayload : {};
  const merged = {
    ...source,
    ...mlData,
    ...(source.mlJson || source.mlData || source.mlPayload || {}),
  };

  const recommendations = normalizeEquipmentRecommendations(
    merged.equipmentRecommendations ||
      merged.equipment_recommendations ||
      merged.recommendedEquipment ||
      merged.derivedEquipment ||
      merged.breakdown ||
      []
  );

  const rulesConfigured = normalizeStringArray(
    merged.rulesConfigured ||
      merged.rules_configured ||
      merged.rules ||
      []
  );

  const report = {
    projectName: merged.projectName || merged.project_name || "Unnamed Project",
    clientId: merged.clientId || merged.client_id || merged.client || merged.id || null,
    buildingType: merged.buildingType || merged.building_type || "Not specified",
    complianceStandard: merged.complianceStandard || merged.compliance_standard || "Not specified",
    rulesConfigured: rulesConfigured.length > 0 ? rulesConfigured : [],
    complianceScore: toNumber(merged.complianceScore ?? merged.compliance_score ?? 0, 0),
    equipmentRecommendations: recommendations,
    equipmentZones: normalizeEquipmentZones(recommendations, merged.equipmentZones || merged.equipment_zones || []),
    reviewFlags: normalizeReviewFlags(merged.reviewFlags || merged.review_flags || [], recommendations),
    ruleReferences: normalizeRuleReferences(merged.ruleReferences || merged.rule_refs || merged.rule_references || [], rulesConfigured, recommendations),
    engineerRemarks: merged.engineerRemarks || merged.engineer_remarks || buildEngineerRemarks(merged.projectName || merged.project_name || "the project", recommendations),
    reportDate: merged.reportDate || merged.report_date || source.createdAt || source.created_at || new Date().toISOString(),
    mlPayload: merged.mlPayload || mlData,
  };

  if (merged.totalCost !== undefined) {
    report.complianceScore = Math.max(0, Math.min(100, Math.round(report.complianceScore)));
  }

  return report;
}

module.exports = {
  buildReportDescription,
  buildReportMetadata,
  buildReportTextDescription,
  extractReportMetadata,
};
