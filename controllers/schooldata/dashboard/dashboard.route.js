const dashboard = require("./dashboard.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../../middleware/auth");  
router.post("/getschsummary",protectAPI, dashboard.getschsummary);
module.exports = router;

