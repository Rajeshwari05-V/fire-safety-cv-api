const test = require("node:test");
const assert = require("node:assert/strict");
const { buildQuotationBreakdownRows, parseBreakdownFromDescription } = require("../src/services/pdfService");

test("buildQuotationBreakdownRows includes itemized equipment lines", () => {
  const rows = buildQuotationBreakdownRows({
    breakdown: [
      { name: "Smoke Detector", quantity: 2, unitPrice: 120, itemTotal: 240 },
      { name: "Fire Extinguisher", quantity: 3, unitPrice: 80, itemTotal: 240 },
    ],
    equipmentCost: 480,
    installationCost: 48,
    maintenanceCost: 24,
    gst: 86.4,
    totalCost: 638.4,
  });

  assert.ok(rows.some((row) => row.type === "item"));
  assert.equal(rows[0].title, "Smoke Detector");
  assert.equal(rows[1].title, "Fire Extinguisher");
  assert.equal(rows[rows.length - 1].title, "Total Estimated Cost");
});

test("parseBreakdownFromDescription extracts equipment entries from report text", () => {
  const breakdown = parseBreakdownFromDescription(`Fire Safety Analysis Report
Project Name: Test Project

2. Cost Summary
- Equipment Cost: 480

3. Itemized Equipment Cost
- Smoke Detector | Qty: 2 | Unit Price: ₹120.00 | Total: ₹240.00
- Fire Extinguisher | Qty: 3 | Unit Price: ₹80.00 | Total: ₹240.00

4. Recommended Actions`);

  assert.equal(breakdown.length, 2);
  assert.equal(breakdown[0].name, "Smoke Detector");
  assert.equal(breakdown[1].quantity, 3);
});
