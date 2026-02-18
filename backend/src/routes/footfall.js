const express = require("express");
const router = express.Router();
const { getFootfall, getFootfallByMonth } = require("../controllers/footfallController");

router.post("/", getFootfall);
router.post("/by-month", getFootfallByMonth);

module.exports = router;

