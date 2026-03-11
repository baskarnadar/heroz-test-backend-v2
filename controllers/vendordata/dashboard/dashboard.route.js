const dashboard = require("./dashboard.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../../middleware/auth");
router.post("/getDashboardSummary",protectAPI, dashboard.getDashboardSummary);
router.post("/getvdrsummary",protectAPI, dashboard.getvdrsummary);
module.exports = router;

