const express = require("express");
const cors = require("cors");
const equipmentRoutes = require("./routes/equipmentRoutes");
const mlRoutes = require("./routes/mlRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const reportRoutes = require("./routes/reportRoutes");
const uploadedPlanRoutes = require("./routes/uploadedPlanRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fire Safety Backend API is running",
  });
});

app.use("/api/equipment", equipmentRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/uploaded-plans", uploadedPlanRoutes);
app.use("/api/ml", mlRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

module.exports = app;
