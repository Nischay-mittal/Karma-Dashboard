const express = require("express");
const router = express.Router();

try {
  const {
    getRevenue,
    getDivisions,
    getCentres,
    downloadRevenueExcel,
  } = require("../controllers/revenuecontroller");

  // GET routes first (before POST /)
  router.get("/divisions", getDivisions);
  router.get("/centres", getCentres);
  router.post("/", getRevenue);
  router.post("/excel", downloadRevenueExcel);

  console.log("Revenue routes registered: GET /divisions, GET /centres, POST /, POST /excel");
} catch (err) {
  console.error("ERROR loading revenue routes:", err);
  throw err;
}

module.exports = router;


