// controllers/membership/purchase/purchase.route.js
const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
const purchase = require("./purchase.controller");
 
 router.post("/getMemPurchaseList" ,protectAPI ,purchase.getMemPurchaseList);
 
module.exports = router;
