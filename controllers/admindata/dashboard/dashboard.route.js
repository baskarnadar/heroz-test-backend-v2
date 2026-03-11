const dashboard = require("./dashboard.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../../middleware/auth");
router.post("/getDashboardSummary", protectAPI,dashboard.getDashboardSummary);
router.post("/getdashboardtotal",protectAPI, dashboard.getdashboardtotal);
router.post("/getdashboardPaySummary",protectAPI, dashboard.getdashboardPaySummary);


module.exports = router;

