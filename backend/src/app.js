const express = require("express");
const cors = require("cors");

const revenueRoutes = require("./routes/revenue");
const footfallRoutes = require("./routes/footfall");

const app = express();

app.use(express.json());
app.use(cors());

app.use("/api/revenue", revenueRoutes);
app.use("/api/footfall", footfallRoutes);

module.exports = app;