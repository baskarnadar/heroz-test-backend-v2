// pay.route
const PayStatus = require("./mempayment.controller");
const express = require("express");

const router = express.Router();

router.post("/MemPaySucess", PayStatus.MemPaySucess);
router.post("/MemPayFail", PayStatus.MemPayFail);

module.exports = router;
