const payment = require("./payment.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../../middleware/auth");
router.post("/paytoSchVdr", protectAPI,payment.paytoSchVdr);
router.post("/getSchVdr",protectAPI, payment.getSchVdr);
module.exports = router;

